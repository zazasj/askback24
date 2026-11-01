import json
from pathlib import Path

from _agent.company.bands import member_band
from _agent.company.resolve import CompanyRef, load_company_map, resolve_company

ROOT = Path(__file__).resolve().parents[3]
FAKE_MAP = json.dumps({"K-MOCK-0001": {"name": "(주)테스트실제", "bizNo": "000-00-00000"}})


def test_map_wins_over_biz_no():
    ref = resolve_company({"wantedAuthNo": "K-MOCK-0001", "bizNo": "123-45-67890"}, {"REAL_COMPANY_MAP": FAKE_MAP})
    assert ref.kind == "mapped"
    assert ref.name == "(주)테스트실제"
    assert ref.biz_no == "0000000000"


def test_biz_no_from_posting():
    ref = resolve_company({"wantedAuthNo": "K-MOCK-0002", "bizNo": "123-45-67890"}, {})
    assert ref.kind == "biz_no"
    assert ref.biz_no == "1234567890"
    assert resolve_company({"wantedAuthNo": "K-MOCK-0002", "bizNo": "123-45-6789"}, {}).kind == "demo"


def test_demo_when_nothing():
    ref = resolve_company({"wantedAuthNo": "K-MOCK-0001"}, {})
    assert ref.kind == "demo" and ref.name is None and ref.biz_no is None


def test_map_invalid_json_falls_back_silently(ai_log):
    ref = resolve_company({"wantedAuthNo": "K-MOCK-0001"}, {"REAL_COMPANY_MAP": "{oops"})
    assert ref.kind == "demo"
    assert "oops" not in ai_log.text
    assert "company map invalid" in ai_log.text


def test_map_drops_bad_entries_without_log(ai_log):
    raw = json.dumps({
        "A": {"name": "", "bizNo": "000-00-00000"},
        "B": {"name": "(주)테스트실제", "bizNo": "123"},
        "C": "x",
        "D": {"name": "(주)테스트실제", "bizNo": "000-00-00000"},
    })
    assert load_company_map({"REAL_COMPANY_MAP": raw}) == {"D": ("(주)테스트실제", "0000000000")}
    assert "company map invalid" not in ai_log.text
    assert load_company_map({"REAL_COMPANY_MAP": "[1]"}) == {}
    assert "company map invalid" in ai_log.text


def test_ref_repr_hides_identity():
    ref = CompanyRef("K-MOCK-0001", "mapped", "(주)테스트실제", "0000000000")
    r = repr(ref)
    assert "테스트실제" not in r and "0000000000" not in r
    assert "kind='mapped'" in r


def test_member_band():
    assert member_band(9) == "1~9명"
    assert member_band(10) == "10~29명"
    assert member_band(300) == "300명 이상"
    assert member_band(0) is None


def test_demo_json_covers_seven_postings():
    postings = json.loads((ROOT / "data/postings.json").read_text(encoding="utf-8"))
    demo = json.loads((ROOT / "data/company/demo.json").read_text(encoding="utf-8"))
    assert len(postings) == 7
    for p in postings:
        assert p["wantedAuthNo"] in demo
        assert len(demo[p["wantedAuthNo"]]["ind2"]) == 2


def test_signal_templates_cover_kinds():
    t = json.loads((ROOT / "data/company/signal-templates.json").read_text(encoding="utf-8"))
    for k in ("reposting", "pension_flow", "industry_baseline", "small_giant", "wage_arrears"):
        assert k in t
    assert t["small_giant"]["template_ask"] is None
    assert "실제 공공데이터 값을 시연용 가상 회사에 붙여 보여 줘요" in t["pension_flow"]["caveat_mapped"]
