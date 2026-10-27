import json
import re
from pathlib import Path

import pytest

from _agent.checks import check_first, load_card_labels

ROOT = Path(__file__).resolve().parents[3]
CASES = json.loads((ROOT / "shared/fixtures/validate-cases.json").read_text(encoding="utf-8"))["cases"]
POSTINGS = {p["wantedAuthNo"]: p for p in json.loads((ROOT / "data/postings.json").read_text(encoding="utf-8"))}
LABELS = load_card_labels(ROOT)


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_fixture(case):
    # TS 시험·generate.ts 와 같이 공백을 한 칸으로 줄인 뒤 검사한다
    text = re.sub(r"\s+", " ", case["text"]).strip()
    got = check_first(text, case["state"], case["has_exp"], POSTINGS[case["posting"]], LABELS)
    assert got == case["expect"]


def test_card_labels_loaded():
    assert "고객사 상주 개발" in LABELS
