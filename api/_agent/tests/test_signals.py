import json
from pathlib import Path

from _agent.checks import check_signal_ask
from _agent.company.data import CompanyData, company_data_from_files
from _agent.company.nps import PensionFacts
from _agent.company.resolve import CompanyRef
from _agent.company.signals import build_signal_facts

ROOT = Path(__file__).resolve().parents[3]
BANDS = [
    {"min": 1, "max": 4, "label": "1~4인"},
    {"min": 5, "max": 29, "label": "5~29인"},
    {"min": 30, "max": 99, "label": "30~99인"},
]
POSTING = {"wantedAuthNo": "K-X", "totPsncnt": "28", "regionCd": "11000"}


def kinds(facts):
    return [f.kind for f in facts]


def pf(members=45, gain=6, loss=11, ind2="58"):
    return PensionFacts(members, gain, loss, 12, "2025년 10월~2026년 9월", ind2)


def eis(rows):
    return {"rows": rows, "size_bands": BANDS}


def row(sido="11", insured=5000, rate=0.021, net=-3):
    return {"ind2": "58", "size": "5~29인", "sido": sido, "loss_rate": rate, "net": net, "insured": insured}


def test_reposting_rule():
    def on(count, months):
        d = CompanyData(reposting={"count": count, "months": months})
        return "reposting" in kinds(build_signal_facts(POSTING, d))

    assert on(3, 6)
    assert not on(2, 3)
    assert not on(3, 7)


def test_pension_rule_small_company_off():
    d = CompanyData(pension=pf(members=9, gain=0, loss=5), pension_source="실제")
    assert build_signal_facts(POSTING, d) == []
    d = CompanyData(pension=pf(members=10, gain=5, loss=5), pension_source="실제")
    assert build_signal_facts(POSTING, d) == []


def test_pension_text_band_and_direction():
    d = CompanyData(pension=pf(members=45, loss=11), pension_source="실제", mapped=True)
    f = build_signal_facts(POSTING, d)[0]
    assert f.kind == "pension_flow" and f.source == "실제"
    assert "45" not in f.text and "11" not in f.text and "퇴사" in f.text
    assert "실제 공공데이터 값을 시연용 가상 회사에 붙여 보여 줘요" in f.caveat
    assert "2025년 10월~2026년 9월" in f.caveat
    assert f.ask_hint and f.template_ask
    d2 = CompanyData(pension=pf(), pension_source="실제", mapped=False)
    assert "붙여 보여" not in build_signal_facts(POSTING, d2)[0].caveat
    d3 = CompanyData(pension=pf(), pension_source="모의")
    assert build_signal_facts(POSTING, d3)[0].source == "모의"


def test_eis_row_found():
    d = CompanyData(pension=pf(members=5), pension_source="실제", eis=eis([row()]), sido="11")
    f = build_signal_facts(POSTING, d)[0]
    assert f.kind == "industry_baseline" and f.source == "실제"
    assert "2.1%" in f.text and "-3" in f.text and "전국 평균" not in f.text


def test_eis_uses_nation_when_small_cell():
    nation = row(sido="전국", insured=90000, rate=0.015, net=7)
    d = CompanyData(pension=pf(members=5), pension_source="실제", eis=eis([row(insured=800), nation]), sido="11")
    f = build_signal_facts(POSTING, d)[0]
    assert "전국 평균" in f.text and "1.5%" in f.text


def test_eis_without_ind2_drops():
    d = CompanyData(eis=eis([row()]), sido="11")
    assert build_signal_facts(POSTING, d) == []
    d = CompanyData(ind2="58", eis=eis([row()]), sido="11")
    assert kinds(build_signal_facts(POSTING, d)) == ["industry_baseline"]


def test_eis_size_outside_bands_drops():
    d = CompanyData(ind2="58", eis=eis([row()]), sido="11")
    assert build_signal_facts({**POSTING, "totPsncnt": "500"}, d) == []
    assert build_signal_facts({**POSTING, "totPsncnt": "abc"}, d) == []


def test_small_giant_has_no_ask():
    d = CompanyData(giants=[{"name": "A", "year": 2025}, {"name": "B", "year": 2024}], giants_source="모의")
    fs = build_signal_facts(POSTING, d)
    assert kinds(fs) == ["small_giant", "small_giant"]
    assert all(f.ask_hint is None and f.template_ask is None and f.source == "모의" for f in fs)
    assert "A" in fs[0].text and "2025" in fs[0].text


def test_wage_arrears_only_when_listed():
    assert build_signal_facts(POSTING, CompanyData(wage_arrears={"listed": False})) == []
    f = build_signal_facts(POSTING, CompanyData(wage_arrears={"listed": True}))[0]
    assert f.kind == "wage_arrears" and f.source == "모의" and "올라 있어요" in f.text


