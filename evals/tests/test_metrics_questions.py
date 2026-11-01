import json
from pathlib import Path

from api._agent.llm import LlmResult
from evals.judges import SYSTEMS
from evals.metrics_questions import (
    judge_rows, judgement_metrics, latency_p95, question_id, rates, similarity_ab, template_rate, unknown_terms,
)

ROOT = Path(__file__).resolve().parents[2]


def _q(rank, card, text="질문입니다 질문입니다", source="ai"):
    return {"rank": rank, "card_id": card, "text": text, "source": source}


def _row(no="P1", persona="A", first=None, final=None, first_ms=1000, final_ms=2000, experience=""):
    return {
        "wantedAuthNo": no, "persona": persona,
        "first": {"mode": "first", "questions": first or []},
        "first_input": {"mode": "first", "posting": {}, "experience": experience, "items": []},
        "final": {"mode": "final", "final_questions": final or []},
        "final_input": None, "first_ms": first_ms, "final_ms": final_ms,
    }


class RouterLlm:
    """시스템 글로 판정 종류를 가려 정해진 답을 낸다."""

    def __init__(self, answers):
        self.answers = answers
        self.calls = []

    async def complete_json(self, role, system, user, timeout_s):
        self.calls.append({"role": role, "system": system, "user": user})
        key = next(k for k, v in SYSTEMS.items() if v == system)
        a = self.answers[key]
        return LlmResult(data=a() if callable(a) else a, model="fake")


def test_question_id():
    assert question_id(_row("P1", "B"), "first", 3) == "P1:B:first:3"


def test_template_rate():
    qs = [_q(i, f"BE{i}", source="template" if i < 2 else "ai") for i in range(10)]
    assert template_rate([_row(first=qs)], "first") == 0.2
    f = [{"rank": 1, "source": "template"}, {"rank": 2, "source": "ai"}]
    assert template_rate([_row(final=f)], "final") == 0.5


def test_latency_p95():
    rows = [_row(first_ms=ms) for ms in range(1000, 21000, 1000)]  # 1..20초
    assert latency_p95(rows, "first") == 19.0
    assert latency_p95([], "first") == 0.0
    assert latency_p95([_row(final_ms=1500)], "final") == 1.5


def test_similarity_identical():
    a = _row("P1", "A", first=[_q(1, "BE01", "같은 질문 글입니다")])
    b = _row("P1", "B", first=[_q(1, "BE01", "같은 질문 글입니다")])
    assert similarity_ab([a, b]) == 1.0


def test_similarity_pairs_only_ai_same_card():
    a = _row("P1", "A", first=[_q(1, "BE01", "가나다라마바사", "template"), _q(2, "BE02")])
    b = _row("P1", "B", first=[_q(1, "BE01", "가나다라마바사"), _q(2, "BE03")])
    assert similarity_ab([a, b]) is None
    assert similarity_ab([a]) is None


def test_unknown_terms():
    postings = {"P1": {"jobCont": "Java 서버 개발", "wantedTitle": "백엔드"}}
    rows = [_row("P1", "B", first=[_q(1, "BE01", "Kafka 경험이 있으신가요? 궁금합니다")])]
    personas = {"A": {"skills": ["Python"]}, "B": {"skills": ["Java"]}}
    r = unknown_terms(rows, postings, personas)
    assert r["rate"] == 1.0 and r["by_term"] == {"kafka": 1}
    personas["B"] = {"skills": ["Java", "Kafka"]}
    assert unknown_terms(rows, postings, personas)["rate"] == 0
    # 스프링/Spring 표기 차이는 같은 낱말
    postings = {"P1": {"jobCont": "스프링 서버"}}
    rows = [_row("P1", "A", first=[_q(1, "BE01", "Spring 쪽 업무가 많은가요? 궁금합니다")])]
    assert unknown_terms(rows, postings, personas)["rate"] == 0


def test_judgement_metrics():
    rows = [
        {"expected": "confirmed", "got": "confirmed"},
        {"expected": "mismatch", "got": "still_unknown"},
        {"expected": "mismatch", "got": None},
    ]
    m = judgement_metrics(rows)
    assert m["accuracy"] == 0.5
    assert m["dropped_rate"] == 1 / 3
    assert m["confusion"] == {"confirmed": {"confirmed": 1}, "mismatch": {"still_unknown": 1}}


def test_failed_judges_excluded():
    judged = [{"inflated": v} for v in (True, None, False)]
    r = rates(judged)["inflation"]
    assert r == {"rate": 0.5, "n": 2, "failed": 1}


def test_not_applicable_is_not_failed():
    judged = [{"inflated": None, "na": ["inflated"]}, {"inflated": None}]
    r = rates(judged)["inflation"]
    assert r["n"] == 0 and r["failed"] == 1 and r["rate"] is None


