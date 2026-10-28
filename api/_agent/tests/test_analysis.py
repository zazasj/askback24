import json
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from _agent.analysis.cards import check_card, compare
from _agent.app import create_app
from _agent.llm import LlmError, LlmResult
from _agent.tests.test_nps import fx, make_client

ROOT = Path(__file__).resolve().parents[3]
POSTING = next(p for p in json.loads((ROOT / "data/postings.json").read_text(encoding="utf-8")) if p["wantedAuthNo"] == "K-MOCK-0001")
BOOK = json.loads((ROOT / "data/cards.backend.json").read_text(encoding="utf-8"))["cards"]
IDS = [c["id"] for c in BOOK]
URL = "/api/ai/v1/posting-analysis"
BODY = {"posting": POSTING, "job": "backend"}
REASON = "범위를 확인해 볼 만해요"


def card(cid: str, state="absent", field=None, quote=None, reason=REASON) -> dict:
    c = {"card_id": cid, "state": state, "reason": reason}
    if field:
        c["evidence"] = {"field": field, "quote": quote}
    return c


def run_of(**over) -> dict:
    rows = {i: card(i) for i in IDS}
    rows.update(over)
    return {"cards": list(rows.values()), "out_of_dictionary": []}


class ScriptLlm:
    """프롬프트 표지(독립 판정 a/b · 다시 판정 · fast)로 답을 고른다. 병렬 호출 순서에 기대지 않는다."""

    def __init__(self, a=None, b=None, re_a=None, re_b=None, signal=None, after=None):
        self.script = {"a": a, "b": b, "re_a": re_a, "re_b": re_b, "fast": signal}
        self.after, self.calls = after, []

    async def complete_json(self, role, system, user, timeout_s):
        run = re.search(r"독립 판정 ([ab])", user)
        key = "fast" if role == "fast" else (("re_" if "다시 판정" in user else "") + run.group(1))
        self.calls.append({"key": key, "role": role, "user": user, "timeout_s": timeout_s})
        if self.after:
            self.after(key)
        item = self.script[key]
        if isinstance(item, Exception):
            raise item
        assert item is not None, f"예상 못 한 호출 {key}"
        return LlmResult(data=item, model="fake")

    def keys(self):
        return sorted(c["key"] for c in self.calls)


def ok_signal(text="이번 채용은 새로 생긴 자리인지 궁금합니다. 기존 인원을 채우는 자리인가요?"):
    return {"asks": [{"kind": "reposting", "ask": text}, {"kind": "industry_baseline", "ask": text}]}


def post(llm, env=None, http=None, now=None, body=BODY):
    extra = {"now": now} if now else {}
    app = create_app(env or {}, llm=llm, http=http, **extra)
    return TestClient(app).post(URL, json=body)


def test_returns_every_card_in_book_order():
    good = run_of(BE01=card("BE01", "explicit", "jobCont", "서버 개발"))
    llm = ScriptLlm(a=good, b=good, signal=ok_signal())
    r = post(llm)
    assert r.status_code == 200
    body = r.json()
    assert [c["card_id"] for c in body["analysis"]["cards"]] == IDS
    assert body["analysis"]["wantedAuthNo"] == "K-MOCK-0001"
    assert body["analysis"]["cards"][0]["evidence"] == {"field": "jobCont", "quote": "서버 개발"}
    assert not any(c["needs_review"] for c in body["analysis"]["cards"])
    assert {b["topic"] for b in body["analysis"]["blanks"]} >= {"sal", "workHours", "probation"}
    assert all(c["role"] == "accurate" for c in llm.calls if c["key"] != "fast")
    assert llm.keys() == ["a", "b", "fast"]


def test_evidence_must_be_verbatim_in_field():
    bad = run_of(BE07=card("BE07", "vague", "jobCont", "원문에 없는 문장"))
    fixed = {"cards": [card("BE07", "vague", "jobCont", "기타 업무 지원")], "out_of_dictionary": []}
    good = run_of(BE07=card("BE07", "vague", "jobCont", "기타 업무 지원"))
    llm = ScriptLlm(a=bad, b=good, re_a=fixed, signal=ok_signal())
    body = post(llm).json()
    assert llm.keys() == ["a", "b", "fast", "re_a"]
    re_call = next(c for c in llm.calls if c["key"] == "re_a")
    assert "BE07" in re_call["user"] and "BE01" not in re_call["user"]
    c7 = next(c for c in body["analysis"]["cards"] if c["card_id"] == "BE07")
    assert c7["evidence"]["quote"] == "기타 업무 지원" and not c7["needs_review"]


def test_disagreement_marks_needs_review():
    a = run_of(BE05=card("BE05", "explicit", "jobCont", "서버 개발"))
    b = run_of(BE05=card("BE05", "inferred", "jobCont", "서버 개발"))
    body = post(ScriptLlm(a=a, b=b, signal=ok_signal())).json()
    flags = {c["card_id"]: c["needs_review"] for c in body["analysis"]["cards"]}
    assert flags["BE05"] is True and sum(flags.values()) == 1
    assert next(c for c in body["analysis"]["cards"] if c["card_id"] == "BE05")["state"] == "explicit"


