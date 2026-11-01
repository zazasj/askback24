"""⓪ 업무 카드 초안(설계 §9-5). 능력단위 후보는 규칙이, 카드 글은 LLM이 쓰고 사람이 검수한다."""
import asyncio
import contextlib
import json
import logging
import time
from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict

import httpx
from langgraph.graph import END, START, StateGraph

from ..budget import CARDS_DEADLINE_S, CARDS_LLM_MAX_S, CARDS_REWRITE_MIN_LEFT_S, RECOMMEND_MAX_EXTRA_UNITS, RECOMMEND_MAX_QUERIES
from ..cards.candidates import Candidate, build_candidates
from ..cards.checks import check_card_draft
from ..cards.sources import CardSources, SourceError, Unit, spaceless
from ..errors import ApiError
from ..llm import Llm, LlmError
from ..prompts import cards as p_cards
from ..schemas import (
    CARDS_GRAPH_VERSION, CandidateOut, CardDraft, CardDraftMeta, CardDraftRequest, CardDraftResponse, CardInterpretation,
    CardIssue, CardNcs, CardSignals,
)
from .rewrite_loop import call_with_deadline

log = logging.getLogger("askback24.ai")

CORE_COUNT = 12
_SOURCE_KO = {"real": "실제", "snapshot": "실제 스냅숏", "mock": "모의"}
_RECOMMEND_PARALLEL = 5


class State(TypedDict, total=False):
    req: CardDraftRequest
    started: float
    sources: CardSources
    units: list[Unit]
    recommended: list[Unit]
    duties: list[str]
    candidates: list[Candidate]
    cards: list[Any]  # LLM 이 쓴 카드 원본(max_cards 로 자른 뒤)
    truncated: bool
    model: str
    issues: dict[int, list[str]]
    tried: bool
    retried: bool
    result: CardDraftResponse


def _strs(v: Any) -> list[str]:
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def _str(v: Any) -> str:
    return v if isinstance(v, str) else ""


def _draft_dict(raw: Any) -> dict:
    return raw if isinstance(raw, dict) else {}


