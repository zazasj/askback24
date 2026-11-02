import json
import re
from pathlib import Path

import pytest

from _agent.checks import check_final, check_first, check_judgement, load_card_labels

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
