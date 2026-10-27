"""판정 → 검사 → 마무리. 다시 판정하는 노드는 없다(설계 §9-2): 걸린 카드는 TS가 규칙으로 채운다."""
import logging
import re
import time
from collections.abc import Callable
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..budget import JUDGE_BUDGET_S
from ..checks import check_judgement
from ..llm import Llm, LlmError
from ..prompts.judge import SYSTEM, user_message
from ..schemas import JudgeRequest, JudgeResponse, Judgement
from .rewrite_loop import call_with_deadline

log = logging.getLogger("askback24.ai")


class State(TypedDict):
    req: JudgeRequest
    raw: dict[str, tuple[str, str]]  # card_id → (state, basis), 짝짓기만 끝난 것
    passed: list[Judgement]
    issues: dict[str, list[str]]
    started: float
    model: str


class JudgeAgent:
    def __init__(self, llm: Llm, clock: Callable[[], float] = time.monotonic) -> None:
        self.llm, self.clock = llm, clock
        # 요청마다 다시 만들지 않도록 생성할 때 한 번만 compile 한다.
        self.graph = self._build()

    @staticmethod
    def _pick(data: Any, wanted: set[str]) -> dict[str, tuple[str, str]]:
        out: dict[str, tuple[str, str]] = {}
        rows = data.get("judgements") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            return out
        for r in rows:
            if not isinstance(r, dict):
                continue
            cid, state, basis = r.get("card_id"), r.get("state"), r.get("basis")
            if isinstance(cid, str) and isinstance(state, str) and isinstance(basis, str) and cid in wanted and cid not in out:
                out[cid] = (state, basis)
        return out

    def _build(self):
        clock = self.clock

        async def judge(s: State) -> dict:
            left = JUDGE_BUDGET_S - (clock() - s["started"])
            if left <= 0:
                raise LlmError("timeout")
            res = await call_with_deadline(self.llm, "fast", SYSTEM, user_message(s["req"]), left)
            return {"raw": self._pick(res.data, {i.card_id for i in s["req"].items}), "model": res.model}

        def check(s: State) -> dict:
            passed: list[Judgement] = []
            issues: dict[str, list[str]] = {}
            for i in s["req"].items:
                got = s["raw"].get(i.card_id)
                if got is None:
                    issues[i.card_id] = ["missing"]
                    continue
                state, basis = got
                basis = re.sub(r"\s+", " ", basis).strip()
                found = check_judgement(basis, state, [i.heard])
                if found:
                    issues[i.card_id] = found
                else:
                    passed.append(Judgement(card_id=i.card_id, state=state, basis=basis))  # type: ignore[arg-type]
            return {"passed": passed, "issues": issues}

        def finish(s: State) -> dict:
            req = s["req"]
            issues = ",".join(f"{c}:{r}" for c, rs in s["issues"].items() for r in rs) or "-"
            log.info(
                "[ai] judge n=%d passed=%d card_id=%s issues=%s ms=%d model=%s",
                len(req.items), len(s["passed"]), ",".join(i.card_id for i in req.items), issues,
                int((clock() - s["started"]) * 1000), s["model"],
            )
            return {}

        g = StateGraph(State)
        g.add_node("judge", judge)
        g.add_node("check", check)
        g.add_node("finish", finish)
        g.add_edge(START, "judge")
        g.add_edge("judge", "check")
        g.add_edge("check", "finish")
        g.add_edge("finish", END)
        return g.compile()

    async def run(self, req: JudgeRequest) -> JudgeResponse:
        started = self.clock()
        try:
            final = await self.graph.ainvoke(
                {"req": req, "raw": {}, "passed": [], "issues": {}, "started": started, "model": ""}
            )
        except LlmError as e:
            log.info("[ai] judge unavailable code=%s ms=%d", e.code, int((self.clock() - started) * 1000))
            raise
        return JudgeResponse(judgements=final["passed"], model=final["model"])