POSTINGS = {n: {"wantedAuthNo": n, "corpNm": f"(주){n}", "busiCont": "b", "wantedTitle": "t", "jobCont": "j"}
            for n in ("P1", "P2", "P3")}
PERSONAS = {"A": {"skills": ["Python"]}, "B": {"skills": ["Java"]}}
ANALYSES = {"P1": {"cards": [{"card_id": "BE01", "state": "explicit"}]}}
LABELS = {"BE01": "신규 API 개발", "BE02": "온콜 대응"}


async def test_presupposes_only_absent():
    llm = RouterLlm({
        "guess_posting": {"choice": 1}, "guess_persona": {"choice": 1},
        "presupposes": {"presupposes": True}, "inflates": {"inflated": False, "facts": []},
    })
    row = _row("P1", "A", first=[_q(1, "BE01"), _q(2, "BE02")])
    out = await judge_rows(llm, [row], POSTINGS, ANALYSES, PERSONAS, 7, card_labels=LABELS)
    calls = [c for c in llm.calls if c["system"] == SYSTEMS["presupposes"]]
    assert len(calls) == 1
    assert "온콜 대응" in calls[0]["user"]
    by_id = {j["id"]: j for j in out}
    assert by_id["P1:A:first:1"]["presupposes"] is None and "presupposes" in by_id["P1:A:first:1"]["na"]
    assert by_id["P1:A:first:2"]["presupposes"] is True
    assert all(c["role"] == "accurate" for c in llm.calls)


async def test_judge_rows_scope_and_inflation():
    llm = RouterLlm({
        "guess_posting": {"choice": 1}, "guess_persona": {"choice": 1},
        "presupposes": {"presupposes": False}, "inflates": {"inflated": True, "facts": ["x"]},
    })
    claim = "제가 서버를 운영해 본 경험이 있는데 어떤 점이 궁금하세요?"
    row = _row("P1", "A", experience="FastAPI 경험", first=[_q(1, "BE01", claim), _q(2, "BE01", "템플릿 문장입니다", "template")],
               final=[{"rank": 1, "card_id": "BE01", "text": "최종 질문입니다 그렇습니다", "source": "ai"}])
    out = await judge_rows(llm, [row], POSTINGS, ANALYSES, PERSONAS, 7, card_labels=LABELS)
    by_id = {j["id"]: j for j in out}
    f1, f2, fin = by_id["P1:A:first:1"], by_id["P1:A:first:2"], by_id["P1:A:final:1"]
    assert f1["kind"] == "first" and fin["kind"] == "final"
    assert f1["inflated"] is True and f2["inflated"] is None
    assert f2["posting_ok"] is None and f2["persona_ok"] is None  # template 질문은 AI 판정 대상이 아님
    assert fin["persona_ok"] is None and isinstance(fin["posting_ok"], bool)
    inflate_calls = [c for c in llm.calls if c["system"] == SYSTEMS["inflates"]]
    assert len(inflate_calls) == 1
    assert "FastAPI 경험" in inflate_calls[0]["user"] and "Python" in inflate_calls[0]["user"]


async def test_failed_judge_answers_become_none():
    llm = RouterLlm({
        "guess_posting": {"choice": 99}, "guess_persona": {"choice": 99},
        "presupposes": {}, "inflates": {},
    })
    out = await judge_rows(llm, [_row("P1", "A", first=[_q(1, "BE02")])], POSTINGS, ANALYSES, PERSONAS, 7, card_labels=LABELS)
    j = out[0]
    assert j["posting_ok"] is None and j["persona_ok"] is None and j["presupposes"] is None
    assert "posting_ok" not in j["na"] and "presupposes" not in j["na"]
    r = rates(out)
    assert r["posting_guess"]["failed"] == 1 and r["posting_guess"]["n"] == 0


def test_personas_files_use_allow_list_only():
    allowed = {"career", "skills", "projects", "trainings", "certificates"}
    for name in ("A", "B"):
        p = json.loads((ROOT / "evals" / "personas" / f"{name}.json").read_text(encoding="utf-8"))
        assert set(p) == allowed
        assert all(set(x) == {"name", "stack", "summary"} for x in p["projects"])
        assert all(set(x) == {"name", "summary"} for x in p["trainings"])
        assert all(isinstance(c, str) for c in p["certificates"])
        text = json.dumps(p, ensure_ascii=False)
        assert "김00" not in text and "010-" not in text and "@" not in text
    b = json.loads((ROOT / "evals" / "personas" / "B.json").read_text(encoding="utf-8"))
    assert len(b["projects"]) == 2 and len(b["trainings"]) == 1 and b["certificates"] == ["SQLD"]
