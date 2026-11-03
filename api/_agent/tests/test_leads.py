import asyncio
import json
from pathlib import Path

from _agent.graphs.final import FinalAgent
from _agent.leads import LEAD_REPEAT_MAX, lead_key, thin_repeated_leads
from _agent.llm import FakeLlm
from _agent.schemas import FinalRequest

ROOT = Path(__file__).resolve().parents[3]
RAW = json.loads((ROOT / "docs/api-examples/final-questions-request.json").read_text(encoding="utf-8"))

LEAD_A = "공고의 '고객사 상주 가능자'과 관련해 확인하고 싶습니다."
LEAD_B = "공고의 '기타 업무 지원' 부분과 관련해 확인하고 싶습니다."
LEAD_C = "공고의 '담당 모듈 배정'과 관련해 확인하고 싶습니다."


def test_quote_only_difference_is_same_lead():
    # 따옴표 속 인용·붙은 조사·"부분"만 다른 앞말은 같은 앞말(#13 N06 꼴)
    assert lead_key(LEAD_A) == lead_key(LEAD_B) == lead_key(LEAD_C)
    assert lead_key(LEAD_A) != lead_key("지난 면접에 이어 공고의 'A' 부분을 조금 더 구체적으로 여쭙겠습니다.")


def test_third_same_lead_is_cut_in_order():
    texts = [
        ("k1", f"{LEAD_A} 상주 기간은 보통 어느 정도인가요?"),
        ("k2", f"{LEAD_B} 신입도 트래픽 대응에 참여하나요?"),
        ("k3", f"{LEAD_C} 배포는 누가 맡고 있나요?"),
        ("k4", "수습 기간 급여는 어떻게 되나요?"),
        ("k5", f"{LEAD_A} 상주 때 지원 기준이 있나요?"),
    ]
    out = thin_repeated_leads(texts)
    assert LEAD_REPEAT_MAX == 2
    assert out["k1"] == texts[0][1] and out["k2"] == texts[1][1]
    assert out["k3"] == "배포는 누가 맡고 있나요?"
    assert out["k4"] == texts[3][1]
    assert out["k5"] == "상주 때 지원 기준이 있나요?"


def test_keeps_text_when_cut_would_break_it():
    # 앞말 뒤에 질문이 없거나 너무 짧으면 자르지 않는다. 완충 문장("…될까요?")으로 시작한 문항은 앞말로 보지 않는다.
    texts = [
        ("k0", f"{LEAD_B} 신입도 이 업무를 맡게 되나요?"),
        ("k1", f"{LEAD_C} 모듈은 언제쯤 정해지나요?"),
        ("k2", f"{LEAD_A} 상주 기간이 궁금합니다."),
        ("k3", f"{LEAD_A} 짧나요?"),
        ("k4", f"괜찮으시다면 여쭤도 될까요? {LEAD_A} 상주 기간은 어느 정도인가요?"),
    ]
    out = thin_repeated_leads(texts)
    # 같은 앞말이 이미 두 번 나온 뒤라도 자르면 깨지는 문항은 그대로 둔다
    assert out["k2"] == texts[2][1]  # 앞말 뒤에 질문이 없음
    assert out["k3"] == texts[3][1]  # 남는 글이 10자 미만
    assert out["k4"] == texts[4][1]  # 완충 문장으로 시작


def test_final_agent_cuts_third_same_lead(ai_log):
    items = [i for i in RAW["items"] if i["tone"] != "cushion"][:3]
    texts = [f"{lead} 이 업무를 신입도 맡게 되나요?" for lead in (LEAD_A, LEAD_B, LEAD_C)]
    d = {"questions": [{"key": i["key"], "text": i["template_text"]} for i in RAW["items"]]}
    for q in d["questions"]:
        for i, t in zip(items, texts):
            if q["key"] == i["key"]:
                q["text"] = t
    out = asyncio.run(FinalAgent(FakeLlm([d]), set(), clock=lambda: 0.0).run(FinalRequest.model_validate(RAW)))
    got = {q.key: q.text for q in out.questions}
    assert got[items[0]["key"]] == texts[0] and got[items[1]["key"]] == texts[1]
    assert got[items[2]["key"]] == "이 업무를 신입도 맡게 되나요?"
    assert f"[ai] final lead_cut={items[2]['key']}" in ai_log.text
