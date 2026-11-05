import json
import re
from pathlib import Path

import pytest

from _agent.checks import check_ending, check_final, check_first, check_judgement, load_card_labels

ROOT = Path(__file__).resolve().parents[3]
CASES = json.loads((ROOT / "shared/fixtures/validate-cases.json").read_text(encoding="utf-8"))["cases"]
POSTINGS = {p["wantedAuthNo"]: p for p in json.loads((ROOT / "data/postings.json").read_text(encoding="utf-8"))}
LABELS = load_card_labels(ROOT)


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_fixture(case):
    kind = case.get("kind", "first")
    if kind == "judgement":
        # 근거의 공백 줄이기는 check_judgement 안에서 한다
        assert check_judgement(case["basis"], case["state"], case["heard"], case.get("clarity")) == case["expect"]
        return
    # TS 시험·generate.ts 와 같이 공백을 한 칸으로 줄인 뒤 검사한다
    text = re.sub(r"\s+", " ", case["text"]).strip()
    posting = {**POSTINGS[case["posting"]], **case.get("posting_patch", {})}
    if kind == "final":
        assert check_final(text, case["state"], posting, LABELS) == case["expect"]
    else:
        assert check_first(
            text, case["state"], case["has_exp"], posting, LABELS,
            resume_text=case.get("resume_text", ""), can_cite_resume=case.get("can_cite_resume", False),
        ) == case["expect"]


def test_card_labels_loaded():
    assert "고객사 상주 개발" in LABELS


def test_unknown_term_goes_last_and_resume_allows():
    posting = POSTINGS["K-MOCK-0001"]
    text = "제가 Kafka를 해 봤는데, 이 팀에서는 신입도 맡나요?"
    assert check_first(text, "explicit", False, posting, LABELS) == ["experience_claim", "unknown_term"]
    assert check_first(text, "explicit", True, posting, LABELS, resume_text="Kafka 프로젝트") == []


@pytest.mark.parametrize(
    "text,expect",
    [
        # 운영에서 나온 문장(11-04, 예시 A × (주)OO소프트 BE01 깊이 확인)
        ("직업훈련 팀 프로젝트에서 FastAPI로 API를 설계부터 배포까지 맡아 본 경험이 있는데, 신입이 새 API를 설계부터 배포까지 맡는지, 정해진 스펙을 구현하는 역할인지 궁금한가요?", ["feeling_question"]),
        ("입사 후 어떤 교육을 받게 되는지 궁금하신가요?", ["feeling_question"]),
        ("신입에게 어떤 역할을 맡기실지 알고 싶으신가요?", ["feeling_question"]),
        ("신입이 설계까지 맡는지, 정해진 명세에 따른 구현을 주로 맡는지 궁금합니다. 어느 쪽인가요?", ["ask_twice"]),
        ("신입이 맡는 일이 어떤 조건에서 달라지는지 궁금한데요, 맡는 범위가 어떻게 되나요?", ["ask_twice"]),
        # 구직자 B × K-MOCK-0005 최종 BE11(11-05 실제 AI): 뒤 물음이 18자
        ("테스트 코드 작성과 코드 리뷰는 팀에서 어떤 방식으로 진행하는지 궁금합니다. 팀의 진행 방식은 어떻게 되나요?", ["ask_twice"]),
        # 통과해야 하는 것
        ("새 API를 만들 때 신입이 어디까지 맡나요? 설계부터 배포까지인지, 정해진 스펙의 구현까지인지 궁금합니다.", []),
        ("신입이 맡게 될 일 중 걱정되는 부분이 있나요?", []),
        ("신입은 설계부터 배포까지 맡나요, 아니면 정해진 스펙을 구현하는 데 집중하나요?", []),
        ("기타 업무 지원에 어떤 업무가 포함되는지 궁금합니다. 기존 시스템 유지보수와 새 기능 개발의 비중은 대략 어떻게 되나요?", []),
    ],
)
def test_check_ending(text, expect):
    assert check_ending(text) == expect
