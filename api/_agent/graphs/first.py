"""② 1차 질문 그래프: write → check → (rewrite → check) → finish. 설계 확정 9-1."""
import asyncio
import logging
import re
import time
from collections.abc import Callable
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..budget import FIRST_BUDGET_S, RETRY_MIN_LEFT_S, REWRITE_SAFETY_S
from ..checks import check_first
from ..llm import Llm, LlmError, LlmResult
from ..prompts.first import SYSTEM, user_message
from ..schemas import Draft, FirstRequest, FirstResponse

log = logging.getLogger("askback24.ai")


class State(TypedDict):
    req: FirstRequest
    drafts: dict[str, str]
    issues: dict[str, list[str]]
    rewrites: int
    rewrite_failed: bool
    started: float
    model: str


async def _call(llm: Llm, user: str, started: float, clock: Callable[[], float], margin: float = 0.0) -> LlmResult:
    # 마감은 모든 호출에 건다: 남은 예산(−margin)이 곧 호출 제한 시간이다.
    left = FIRST_BUDGET_S - (clock() - started) - margin
    if left <= 0:
        raise LlmError("timeout")
    try:
        return await asyncio.wait_for(llm.complete_json("fast", SYSTEM, user, left), timeout=left)
    except LlmError:
        raise
    except asyncio.TimeoutError:
        raise LlmError("timeout") from None
    except Exception:
        raise LlmError("not_json") from None


def _pick(data: Any, wanted: set[str]) -> dict[str, str]:
    """card_id 로 짝짓기: 같은 id 는 처음 것, 요청에 없는 id 와 모양이 다른 것은 버린다."""
    out: dict[str, str] = {}
    rows = data.get("questions") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return out
    for r in rows:
        if not isinstance(r, dict):
            continue
        cid, text = r.get("card_id"), r.get("text")
        if isinstance(cid, str) and isinstance(text, str) and cid in wanted and cid not in out:
            # TS(generate.ts)와 같이 공백을 한 칸으로 줄인 문장을 검사하고 돌려준다.
            out[cid] = re.sub(r"\s+", " ", text).strip()
    return out


def build_graph(llm: Llm, labels: set[str], clock: Callable[[], float]):
    async def write(s: State) -> dict:
        res = await _call(llm, user_message(s["req"]), s["started"], clock)
        return {"drafts": _pick(res.data, {i.card_id for i in s["req"].items}), "model": res.model}

    def check(s: State) -> dict:
        req = s["req"]
        issues: dict[str, list[str]] = {}
        for i in req.items:
            text = s["drafts"].get(i.card_id)
            found = ["missing"] if text is None else check_first(text, i.state, i.has_exp, req.posting, labels)
            if found:
                issues[i.card_id] = found
        return {"issues": issues}

    def after_check(s: State) -> str:
        left = FIRST_BUDGET_S - (clock() - s["started"])
        if s["issues"] and s["rewrites"] == 0 and left >= RETRY_MIN_LEFT_S:
            return "rewrite"
        return "finish"

    async def rewrite(s: State) -> dict:
        only = list(s["issues"])
        try:
            res = await _call(llm, user_message(s["req"], only, s["issues"]), s["started"], clock, REWRITE_SAFETY_S)
        except LlmError:
            return {"rewrites": 1, "rewrite_failed": True}
        return {"drafts": {**s["drafts"], **_pick(res.data, set(only))}, "model": res.model, "rewrites": 1}

    def after_rewrite(s: State) -> str:
        return "finish" if s["rewrite_failed"] else "check"

    def finish(s: State) -> dict:
        req = s["req"]
        ms = int((clock() - s["started"]) * 1000)
        issues = ",".join(f"{c}:{r}" for c, rs in s["issues"].items() for r in rs) or "-"
        log.info(
            "[ai] first n=%d passed=%d retried=%d card_id=%s issues=%s ms=%d model=%s",
            len(req.items), len(req.items) - len(s["issues"]), s["rewrites"],
            ",".join(i.card_id for i in req.items), issues, ms, s["model"],
        )
        return {}

    g = StateGraph(State)
    g.add_node("write", write)
    g.add_node("check", check)
    g.add_node("rewrite", rewrite)
    g.add_node("finish", finish)
    g.add_edge(START, "write")
    g.add_edge("write", "check")
    g.add_conditional_edges("check", after_check, {"rewrite": "rewrite", "finish": "finish"})
    g.add_conditional_edges("rewrite", after_rewrite, {"check": "check", "finish": "finish"})
    g.add_edge("finish", END)
    return g.compile()


async def run_first(
    req: FirstRequest, llm: Llm, labels: set[str], clock: Callable[[], float] = time.monotonic
) -> FirstResponse:
    final = await build_graph(llm, labels, clock).ainvoke(
        {"req": req, "drafts": {}, "issues": {}, "rewrites": 0, "rewrite_failed": False, "started": clock(), "model": ""}
    )
    questions = [
        Draft(card_id=i.card_id, text=final["drafts"][i.card_id].strip())
        for i in req.items
        if i.card_id not in final["issues"]
    ]
    return FirstResponse(questions=questions, model=final["model"])
