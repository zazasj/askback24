import pytest
import asyncio
import copy
import json
from pathlib import Path

from fastapi.testclient import TestClient

from _agent.app import create_app
from _agent.graphs.final import FinalAgent
from _agent.llm import FakeLlm, LlmError
from _agent.prompts.final import SYSTEM, user_message
from _agent.schemas import FinalRequest

ROOT = Path(__file__).resolve().parents[3]
RAW = json.loads((ROOT / "docs/api-examples/final-questions-request.json").read_text(encoding="utf-8"))
URL = "/api/ai/v1/final-questions"
KEYS = [i["key"] for i in RAW["items"]]


def good(keys=None) -> dict:
    return {"questions": [{"key": i["key"], "text": i["template_text"]} for i in RAW["items"] if keys is None or i["key"] in keys]}


def with_text(key: str, text: str) -> dict:
    d = good()
    for q in d["questions"]:
        if q["key"] == key:
            q["text"] = text
    return d


def post(llm, raw=RAW):
    return TestClient(create_app({}, llm=llm)).post(URL, json=raw)


def test_final_returns_in_request_order():
    d = good()
    d["questions"].reverse()
    llm = FakeLlm([d])
    r = post(llm)
    assert r.status_code == 200
    body = r.json()
    assert [q["key"] for q in body["questions"]] == KEYS
    assert body["model"] == "fake"
    assert len(llm.calls) == 1 and llm.calls[0]["role"] == "fast"


def test_final_pairs_by_key_with_offer_items():
    qs = [q for q in good()["questions"] if q["key"] != "offer:sal"]
    qs.insert(1, {"key": "BE15", "text": "두 번째 BE15 문장은 버려져야 합니다."})
    qs.append({"key": "offer:onsite", "text": "요청에 없는 키의 문장입니다. 버립니다."})
    llm = FakeLlm([{"questions": qs}, good(["offer:sal"])])
    r = post(llm)
    assert len(llm.calls) == 2
    assert '"offer:sal"' in llm.calls[1]["user"] and '"BE15"' not in llm.calls[1]["user"]
    assert [q["key"] for q in r.json()["questions"]] == KEYS


def test_final_rewrites_missing_cushion():
    no_cushion = "지난 면접에 이어 공고의 '고객사 상주 가능자' 부분을 조금 더 구체적으로 여쭙겠습니다. 첫해 상주 기간은 어느 정도인가요?"
    llm = FakeLlm([with_text("BE15", no_cushion), good(["BE15"])])
    r = post(llm)
    assert len(llm.calls) == 2
    u = llm.calls[1]["user"]
    assert '"BE15"' in u and '"BE08"' not in u
    assert "완충 문장을 문장 맨 앞에 글자 그대로 두세요" in u
    assert [q["key"] for q in r.json()["questions"]] == KEYS


def test_final_drops_interviewer_quote_after_rewrite():
    bad = "아까 말씀하신 장애 대응 당번은 신입도 들어가나요?"
    llm = FakeLlm([with_text("BE08", bad), with_text("BE08", bad)])
    r = post(llm)
    assert len(llm.calls) == 2
    assert "BE08" not in [q["key"] for q in r.json()["questions"]]
    assert len(r.json()["questions"]) == len(KEYS) - 1


def test_final_unavailable_503(ai_log):
    r = post(FakeLlm([LlmError("timeout")]))
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"
    assert "[ai] final unavailable code=timeout ms=" in ai_log.text


def test_final_no_heard_field_accepted(ai_log):
    secret = "비밀로 들은 답 문장입니다 절대 남으면 안 됨"
    raw = copy.deepcopy(RAW)
    for i in raw["items"]:
        i["heard"] = secret
    llm = FakeLlm([good()])
    r = post(llm, raw)
    assert r.status_code == 200
    assert secret not in r.text and secret not in ai_log.text
    assert secret not in llm.calls[0]["user"] and secret not in llm.calls[0]["system"]
    assert "heard" not in llm.calls[0]["user"]


async def test_final_timeout_is_budget():
    llm = FakeLlm([good()])
    await FinalAgent(llm, set(), clock=lambda: 0.0).run(FinalRequest.model_validate(RAW))
    assert llm.calls[0]["timeout_s"] == 23.0


