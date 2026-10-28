"""① 공고 분석(설계 §9-4). 판정 두 벌·처우 빈칸·회사 신호가 나란히 돌고 merge 에서 만난다.
병렬 갈래가 같은 상태 키를 쓰면 충돌하므로 갈래마다 키 이름을 따로 둔다(_a/_b)."""
import json
import logging
import re
import time
from collections.abc import Callable, Mapping
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, TypedDict

import httpx
from langgraph.graph import END, START, StateGraph

from ..analysis.blanks import find_blanks, load_blank_templates
from ..analysis.cards import EVIDENCE_FIELDS, check_card, compare
from ..budget import ANALYSIS_DEADLINE_S, ANALYSIS_LLM_MAX_S, RECLASSIFY_MIN_LEFT_S, SIGNAL_ASK_MIN_LEFT_S
from ..checks import check_signal_ask, squash
from ..company.data import CompanyData, company_data_from_files
from ..company.nps import fetch_pension
from ..company.resolve import CompanyRef, resolve_company
from ..company.signals import SignalFact, build_signal_facts
from ..llm import Llm, LlmError
from ..prompts import analysis as p_analysis
from ..prompts import signal_ask as p_ask
from ..schemas import (
    GRAPH_VERSION, AnalysisBody, AnalysisCard, AnalysisMeta, AnalysisRequest, AnalysisResponse,
    OfferBlank, OutOfDictionary, Signal,
)
from .rewrite_loop import call_with_deadline

log = logging.getLogger("askback24.ai")


class State(TypedDict, total=False):
    req: AnalysisRequest
    started: float
    book: list[dict]
    company_ref: CompanyRef  # 실제 이름·번호가 있을 수 있어 상태에만 둔다. merge 가 결과에 넣지 않는다.
    company_data: CompanyData
    sources: list[str]
    facts: list[SignalFact]
    asks: dict[str, str]
    signals: list[Signal]
    blanks: list[OfferBlank]
    cards: list[AnalysisCard]
    result: AnalysisResponse
    # 판정 갈래 a·b
    raw_a: dict[str, dict]
    raw_b: dict[str, dict]
    run_a: dict[str, dict] | None
    run_b: dict[str, dict] | None
    issues_a: dict[str, list[str]]
    issues_b: dict[str, list[str]]
    retried_a: bool
    retried_b: bool
    tried_a: bool  # 다시 판정을 시도했는지(고리 종료용). retried 는 호출이 돌아왔을 때만 로그에 쓴다
    tried_b: bool
    error_a: LlmError | None
    error_b: LlmError | None
    model_a: str
    model_b: str
    ood_a: list[dict]
    ood_b: list[dict]


