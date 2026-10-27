"""쓰기 → 검사 → (실패한 것만 한 번 다시 쓰기 → 검사) → 마무리 공통 틀. ②·③-2가 LoopSpec만 달리 해서 쓴다."""
import asyncio
import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..budget import RETRY_MIN_LEFT_S, REWRITE_SAFETY_S
from ..llm import Llm, LlmError, LlmResult, Role

log = logging.getLogger("askback24.ai")


@dataclass(frozen=True)
class LoopSpec:
    name: str  # 로그 이름표 ([ai] <name> …)
    role: Role
    budget_s: float
    system: str
    key_field: str  # LLM 응답 짝 키 이름이자 로그 이름표
    key_of: Callable[[Any], str]
    check: Callable[[Any, Any, str], list[str]]  # (req, item, text) → 걸린 규칙
    user_message: Callable[[Any, list[str] | None, dict[str, list[str]] | None], str]


class State(TypedDict):
    req: Any
    drafts: dict[str, str]
    issues: dict[str, list[str]]
    rewrites: int
    rewrite_failed: bool
    started: float
    model: str


class LoopAgent:
    def __init__(self, spec: LoopSpec, llm: Llm, clock: Callable[[], float] = time.monotonic) -> None:
        self.spec, self.llm, self.clock = spec, llm, clock
        # 요청마다 다시 만들지 않도록 생성할 때 한 번만 compile 한다.
        self.graph = self._build()

    async def _call(self, user: str, started: float, margin: float = 0.0) -> LlmResult:
        # 마감은 모든 호출에 건다: 남은 예산(−margin)이 곧 호출 제한 시간이다.
        left = self.spec.budget_s - (self.clock() - started) - margin
        if left <= 0:
            raise LlmError("timeout")
        try:
            return await asyncio.wait_for(
                self.llm.complete_json(self.spec.role, self.spec.system, user, left), timeout=left
            )
        except LlmError:
            raise
        except asyncio.TimeoutError:
            raise LlmError("timeout") from None
        except Exception:
            raise LlmError("not_json") from None

    def _pick(self, data: Any, wanted: set[str]) -> dict[str, str]:
        """짝 키로 짝짓기: 같은 키는 처음 것, 요청에 없는 키와 모양이 다른 것은 버린다."""
        out: dict[str, str] = {}
        rows = data.get("questions") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            return out
        for r in rows:
            if not isinstance(r, dict):
                continue
            key, text = r.get(self.spec.key_field), r.get("text")
            if isinstance(key, str) and isinstance(text, str) and key in wanted and key not in out:
                # TS(generate.ts)와 같이 공백을 한 칸으로 줄인 문장을 검사하고 돌려준다.
                out[key] = re.sub(r"\s+", " ", text).strip()
        return out

    def _build(self):
        spec, clock = self.spec, self.clock

        async def write(s: State) -> dict:
            res = await self._call(spec.user_message(s["req"], None, None), s["started"])
            return {"drafts": self._pick(res.data, {spec.key_of(i) for i in s["req"].items}), "model": res.model}

        def check(s: State) -> dict:
            req = s["req"]
            issues: dict[str, list[str]] = {}
            for i in req.items:
                key = spec.key_of(i)
                text = s["drafts"].get(key)
                found = ["missing"] if text is None else spec.check(req, i, text)
                if found:
                    issues[key] = found
            return {"issues": issues}

        def after_check(s: State) -> str:
            left = spec.budget_s - (clock() - s["started"])
            if s["issues"] and s["rewrites"] == 0 and left >= RETRY_MIN_LEFT_S:
                return "rewrite"
            return "finish"

        async def rewrite(s: State) -> dict:
            only = list(s["issues"])
            try:
                res = await self._call(spec.user_message(s["req"], only, s["issues"]), s["started"], REWRITE_SAFETY_S)
            except LlmError:
                return {"rewrites": 1, "rewrite_failed": True}
            return {"drafts": {**s["drafts"], **self._pick(res.data, set(only))}, "model": res.model, "rewrites": 1}

        def after_rewrite(s: State) -> str:
            return "finish" if s["rewrite_failed"] else "check"

        def finish(s: State) -> dict:
            req = s["req"]
            ms = int((clock() - s["started"]) * 1000)
            issues = ",".join(f"{c}:{r}" for c, rs in s["issues"].items() for r in rs) or "-"
            log.info(
                "[ai] %s n=%d passed=%d retried=%d %s=%s issues=%s ms=%d model=%s",
                spec.name, len(req.items), len(req.items) - len(s["issues"]), s["rewrites"],
                spec.key_field, ",".join(spec.key_of(i) for i in req.items), issues, ms, s["model"],
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

    async def run(self, req: Any) -> tuple[dict[str, str], dict[str, list[str]], int, str]:
        started = self.clock()
        try:
            final = await self.graph.ainvoke(
                {"req": req, "drafts": {}, "issues": {}, "rewrites": 0, "rewrite_failed": False, "started": started, "model": ""}
            )
        except LlmError as e:
            # 첫 쓰기 실패는 503 이 된다. 로그 한 줄은 여기서만 남긴다.
            log.info("[ai] %s unavailable code=%s ms=%d", self.spec.name, e.code, int((self.clock() - started) * 1000))
            raise
        passed = {
            k: final["drafts"][k]
            for k in (self.spec.key_of(i) for i in req.items)
            if k not in final["issues"]
        }
        return passed, final["issues"], final["rewrites"], final["model"]
