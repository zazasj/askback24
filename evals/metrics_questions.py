"""②③ 질문 지표. 질문·공고·이력 글은 결과 파일 밖으로 내보내지 않고, 콘솔에도 찍지 않는다."""
import json
import math
import random
from collections import Counter
from collections.abc import Callable
from difflib import SequenceMatcher
from pathlib import Path

from pydantic import ValidationError

from api._agent.checks import EXPERIENCE_CLAIM, allowed_source
from api._agent.graphs.first import allowed_text
from api._agent.llm import Llm
from api._agent.schemas import FirstRequest
from api._agent.terms import NON_RUNTIME, terms_in, unknown_in
from evals.judges import guess_persona, guess_posting, inflates, presupposes

ROOT = Path(__file__).resolve().parents[1]
_DECOYS = 2
_JUDGE_KEYS = {
    "posting_guess": "posting_ok",
    "persona_guess": "persona_ok",
    "presupposition": "presupposes",
    "inflation": "inflated",
}


def question_id(row: dict, kind: str, rank: int) -> str:
    return f"{row['wantedAuthNo']}:{row['persona']}:{kind}:{rank}"


def _questions(row: dict, kind: str) -> list[dict]:
    if kind == "first":
        return list((row.get("first") or {}).get("questions") or [])
    return list((row.get("final") or {}).get("final_questions") or [])


def template_rate(rows: list[dict], kind: str) -> float:
    qs = [q for r in rows for q in _questions(r, kind)]
    return sum(q.get("source") == "template" for q in qs) / len(qs) if qs else 0.0


def latency_p95(rows: list[dict], kind: str) -> float:
    ms = sorted(r[f"{kind}_ms"] for r in rows if isinstance(r.get(f"{kind}_ms"), (int, float)))
    if not ms:
        return 0.0
    return ms[math.ceil(0.95 * len(ms)) - 1] / 1000


def similarity_ab(rows: list[dict]) -> float | None:
    by_persona: dict[str, dict[tuple[str, str], str]] = {"A": {}, "B": {}}
    for r in rows:
        if r.get("persona") not in by_persona:
            continue
        for q in _questions(r, "first"):
            if q.get("source") == "ai" and q.get("card_id"):
                by_persona[r["persona"]][(r["wantedAuthNo"], q["card_id"])] = q.get("text", "")
    scores = [
        SequenceMatcher(None, text, by_persona["B"][key]).ratio()
        for key, text in by_persona["A"].items() if key in by_persona["B"]
    ]
    return sum(scores) / len(scores) if scores else None


def _first_request(row: dict) -> FirstRequest | None:
    try:
        return FirstRequest(**row["first_input"]) if isinstance(row.get("first_input"), dict) else None
    except (ValidationError, TypeError):
        return None


def _allowed_by_card(row: dict, kind: str, postings: dict[str, dict]) -> tuple[str, dict[str, str]]:
    """실행 중 unknown_term 검사와 같은 허용 글. 1차는 보낸 공고 + 문항별 지원자 글(api._agent.graphs.first.allowed_text), 최종은 공고만."""
    if kind == "first":
        req = _first_request(row)
        if req is not None:
            return allowed_source(req.posting), {i.card_id: allowed_source(req.posting, allowed_text(req, i)) for i in req.items}
    posting = (row.get(f"{kind}_input") or {}).get("posting")
    if not isinstance(posting, dict):
        posting = postings.get(row["wantedAuthNo"], {})
    return allowed_source(posting), {}


def unknown_terms(rows: list[dict], postings: dict[str, dict]) -> dict:
    """질문 낱말 중 실행 중 검사가 허용하지 않는 것의 비율(낱말 단위, 1차·최종 따로).
    함의(implied_by)는 같게 보고, 실행 중 검사에서 빼는 낱말(REST)은 by_term 대신 non_runtime 에 센다(분모에는 든다)."""
    out: dict = {}
    for kind in ("first", "final"):
        total = 0
        by_term: Counter[str] = Counter()
        non_runtime: Counter[str] = Counter()
        for r in rows:
            base, per_card = _allowed_by_card(r, kind, postings)
            for q in _questions(r, kind):
                text = q.get("text", "")
                total += len(terms_in(text))
                for t in unknown_in(text, per_card.get(q.get("card_id"), base)):
                    (non_runtime if t in NON_RUNTIME else by_term)[t] += 1
        out[kind] = {"rate": sum(by_term.values()) / total if total else None, "terms": total,
                     "by_term": dict(by_term), "non_runtime": dict(non_runtime)}
    return out