def _first_by_id(data: Any, wanted: set[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    rows = data.get("cards") if isinstance(data, dict) else None
    for r in rows if isinstance(rows, list) else []:
        cid = r.get("card_id") if isinstance(r, dict) else None
        if isinstance(cid, str) and cid in wanted and cid not in out:
            out[cid] = r
    return out


def _ood(data: Any, posting: dict) -> list[dict]:
    rows = data.get("out_of_dictionary") if isinstance(data, dict) else None
    out = []
    for r in rows if isinstance(rows, list) else []:
        if not isinstance(r, dict):
            continue
        f, q, n = r.get("field"), r.get("quote"), r.get("note")
        text = posting.get(f) if isinstance(f, str) else None
        if f in EVIDENCE_FIELDS and isinstance(q, str) and q and isinstance(text, str) and q in text and isinstance(n, str):
            out.append({"field": f, "quote": q, "note": squash(n).strip()})
    return out


class AnalysisAgent:
    def __init__(
        self,
        llm: Llm,
        root: Path,
        env: Mapping[str, str],
        http: httpx.AsyncClient | None = None,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self.llm, self.root, self.env, self.http, self.clock, self.now = llm, Path(root), env, http, clock, now
        self.blank_templates = load_blank_templates(self.root)
        # 요청마다 다시 만들지 않도록 생성할 때 한 번만 compile 한다.
        self.graph = self._build()

    def has_job(self, job: str) -> bool:
        return (self.root / "data" / f"cards.{job}.json").is_file()

    def _left(self, s: State) -> float:
        return ANALYSIS_DEADLINE_S - (self.clock() - s["started"])

    async def _llm(self, s: State, role: str, system: str, user: str):
        left = self._left(s)
        if left <= 0:
            raise LlmError("timeout")
        return await call_with_deadline(self.llm, role, system, user, min(ANALYSIS_LLM_MAX_S, left))  # type: ignore[arg-type]

    def _build(self):
        def load(s: State) -> dict:
            book = json.loads((self.root / "data" / f"cards.{s['req'].job}.json").read_text(encoding="utf-8"))["cards"]
            return {"book": book, "company_ref": resolve_company(s["req"].posting, self.env)}

        def classifier(run: str):
            async def classify(s: State) -> dict:
                posting, ids = s["req"].posting, {c["id"] for c in s["book"]}
                try:
                    res = await self._llm(s, "accurate", p_analysis.SYSTEM, p_analysis.user_message(posting, s["book"], run=run))
                except LlmError as e:
                    return {f"error_{run}": e, f"raw_{run}": {}, f"ood_{run}": []}
                return {f"raw_{run}": _first_by_id(res.data, ids), f"model_{run}": res.model, f"ood_{run}": _ood(res.data, posting)}

            return classify

        def checker(run: str):
            def check(s: State) -> dict:
                if s.get(f"error_{run}"):
                    return {f"run_{run}": None, f"issues_{run}": {}}
                raw, ids = s[f"raw_{run}"], {c["id"] for c in s["book"]}
                passed, issues = {}, {}
                for c in s["book"]:
                    row = raw.get(c["id"])
                    found = ["missing"] if row is None else check_card(row, ids, s["req"].posting)
                    if found:
                        issues[c["id"]] = found
                    else:
                        passed[c["id"]] = row
                return {f"run_{run}": passed, f"issues_{run}": issues}

            return check

        def after_check(run: str):
            def route(s: State) -> str:
                if s[f"issues_{run}"] and not s.get(f"tried_{run}") and self._left(s) >= RECLASSIFY_MIN_LEFT_S:
                    return "reclassify"
                return "settled"

            return route

        def reclassifier(run: str):
            async def reclassify(s: State) -> dict:
                issues = s[f"issues_{run}"]
                only = list(issues)
                msg = p_analysis.user_message(s["req"].posting, s["book"], only, issues, run=run)
                try:
                    res = await self._llm(s, "accurate", p_analysis.SYSTEM, msg)
                except LlmError:
                    return {f"tried_{run}": True}  # 호출이 돌아오지 않았으니 retried 로 치지 않는다. 걸린 카드는 그대로 남아 compare 가 채운다
                fixed = _first_by_id(res.data, set(only))
                return {f"tried_{run}": True, f"retried_{run}": True, f"raw_{run}": {**s[f"raw_{run}"], **fixed}}

            return reclassify

        def settled(run: str):
            return lambda s: {}  # 다시 판정 고리를 빠져나온 갈래의 끝. compare 가 둘을 기다린다.

        def compare_node(s: State) -> dict:
            return {"cards": compare([c["id"] for c in s["book"]], s["run_a"], s["run_b"])}

        def blanks(s: State) -> dict:
            return {"blanks": find_blanks(s["req"].posting, self.blank_templates)}

        async def company(s: State) -> dict:
            ref, posting = s["company_ref"], s["req"].posting
            data = company_data_from_files(ref, posting, self.root)
            nps = "skip"
            key = self.env.get("DATA_GO_KR_KEY")
            if ref.kind != "demo":
                # 실제 회사에는 모의 연금 값을 대신 보여 주지 않는다.
                data.pension, data.pension_source = None, None
                # 검색에 이름이 필요해 bizNo 만 있는 공고는 부르지 않는다(공고 corpNm 연결은 아직 없음).
                if key and ref.name and ref.biz_no:
                    client = self.http or httpx.AsyncClient()
                    try:
                        facts = await fetch_pension(ref, key, client, self.now().date())
                    finally:
                        if self.http is None:
                            await client.aclose()
                    if facts:
                        data.pension, data.pension_source = facts, "실제"
                    nps = "ok" if facts else "none"
            giants = "none" if not data.giants else ("real" if data.giants_source == "실제" else "mock")
            return {"company_data": data, "sources": [f"nps:{nps}", f"giants:{giants}"]}

        def signal_facts(s: State) -> dict:
            facts = build_signal_facts(s["req"].posting, s["company_data"])
            eis = "ok" if any(f.kind == "industry_baseline" for f in facts) else "none"
            src = s["sources"]
            return {"facts": facts, "sources": [src[0], f"eis:{eis}", src[1]]}

        def after_facts(s: State) -> str:
            return "signal_ask" if any(f.ask_hint for f in s["facts"]) else "signals_done"

        async def signal_ask(s: State) -> dict:
            # 판정이 둘 다 오류면 어차피 503 이라, 신호 질문으로 응답을 늦추지 않는다.
            if self._left(s) < SIGNAL_ASK_MIN_LEFT_S or (s.get("error_a") and s.get("error_b")):
                return {"asks": {}}
            hints, seen = [], set()
            for f in s["facts"]:
                if f.ask_hint and f.kind not in seen:
                    seen.add(f.kind)
                    hints.append({"kind": f.kind, "ask_hint": f.ask_hint})
            try:
                res = await self._llm(s, "fast", p_ask.SYSTEM, p_ask.user_message(hints))
            except LlmError:
                return {"asks": {}}
            rows = res.data.get("asks") if isinstance(res.data, dict) else None
            asks: dict[str, str] = {}
            for r in rows if isinstance(rows, list) else []:
                kind = r.get("kind") if isinstance(r, dict) else None
                # LLM 이 kind 를 목록·객체로 주면 `in set` 이 TypeError 라 문자열만 받는다.
                if isinstance(kind, str) and kind in seen and isinstance(r.get("ask"), str) and kind not in asks:
                    asks[kind] = squash(r["ask"]).strip()
            return {"asks": asks}

        def signal_check(s: State) -> dict:
            return {"asks": {k: v for k, v in s["asks"].items() if not check_signal_ask(v)}}

        def signals_done(s: State) -> dict:
            asks = s.get("asks") or {}
            out = []
            for f in s["facts"]:
                ask, src = None, None
                if f.ask_hint:
                    ask, src = (asks[f.kind], "ai") if f.kind in asks else (f.template_ask, "template")
                out.append(Signal(kind=f.kind, text=f.text, source=f.source, source_name=f.source_name,
                                  ask=ask, ask_source=src, caveat=f.caveat))  # type: ignore[arg-type]
            return {"signals": out}

        def merge(s: State) -> dict:
            ea, eb = s.get("error_a"), s.get("error_b")
            if ea and eb:
                raise ea
            seen, ood = set(), []
            for row in s.get("ood_a", []) + s.get("ood_b", []):
                if row["quote"] not in seen:
                    seen.add(row["quote"])
                    ood.append(OutOfDictionary(**row))
            cards = s["cards"]
            model = s.get("model_a") or s.get("model_b") or ""
            posting = s["req"].posting
            result = AnalysisResponse(
                analysis=AnalysisBody(wantedAuthNo=str(posting.get("wantedAuthNo", "")), cards=cards, blanks=s["blanks"]),
                signals=s["signals"], out_of_dictionary=ood,
                meta=AnalysisMeta(graph_version=GRAPH_VERSION, model=model, created_at=self.now().isoformat()),
            )
            retried = ",".join(r for r in "ab" if s.get(f"retried_{r}")) or "-"
            log.info(
                "[ai] analysis job=%s cards=%d needs_review=%d retried=%s signals=%s sources=%s ms=%d model=%s",
                s["req"].job, len(cards), sum(c.needs_review for c in cards), retried,
                ",".join(x.kind for x in s["signals"]) or "-", ",".join(s["sources"]),
                int((self.clock() - s["started"]) * 1000), model,
            )
            return {"result": result}

        g = StateGraph(State)
        for name, fn in {
            "load": load, "classify_a": classifier("a"), "classify_b": classifier("b"),
            "check_a": checker("a"), "check_b": checker("b"),
            "reclassify_a": reclassifier("a"), "reclassify_b": reclassifier("b"),
            "settled_a": settled("a"), "settled_b": settled("b"), "compare": compare_node,
            "blanks": blanks, "company": company, "signal_facts": signal_facts, "signal_ask": signal_ask,
            "signal_check": signal_check, "signals_done": signals_done, "merge": merge,
        }.items():
            g.add_node(name, fn)
        g.add_edge(START, "load")
        for branch in ("classify_a", "classify_b", "blanks", "company"):
            g.add_edge("load", branch)
        for r in "ab":
            g.add_edge(f"classify_{r}", f"check_{r}")
            g.add_conditional_edges(f"check_{r}", after_check(r), {"reclassify": f"reclassify_{r}", "settled": f"settled_{r}"})
            g.add_edge(f"reclassify_{r}", f"check_{r}")
        # check 가 고리를 돌 수 있어 합류는 고리를 빠져나온 settled 끝에서 한다(check 에서 바로 합류하면 다시 판정을 기다리지 않는다).
        g.add_edge(["settled_a", "settled_b"], "compare")
        g.add_edge("company", "signal_facts")
        g.add_conditional_edges("signal_facts", after_facts, {"signal_ask": "signal_ask", "signals_done": "signals_done"})
        g.add_edge("signal_ask", "signal_check")
        g.add_edge("signal_check", "signals_done")
        g.add_edge(["compare", "blanks", "signals_done"], "merge")
        g.add_edge("merge", END)
        return g.compile()

    async def run(self, req: AnalysisRequest) -> AnalysisResponse:
        started = self.clock()
        try:
            final = await self.graph.ainvoke({"req": req, "started": started})
        except LlmError as e:
            log.info("[ai] analysis unavailable code=%s ms=%d", e.code, int((self.clock() - started) * 1000))
            raise
        return final["result"]
