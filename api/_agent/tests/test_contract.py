"""TS 가 `npm run api:examples` 로 만든 실제 요청을 그대로 보내, TS 읽기 함수(readDrafts·readJudgements·readFinalDrafts)가
받는 모양으로 돌아오는지 본다. 예시를 다시 만들어도 맞도록 가짜 LLM 응답은 요청에서 만든다."""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from _agent.app import create_app
from _agent.llm import FakeLlm

ROOT = Path(__file__).resolve().parents[3]
BASIS = "답이 모호해 아직 확인되지 않았어요"


def load(name: str) -> dict:
    return json.loads((ROOT / f"docs/api-examples/{name}-request.json").read_text(encoding="utf-8"))


def call(path: str, raw: dict, llm_response: dict):
    llm = FakeLlm([llm_response])
    r = TestClient(create_app({}, llm=llm)).post(f"/api/ai/v1/{path}", json=raw)
    assert r.status_code == 200, r.text
    return r.json(), llm


def is_id(v) -> bool:
    return isinstance(v, str) and v != ""


def test_first_questions_contract():
    raw = load("first")
    resp = {"questions": [{"card_id": i["card_id"], "text": i["template_text"]} for i in raw["items"]]}
    body, _ = call("first-questions", raw, resp)
    assert len(body["questions"]) == len(raw["items"])
    assert [q["card_id"] for q in body["questions"]] == [i["card_id"] for i in raw["items"]]
    for q in body["questions"]:
        assert is_id(q["card_id"]) and isinstance(q["text"], str)


def test_final_judgements_contract():
    raw = load("final-judgements")
    resp = {"judgements": [{"card_id": i["card_id"], "state": "still_unknown", "basis": BASIS} for i in raw["items"]]}
    body, _ = call("final-judgements", raw, resp)
    assert len(body["judgements"]) == len(raw["items"])
    assert [j["card_id"] for j in body["judgements"]] == [i["card_id"] for i in raw["items"]]
    for j in body["judgements"]:
        assert is_id(j["card_id"])
        assert j["state"] in ("confirmed", "mismatch", "still_unknown")
        assert isinstance(j["basis"], str) and j["basis"]


def test_final_questions_contract():
    raw = load("final-questions")
    resp = {"questions": [{"key": i["key"], "text": i["template_text"]} for i in raw["items"]]}
    body, _ = call("final-questions", raw, resp)
    assert len(body["questions"]) == len(raw["items"])
    by_key = {q["key"]: q for q in body["questions"]}
    assert [q["key"] for q in body["questions"]] == [i["key"] for i in raw["items"]]
    for q in body["questions"]:
        assert is_id(q["key"]) and isinstance(q["text"], str)
    for i in raw["items"]:
        if i["tone"] == "cushion":
            assert by_key[i["key"]]["text"].startswith(i["cushion"].strip())
