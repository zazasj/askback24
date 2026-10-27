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
        assert check_judgement(case["basis"], case["state"], case["heard"]) == case["expect"]
        return
    # TS 시험·generate.ts 와 같이 공백을 한 칸으로 줄인 뒤 검사한다
    text = re.sub(r"\s+", " ", case["text"]).strip()
    posting = POSTINGS[case["posting"]]
    if kind == "final":
        assert check_final(text, case["state"], posting, LABELS) == case["expect"]
    else:
        assert check_first(text, case["state"], case["has_exp"], posting, LABELS) == case["expect"]


def test_card_labels_loaded():
    assert "고객사 상주 개발" in LABELS
