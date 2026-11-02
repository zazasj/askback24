import json
from pathlib import Path

import pytest

from _agent.terms import terms_in, unknown_in

ROOT = Path(__file__).resolve().parents[3]
DATA = json.loads((ROOT / "shared/fixtures/terms-cases.json").read_text(encoding="utf-8"))
CASES = DATA["cases"]
UNKNOWN = DATA["unknown_cases"]


@pytest.mark.parametrize("case", CASES, ids=[c.get("name") or c["text"] or "(빈 글)" for c in CASES])
def test_fixture(case):
    assert terms_in(case["text"]) == case["expect"]


@pytest.mark.parametrize("case", UNKNOWN, ids=[c["name"] for c in UNKNOWN])
def test_unknown_fixture(case):
    assert unknown_in(case["text"], case["allowed"]) == case["unknown"]
    assert unknown_in(case["text"], case["allowed"], runtime=True) == case["runtime"]
