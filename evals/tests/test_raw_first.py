from api._agent.llm import FakeLlm, LlmError
from evals.raw_first import raw_violations


def _inp(state="absent"):
    return {
        "mode": "first", "posting": {"jobCont": "서버 개발"}, "experience": "",
        "items": [{
            "rank": 1, "card_id": "BE02", "card_label": "온콜 대응", "pref": "avoid", "state": state, "type": "prevent",
            "template": "t", "template_text": "온콜은 어떻게 하나요?", "has_exp": False,
        }],
    }


async def test_raw_violations():
    llm = FakeLlm([{"questions": [{"card_id": "BE02", "text": "공고에 온콜이 있던데 어떻게 돌아가나요?"}]}])
    r = await raw_violations(llm, [_inp()], set())
    assert r["by_rule"]["absent_presupposition"] == 1
    assert r["rate"] == 1.0 and r["failed"] == 0
    assert llm.calls[0]["role"] == "fast" and llm.calls[0]["timeout_s"] == 18


async def test_raw_clean_and_failed():
    llm = FakeLlm([
        {"questions": [{"card_id": "BE02", "text": "온콜은 보통 어떤 방식으로 돌아가나요?"}]},
        LlmError("timeout"),
        {"unexpected": 1},
    ])
    r = await raw_violations(llm, [_inp(), _inp(), _inp()], set())
    assert r["rate"] == 0.0 and r["by_rule"] == {} and r["failed"] == 2


async def test_raw_all_failed_is_none():
    llm = FakeLlm([LlmError("timeout"), LlmError("timeout")])
    r = await raw_violations(llm, [_inp(), _inp()], set())
    assert r["rate"] is None and r["failed"] == 2 and r["n"] == 0