def test_both_runs_fail_card_absent_review():
    bad = run_of(BE07=card("BE07", "vague", "jobCont", "원문에 없는 문장"))
    llm = ScriptLlm(a=bad, b=bad, re_a=bad, re_b=bad, signal=ok_signal())
    c7 = next(c for c in post(llm).json()["analysis"]["cards"] if c["card_id"] == "BE07")
    assert c7["state"] == "absent" and c7["needs_review"] is True
    assert c7["reason"] == "공고에서 확인하지 못했어요" and "evidence" not in c7


def test_one_run_llm_error_marks_all_review():
    llm = ScriptLlm(a=run_of(), b=LlmError("timeout"), signal=ok_signal())
    cards = post(llm).json()["analysis"]["cards"]
    assert len(cards) == len(IDS) and all(c["needs_review"] for c in cards)


def test_both_runs_llm_error_503(ai_log):
    llm = ScriptLlm(a=LlmError("timeout"), b=LlmError("http_status"), signal=ok_signal())
    r = post(llm)
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"
    assert re.search(r"\[ai\] analysis unavailable code=\w+ ms=\d+", ai_log.text)


def test_reclassify_skipped_when_time_short():
    # 판정 호출이 끝나면 시계가 40초 지나 남은 시간이 10초(<15)다.
    t = {"v": 0.0}
    bad = run_of(BE07=card("BE07", "vague", "jobCont", "원문에 없는 문장"))
    llm = ScriptLlm(a=bad, b=bad, signal=ok_signal(), after=lambda k: t.update(v=40.0) if k in ("a", "b") else None)
    app = create_app({}, llm=llm, clock=lambda: t["v"])
    body = TestClient(app).post(URL, json=BODY).json()
    assert llm.keys() == ["a", "b", "fast"]
    assert next(c for c in body["analysis"]["cards"] if c["card_id"] == "BE07")["needs_review"] is True
    fast = next(c for c in llm.calls if c["key"] == "fast")
    assert fast["timeout_s"] <= 10.0


def test_llm_call_timeout_is_capped_at_25():
    llm = ScriptLlm(a=run_of(), b=run_of(), signal=ok_signal())
    post(llm)
    assert all(c["timeout_s"] <= 25.0 for c in llm.calls)


def signal_by_kind(body):
    return {s["kind"]: s for s in body["signals"]}


def test_signal_ask_ai_passes_and_prompt_has_hints_only():
    llm = ScriptLlm(a=run_of(), b=run_of(), signal=ok_signal())
    body = post(llm).json()
    s = signal_by_kind(body)
    assert s["reposting"]["ask_source"] == "ai" and s["reposting"]["ask"].endswith("가요?")
    sent = next(c for c in llm.calls if c["key"] == "fast")["user"]
    assert "ask_hint" in sent and "3번" not in sent and "퇴사" not in sent


def test_signal_ask_rejected_uses_template():
    llm = ScriptLlm(a=run_of(), b=run_of(), signal={"asks": [
        {"kind": "reposting", "ask": "최근 6개월에 3번이나 올라왔는데 무슨 이유인가요?"},
        {"kind": "pension_flow", "ask": "팀원들이 함께 일한 기간은 보통 어느 정도인가요?"},
    ]})
    s = signal_by_kind(post(llm).json())
    assert s["reposting"]["ask_source"] == "template"
    assert s["reposting"]["ask"] == "이번 채용은 새로 생긴 자리인가요, 기존 인원을 채우는 자리인가요?"
    assert s["pension_flow"]["ask_source"] == "ai"


def test_signal_ask_llm_error_uses_template():
    llm = ScriptLlm(a=run_of(), b=run_of(), signal=LlmError("timeout"))
    body = post(llm).json()
    assert body["signals"] and all(s["ask_source"] == "template" for s in body["signals"])


def test_no_ask_needed_skips_signal_llm():
    # 강소기업만 켜지는 공고(K-MOCK-0002): 신호 질문 호출 자체를 하지 않는다.
    p = next(p for p in json.loads((ROOT / "data/postings.json").read_text(encoding="utf-8")) if p["wantedAuthNo"] == "K-MOCK-0002")
    llm = ScriptLlm(a=run_of(), b=run_of())
    body = post(llm, body={"posting": p, "job": "backend"}).json()
    kinds = signal_by_kind(body)
    if set(kinds) == {"small_giant"}:
        assert llm.keys() == ["a", "b"]
        assert "ask" not in kinds["small_giant"]
    else:  # 업종 기준값이 함께 켜지면 그 질문만 부른다
        assert llm.keys() == ["a", "b", "fast"]


def nps_client(loss=2, gain=0):
    def handler(req: httpx.Request):
        op = req.url.path.rsplit("/", 1)[-1]
        if op == "getBassInfoSearchV2":
            return httpx.Response(200, json=fx("basic.json"))
        if op == "getDetailInfoSearchV2":
            return httpx.Response(200, json=fx("detail.json"))
        m = json.loads(json.dumps(fx("monthly.json")))
        item = m["response"]["body"]["items"]["item"]
        for it in item if isinstance(item, list) else [item]:
            it["nwAcqzrCnt"], it["lssJnngpCnt"] = gain, loss
        return httpx.Response(200, json=m)

    return make_client(handler)[0]


