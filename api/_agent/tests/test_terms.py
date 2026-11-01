import json
from pathlib import Path

import pytest

from _agent.terms import terms_in

ROOT = Path(__file__).resolve().parents[3]
CASES = json.loads((ROOT / "shared/fixtures/terms-cases.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c.get("name") or c["text"] or "(빈 글)" for c in CASES])
def test_fixture(case):
    assert terms_in(case["text"]) == case["expect"]