def test_final_budget_header():
    # 판정을 건너뛰면 TS 가 남은 시간을 다 넘긴다: 그 − 1초를 쓰고, 커도 50초(maxDuration 60 안)까지.
    for header, want in (("35000", 34.0), ("90000", 50.0), ("abc", 23.0), ("500", 0.0)):
        llm = FakeLlm([good()])
        r = TestClient(create_app({}, llm=llm)).post(URL, json=RAW, headers={"x-rq-budget-ms": header})
        if want == 0.0:
            assert r.status_code == 503 and llm.calls == []
        else:
            assert llm.calls[0]["timeout_s"] == pytest.approx(want, abs=0.1)  # 실제 시계라 조금 줄어 있다


NO_CUSHION = "지난 면접에 이어 공고의 '고객사 상주 가능자' 부분을 조금 더 구체적으로 여쭙겠습니다. 첫해 상주 기간은 어느 정도인가요?"


def test_final_rewrites_at_real_latency(ai_log):
    # 한 번에 6초여도 남은 시간(23 − 6 = 17초)이 8초 문턱을 넘어 걸린 문항을 다시 쓴다(D-409, 예전 13초 예산에선 못 했음).
    llm = FakeLlm([with_text("BE15", NO_CUSHION), good(["BE15"])])
    clock = lambda: 6.0 * len(llm.calls)  # noqa: E731
    out = asyncio.run(FinalAgent(llm, set(), clock=clock).run(FinalRequest.model_validate(RAW)))
    assert len(llm.calls) == 2
    assert [q.key for q in out.questions] == KEYS
    assert "retried=1" in ai_log.text


def test_final_no_rewrite_when_little_time_left(ai_log):
    llm = FakeLlm([with_text("BE15", NO_CUSHION), good(["BE15"])])
    clock = lambda: 16.0 * len(llm.calls)  # noqa: E731  23 − 16 = 7초 < 8초
    out = asyncio.run(FinalAgent(llm, set(), clock=clock).run(FinalRequest.model_validate(RAW)))
    assert len(llm.calls) == 1
    assert "BE15" not in [q.key for q in out.questions]
    assert "retried=0" in ai_log.text


def test_final_rewrites_cushion_leak():
    # 완충 문장은 규칙이 cushion 문항에만 붙인다. basic 문항(BE08)에 베끼면 고칠 점을 주고 다시 쓴다.
    leak = "괜찮으시다면 여쭤도 될까요? 장애 대응 당번(온콜)이 있다면 신입도 들어가나요?"
    llm = FakeLlm([with_text("BE08", leak), good(["BE08"])])
    r = post(llm)
    assert len(llm.calls) == 2
    assert "완충 문장은 tone이 cushion인 문항의 맨 앞에만 한 번 쓰세요" in llm.calls[1]["user"]
    assert [q["key"] for q in r.json()["questions"]] == KEYS


def test_final_drops_permission_twice(ai_log):
    twice = "괜찮으시다면 여쭤도 될까요? 첫해에 신입이 상주 프로젝트에 나가는지 여쭤봐도 될까요?"
    llm = FakeLlm([with_text("BE15", twice), with_text("BE15", twice)])
    r = post(llm)
    assert "BE15" not in [q["key"] for q in r.json()["questions"]]
    assert "BE15:permission_twice" in ai_log.text


def test_final_own_cushion_is_not_a_leak():
    # 템플릿 그대로(완충 문장 + 질문)는 통과한다 — 다른 cushion 문항(offer:sal)도 마찬가지.
    llm = FakeLlm([good()])
    r = post(llm)
    assert len(llm.calls) == 1 and [q["key"] for q in r.json()["questions"]] == KEYS


def test_final_logs_shape(ai_log):
    bad = "아까 말씀하신 장애 대응 당번은 신입도 들어가나요?"
    post(FakeLlm([with_text("BE08", bad), with_text("BE08", bad)]))
    keys = ",".join(KEYS)
    assert f"[ai] final n=7 passed=6 retried=1 key={keys} issues=BE08:interviewer_quote ms=" in ai_log.text
    assert "model=fake" in ai_log.text
    assert bad not in ai_log.text


def test_prompt_shape():
    msg = user_message(FinalRequest.model_validate(RAW))
    assert msg.count("<공고>") == 1 and msg.count("</공고>") == 1
    for k in ("key", "label", "type", "origin", "tone", "cushion", "template_text"):
        assert f'"{k}"' in msg
    for w in ("recheck", "signal", "scope", "offer", "opportunity", "asked", "not_asked", "received", "basic", "cushion", "direct", "10자 이상 260자 이하"):
        assert w in SYSTEM