REAL_ENV = {
    "REAL_COMPANY_MAP": json.dumps({"K-MOCK-0001": {"name": "(주)테스트실제", "bizNo": "000-00-00000"}}),
    "DATA_GO_KR_KEY": "FAKE-KEY",
}


def test_response_and_log_have_no_real_identity(ai_log):
    llm = ScriptLlm(a=run_of(), b=run_of(), signal=ok_signal())
    r = post(llm, env=REAL_ENV, http=nps_client())
    assert r.status_code == 200
    s = signal_by_kind(r.json())
    assert s["pension_flow"]["source"] == "실제"
    for secret in ("테스트실제", "0000000000", "000-00-00000", "FAKE-KEY"):
        assert secret not in r.text and secret not in ai_log.text
    assert "sources=nps:ok" in ai_log.text
    # 신호 질문 프롬프트에도 이름·번호가 없다
    assert all("테스트실제" not in c["user"] and "0000000000" not in c["user"] for c in llm.calls)


def test_nps_failure_keeps_analysis(ai_log):
    def boom(req):
        raise httpx.ConnectError("down")

    client = httpx.AsyncClient(transport=httpx.MockTransport(boom))
    llm = ScriptLlm(a=run_of(), b=run_of(), signal=ok_signal())
    r = post(llm, env=REAL_ENV, http=client)
    assert r.status_code == 200
    assert "pension_flow" not in signal_by_kind(r.json())  # 실제 회사에는 모의 연금 값을 대신 쓰지 않는다
    assert "sources=nps:none" in ai_log.text


def test_demo_company_uses_file_pension_without_calls(ai_log):
    llm = ScriptLlm(a=run_of(), b=run_of(), signal=ok_signal())
    s = signal_by_kind(post(llm).json())
    assert s["pension_flow"]["source"] == "모의" and "nps:skip" in ai_log.text


def test_unknown_job_400():
    llm = ScriptLlm(a=run_of(), b=run_of())
    for job in ("nojob", "Back", "../x", ""):
        r = post(llm, body={"posting": POSTING, "job": job})
        assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_request"
    assert llm.calls == []


def test_meta_and_log_shape(ai_log):
    fixed = datetime(2026, 10, 28, 9, 0, tzinfo=timezone.utc)
    bad = run_of(BE07=card("BE07", "vague", "jobCont", "원문에 없는 문장"))
    good = run_of(BE07=card("BE07", "vague", "jobCont", "기타 업무 지원"))
    llm = ScriptLlm(a=bad, b=good, re_a=good, signal=ok_signal())
    body = post(llm, now=lambda: fixed).json()
    assert body["meta"] == {"graph_version": "analysis-1", "model": "fake", "created_at": "2026-10-28T09:00:00+00:00"}
    m = re.search(r"\[ai\] analysis job=backend cards=17 needs_review=0 retried=a signals=(\S+) sources=(\S+) ms=\d+ model=fake", ai_log.text)
    assert m, ai_log.text
    assert "reposting" in m.group(1) and "nps:skip" in m.group(2) and "giants:" in m.group(2)
    assert "백엔드" not in ai_log.text and "서버 개발" not in ai_log.text


# --- check_card · compare 단위 ---

def test_check_card_rules():
    ids = set(IDS)

    def chk(**kw):
        return check_card({"card_id": "BE01", "state": "explicit", "reason": REASON,
                           "evidence": {"field": "jobCont", "quote": "서버 개발"}, **kw}, ids, POSTING)

    assert chk() == []
    assert chk(card_id="BE99") == ["unknown_card"]
    assert "bad_state" in chk(state="great")
    assert chk(evidence=None) == ["evidence_required"]
    assert chk(state="absent") == ["evidence_on_absent"]
    assert chk(state="inferred", evidence=None) == []
    assert chk(evidence={"field": "corpNm", "quote": "(주)OO소프트"}) == ["evidence_field"]
    assert chk(evidence={"field": "jobCont", "quote": "없는 문장"}) == ["evidence_not_in_posting"]
    assert chk(reason="  ") == ["reason_empty"]
    assert chk(reason="가" * 161) == ["reason_too_long"]
    assert chk(reason="나이를 물어봐요") == ["forbidden_word"]


def test_compare_rules():
    a = {"X": {"card_id": "X", "state": "explicit", "reason": "r", "evidence": None},
         "Y": {"card_id": "Y", "state": "vague", "reason": "ry"}}
    b = {"X": {"card_id": "X", "state": "explicit", "reason": "r2"}}
    out = {c.card_id: c for c in compare(["X", "Y", "Z"], a, b)}
    assert out["X"].reason == "r" and not out["X"].needs_review
    assert out["Y"].needs_review and out["Y"].state == "vague"
    assert out["Z"].state == "absent" and out["Z"].needs_review and out["Z"].reason == "공고에서 확인하지 못했어요"
    only_b = compare(["X"], None, b)
    assert only_b[0].needs_review and only_b[0].reason == "r2"