class CardsAgent:
    def __init__(
        self,
        llm: Llm,
        root: Path,
        env: Mapping[str, str],
        http: httpx.AsyncClient | None = None,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        deadline_s: float = CARDS_DEADLINE_S,
        llm_max_s: float = CARDS_LLM_MAX_S,
    ) -> None:
        self.llm, self.root, self.env, self.http, self.clock, self.now = llm, Path(root), env, http, clock, now
        self.deadline_s, self.llm_max_s = deadline_s, llm_max_s
        self.example = self._load_example()
        # 요청마다 다시 만들지 않도록 생성할 때 한 번만 compile 한다.
        self.graph = self._build()

    def _load_example(self) -> dict | None:
        try:
            book = json.loads((self.root / "data" / "cards.backend.json").read_text(encoding="utf-8"))["cards"]
            return next((c for c in book if c.get("id") == "BE01"), None)
        except Exception:
            return None  # 글 모양 예시가 없어도 초안은 쓴다

    def _left(self, s: State) -> float:
        return self.deadline_s - (self.clock() - s["started"])

    async def _llm(self, s: State, user: str):
        left = self._left(s)
        if left <= 0:
            raise LlmError("timeout")
        return await call_with_deadline(self.llm, "accurate", p_cards.SYSTEM, user, min(self.llm_max_s, left))

    def _build(self):
        async def fetch_all(s: State) -> dict:
            req, src = s["req"], s["sources"]
            units: list[Unit] = []
            for code in req.ncs_subcategories:
                units += await src.units(code)
            duties = await src.duties(req.job_dictionary_code)
            queries: list[str] = []
            for u in units:
                q = spaceless(u.name)
                if q and q not in queries:
                    queries.append(q)
            sem = asyncio.Semaphore(_RECOMMEND_PARALLEL)

            failed = asyncio.Event()

            async def rec(q: str) -> list[Unit]:
                async with sem:
                    if failed.is_set():  # 앞 호출이 실패했으면 대기하던 호출은 나가지 않는다
                        return []
                    try:
                        return await src.recommend(q)
                    except BaseException:
                        failed.set()
                        raise

            tasks = [asyncio.ensure_future(rec(q)) for q in queries[:RECOMMEND_MAX_QUERIES]]
            try:
                found = await asyncio.gather(*tasks)
            except BaseException:
                # 한 호출이 실패하면 대기 중인 나머지 호출을 멈춘다
                for t in tasks:
                    t.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                raise
            listed = {u.code for u in units}
            recommended: list[Unit] = []
            extra: set[str] = set()
            for u in (u for f in found for u in f):
                if u.code not in listed and u.code not in extra:
                    if len(extra) >= RECOMMEND_MAX_EXTRA_UNITS:
                        continue
                    extra.add(u.code)
                recommended.append(u)
            return {"units": units, "duties": duties, "recommended": recommended}

        async def fetch(s: State) -> dict:
            # 느린 출처가 마감을 넘기지 않게 남은 시간으로 끊는다
            try:
                return await asyncio.wait_for(fetch_all(s), timeout=max(self._left(s), 0))
            except asyncio.TimeoutError:
                raise SourceError("자료 출처가 마감 안에 답하지 않음", code="source_timeout") from None

        def candidates(s: State) -> dict:
            cands = build_candidates(s["units"], s["recommended"])
            if not cands:
                raise ApiError(400, "invalid_request", "no units")
            return {"candidates": cands}

        async def group_and_write(s: State) -> dict:
            req = s["req"]
            res = await self._llm(s, p_cards.user_message(req, s["candidates"], s["duties"], self.example))
            rows = res.data.get("cards") if isinstance(res.data, dict) else None
            if not isinstance(rows, list) or not rows:
                raise LlmError("not_json")  # 빈 목록도 쓸 수 있는 초안이 아니다
            return {"cards": rows[: req.max_cards], "truncated": len(rows) > req.max_cards, "model": res.model}

        def check(s: State) -> dict:
            codes = {c.ablt_unit for c in s["candidates"]}
            used: set[str] = set()
            issues: dict[int, list[str]] = {}
            for i, raw in enumerate(s["cards"]):
                found = check_card_draft(raw, codes, used)
                if found:
                    issues[i] = found
                used.update(_strs(_draft_dict(raw).get("units")))
            return {"issues": issues}

        def after_check(s: State) -> str:
            if s["issues"] and not s.get("tried") and self._left(s) >= CARDS_REWRITE_MIN_LEFT_S:
                return "rewrite_cards"
            return "finish"

        async def rewrite_cards(s: State) -> dict:
            cards, issues = s["cards"], s["issues"]
            positions = sorted(issues)
            # 통과한 카드가 쓴 능력단위만 막는다. 실패한 카드와 나눠 쓴 단위도 통과 카드가 쥔 것이다.
            taken = sorted({u for i, c in enumerate(cards) if i not in issues for u in _strs(_draft_dict(c).get("units"))})
            msg = p_cards.user_message(
                s["req"], s["candidates"], s["duties"], self.example,
                only=[cards[i] for i in positions], issues=[issues[i] for i in positions], taken=taken,
            )
            try:
                res = await self._llm(s, msg)
            except LlmError:
                return {"tried": True}  # 첫 초안을 그대로 두고 issues 로 남긴다
            rows = res.data.get("cards") if isinstance(res.data, dict) else None
            if not isinstance(rows, list):
                return {"tried": True}
            new, replaced = list(cards), False
            for pos, row in zip(positions, rows):
                if isinstance(row, dict):
                    new[pos], replaced = row, True
            if not replaced:
                return {"tried": True}
            return {"tried": True, "retried": True, "cards": new}

        def finish(s: State) -> dict:
            req, cands = s["req"], s["candidates"]
            by_code = {c.ablt_unit: c for c in cands}
            ids = [f"{req.job[:2].upper()}{n:02d}" for n in range(1, len(s["cards"]) + 1)]
            cards: list[CardDraft] = []
            for i, raw in enumerate(s["cards"]):
                d = _draft_dict(raw)
                sig, interp, qs = d.get("posting_signals"), d.get("interpretation"), d.get("questions")
                sig, interp = sig if isinstance(sig, dict) else {}, interp if isinstance(interp, dict) else {}
                listed = [by_code[c] for c in dict.fromkeys(_strs(d.get("units"))) if c in by_code]
                for c in listed:
                    if c.used_in is None:
                        c.used_in = ids[i]
                cards.append(
                    CardDraft(
                        id=ids[i], kind="task", core=i < CORE_COUNT, label=_str(d.get("label")), plain=_str(d.get("plain")),
                        examples=_strs(d.get("examples")),
                        ncs=[CardNcs(subcategory=c.subcategory, unit=c.unit, ablt_unit=c.ablt_unit) for c in listed],
                        mapping_confidence="draft",
                        posting_signals=CardSignals(explicit=_strs(sig.get("explicit")), implicit=_strs(sig.get("implicit"))),
                        questions={k: v for k, v in qs.items() if isinstance(k, str) and isinstance(v, str)} if isinstance(qs, dict) else {},
                        example_question=d.get("example_question") if isinstance(d.get("example_question"), str) else None,
                        interpretation=CardInterpretation(
                            mismatch_if_want=_str(interp.get("mismatch_if_want")),
                            mismatch_if_avoid=_str(interp.get("mismatch_if_avoid")),
                            good_if=_str(interp.get("good_if")),
                        ),
                    )
                )
            issues = [CardIssue(card_id=None, rule="too_many_cards")] if s.get("truncated") else []
            for i in sorted(s["issues"]):
                issues += [CardIssue(card_id=ids[i], rule=r) for r in s["issues"][i]]
            used = s["sources"].used
            result = CardDraftResponse(
                candidates=[
                    CandidateOut(ablt_unit=c.ablt_unit, unit=c.unit, subcategory=c.subcategory, level=c.level,
                                 high_level=c.high_level, used_in=c.used_in)
                    for c in cands
                ],
                cards=cards, issues=issues,
                meta=CardDraftMeta(graph_version=CARDS_GRAPH_VERSION, model=s["model"], created_at=self.now().isoformat(),
                                   sources={k: _SOURCE_KO[v] for k, v in used.items()},
                                   job_dictionary=" ".join(s["duties"]) or None),  # type: ignore[misc]
            )
            log.info(
                "[ai] cards job=%s candidates=%d cards=%d issues=%d retried=%d sources=%s ms=%d model=%s",
                req.job, len(cands), len(cards), len(issues), int(bool(s.get("retried"))),
                ",".join(f"{k}:{v}" for k, v in used.items()), int((self.clock() - s["started"]) * 1000), s["model"],
            )
            return {"result": result}

        g = StateGraph(State)
        for name, fn in {
            "fetch": fetch, "candidates": candidates, "group_and_write": group_and_write, "check": check,
            "rewrite_cards": rewrite_cards, "finish": finish,
        }.items():
            g.add_node(name, fn)
        g.add_edge(START, "fetch")
        g.add_edge("fetch", "candidates")
        g.add_edge("candidates", "group_and_write")
        g.add_edge("group_and_write", "check")
        g.add_conditional_edges("check", after_check, {"rewrite_cards": "rewrite_cards", "finish": "finish"})
        g.add_edge("rewrite_cards", "check")
        g.add_edge("finish", END)
        return g.compile()

    async def run(self, req: CardDraftRequest) -> CardDraftResponse:
        started = self.clock()
        try:
            # http 가 없으면 요청 하나에 클라이언트 하나를 열어 모든 출처 호출이 나눠 쓴다
            async with contextlib.AsyncExitStack() as stack:
                http = self.http or await stack.enter_async_context(httpx.AsyncClient())
                sources = CardSources(self.env, self.root, http)  # used 는 요청마다 따로 쌓는다
                final = await self.graph.ainvoke({"req": req, "started": started, "sources": sources})
        except (LlmError, SourceError) as e:
            code = e.code
            log.info("[ai] cards unavailable code=%s ms=%d", code, int((self.clock() - started) * 1000))
            raise
        return final["result"]