def test_order():
    d = CompanyData(
        reposting={"count": 3, "months": 6}, pension=pf(), pension_source="모의", ind2="58",
        eis=eis([row()]), sido="11", giants=[{"name": "A", "year": 2025}], giants_source="모의",
        wage_arrears={"listed": True},
    )
    assert kinds(build_signal_facts(POSTING, d)) == [
        "reposting", "pension_flow", "industry_baseline", "small_giant", "wage_arrears"]


def test_ask_with_digit_falls_back_to_template():
    issues = check_signal_ask("최근 12개월에 퇴사가 많던데요?")
    assert "has_number" in issues and "forbidden_word" in issues
    assert check_signal_ask("") == ["empty"]
    assert check_signal_ask("짧아요?") == ["too_short"]
    assert "too_long" in check_signal_ask("가" * 261)
    assert check_signal_ask("이번 채용은 새로 생긴 자리인가요, 기존 인원을 채우는 자리인가요?") == []


def test_demo_reproduces_current_mock_meaning():
    postings = json.loads((ROOT / "data/postings.json").read_text(encoding="utf-8"))
    posting = next(p for p in postings if p["wantedAuthNo"] == "K-MOCK-0001") if isinstance(postings, list) \
        else postings["K-MOCK-0001"]
    ref = CompanyRef("K-MOCK-0001", "demo")
    d = company_data_from_files(ref, posting, ROOT)
    assert d.pension_source == "모의" and d.pension.ind2 == "58"
    ks = kinds(build_signal_facts(posting, d))
    assert "reposting" in ks and "pension_flow" in ks


def test_files_missing_or_malformed(tmp_path):
    (tmp_path / "data/company").mkdir(parents=True)
    (tmp_path / "data/company/demo.json").write_text("{bad", encoding="utf-8")
    (tmp_path / "data/company/eis.json").write_text("[]", encoding="utf-8")
    d = company_data_from_files(CompanyRef("K-MOCK-0001", "demo"), POSTING, tmp_path)
    assert build_signal_facts(POSTING, d) == []
    d = company_data_from_files(CompanyRef("K-MOCK-0001", "demo"), POSTING, tmp_path / "nowhere")
    assert build_signal_facts(POSTING, d) == []


def test_mapped_giants_from_small_giants_file(tmp_path):
    (tmp_path / "data/company").mkdir(parents=True)
    (tmp_path / "data/company/demo.json").write_text(
        json.dumps({"K-A": {"ind2": "58", "small_giant": [{"name": "D", "year": 2020}]}}), encoding="utf-8")
    (tmp_path / "data/company/small-giants.demo.json").write_text(
        json.dumps({"K-A": [{"name": "R", "year": 2024}]}), encoding="utf-8")
    ref = CompanyRef("K-A", "mapped", "(주)테스트실제", "000-00-00000")
    d = company_data_from_files(ref, POSTING, tmp_path)
    assert d.giants == [{"name": "R", "year": 2024}] and d.giants_source == "실제"
    f = build_signal_facts(POSTING, d)[0]
    assert f.caveat.endswith("실제 공공데이터 값을 시연용 가상 회사에 붙여 보여 줘요")
    d = company_data_from_files(CompanyRef("K-A", "demo"), POSTING, tmp_path)
    assert d.giants == [{"name": "D", "year": 2020}] and d.giants_source == "모의"


def test_sido_and_eis_loaded(tmp_path):
    (tmp_path / "data/company").mkdir(parents=True)
    (tmp_path / "data/company/eis.json").write_text(
        json.dumps({"meta": {"size_bands": BANDS}, "rows": [row()]}), encoding="utf-8")
    d = company_data_from_files(CompanyRef("K-Z", "biz_no", None, "0000000000"), {**POSTING, "regionCd": "36110"}, tmp_path)
    assert d.sido == "36" and d.eis["size_bands"] == BANDS and len(d.eis["rows"]) == 1
    for region in ("00000", "", None, "ab123"):
        assert company_data_from_files(CompanyRef("K-Z", "biz_no", None, "0000000000"), {**POSTING, "regionCd": region}, tmp_path).sido is None


def test_signal_ask_without_question_mark_is_rejected():
    assert check_signal_ask("신입이 적응하는 동안 어떤 도움을 받을 수 있나요") == ["no_question_mark"]


def test_ask_hints_have_no_digits():
    import re
    from _agent.company.signals import _templates

    for kind, t in _templates().items():
        if kind != "meta" and t.get("ask_hint"):
            assert not re.search(r"\d", t["ask_hint"]), kind


def test_eis_row_with_non_numeric_value_is_unusable_only_that_signal_drops():
    d = CompanyData(ind2="58", eis=eis([row(rate=None)]), sido="11")
    assert "industry_baseline" not in kinds(build_signal_facts(POSTING, d))
    d2 = CompanyData(ind2="58", eis=eis([row(rate=None), row(sido="전국", rate=0.03, net=-2)]), sido="11",
                     reposting={"count": 3, "months": 6})
    got = build_signal_facts(POSTING, d2)
    assert kinds(got) == ["reposting", "industry_baseline"] and "전국 평균" in got[1].text