def judgement_metrics(rows: list[dict]) -> dict:
    confusion: dict[str, dict[str, int]] = {}
    ok = n = 0
    for r in rows:
        if r.get("got") is None:
            continue
        n += 1
        ok += r["got"] == r["expected"]
        cell = confusion.setdefault(r["expected"], {})
        cell[r["got"]] = cell.get(r["got"], 0) + 1
    dropped = sum(r.get("got") is None for r in rows)
    return {
        "accuracy": ok / n if n else None,
        "confusion": confusion,
        "dropped_rate": dropped / len(rows) if rows else None,
    }


def _card_labels(root: Path = ROOT) -> dict[str, str]:
    data = json.loads((root / "data" / "cards.backend.json").read_text(encoding="utf-8"))
    return {c["id"]: c["label"] for c in data.get("cards", []) if "id" in c and "label" in c}


async def judge_rows(llm: Llm, rows: list[dict], postings: dict[str, dict], analyses: dict[str, dict],
                     personas: dict[str, dict], seed: int, card_labels: dict[str, str] | None = None,
                     on_row: Callable[[dict], None] | None = None) -> list[dict]:
    """질문마다 판정을 매긴다. on_row 는 줄이 끝날 때마다 부른다(중간에 멈춰도 그때까지의 판정이 남게)."""
    labels = card_labels if card_labels is not None else _card_labels()
    rng = random.Random(seed)
    order = ["A", "B"]
    out: list[dict] = []
    for r in rows:
        no, persona = r["wantedAuthNo"], r["persona"]
        posting = postings.get(no)
        others = [p for k, p in postings.items() if k != no]
        analysis = analyses.get(no)
        present = {c.get("card_id") for c in (analysis or {}).get("cards", [])}
        experience = str((r.get("first_input") or {}).get("experience") or "")
        items = {i.get("card_id"): i for i in (r.get("first_input") or {}).get("items") or [] if isinstance(i, dict)}
        for kind in ("first", "final"):
            for q in _questions(r, kind):
                text, card = q.get("text", ""), q.get("card_id")
                j: dict = {"id": question_id(r, kind, q["rank"]), "kind": kind, "posting_ok": None,
                           "persona_ok": None, "presupposes": None, "inflated": None}
                na: list[str] = []
                if q.get("source") == "ai" and posting is not None and others:
                    options = [posting, *rng.sample(others, min(_DECOYS, len(others)))]
                    g = await guess_posting(llm, text, options, rng)
                    j["posting_ok"] = None if g is None else g == 0
                else:
                    na.append("posting_ok")
                if kind == "first" and q.get("source") == "ai" and persona in order and all(k in personas for k in order):
                    g = await guess_persona(llm, text, [personas[k] for k in order], rng)
                    j["persona_ok"] = None if g is None else g == order.index(persona)
                else:
                    na.append("persona_ok")
                if posting is not None and analysis is not None and card in labels and card not in present:
                    j["presupposes"] = await presupposes(llm, text, posting, labels[card])
                else:
                    na.append("presupposes")
                item = items.get(card) if kind == "first" else None
                # 경험 한 줄·이력서를 쓸 수 있던 AI 문항은 정규식에 안 걸려도 부풀림을 본다
                cites = q.get("source") == "ai" and bool(item) and bool(item.get("has_exp") or item.get("can_cite_resume"))
                if cites or EXPERIENCE_CLAIM.search(text):
                    j["inflated"] = await inflates(llm, text, experience, personas.get(persona))
                else:
                    na.append("inflated")
                # 해당 없음과 판정 실패를 가르는 표시. 실패만 failed 로 센다
                j["na"] = na
                out.append(j)
                if on_row is not None:
                    on_row(j)
    return out


def all_judges_failed(rates_: dict) -> bool:
    """판정을 하나라도 불렀는데 답을 하나도 못 받았는지(키·연결 문제)."""
    used = sum(v["n"] for v in rates_.values())
    failed = sum(v["failed"] for v in rates_.values())
    return failed > 0 and used == 0


def rates(judged: list[dict]) -> dict:
    res: dict = {}
    for name, key in _JUDGE_KEYS.items():
        vals = [j.get(key) for j in judged if key not in j.get("na", [])]
        used = [v for v in vals if v is not None]
        res[name] = {
            "rate": sum(used) / len(used) if used else None,
            "n": len(used),
            "failed": len(vals) - len(used),
        }
    return res
