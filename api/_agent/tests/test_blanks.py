import json
import re
from pathlib import Path

import pytest

from _agent.analysis.blanks import find_blanks, load_blank_templates
from _agent.schemas import OfferBlank

ROOT = Path(__file__).resolve().parents[3]
POSTINGS = json.loads((ROOT / "data" / "postings.json").read_text(encoding="utf-8"))
TEMPLATES = load_blank_templates(ROOT)
ORDER = ["sal", "workHours", "probation", "onsite"]
# 지금 파일이 규칙과 어긋나 xfail 할 공고: {공고번호: 이유}
XFAIL: dict[str, str] = {}


def current(wanted_no: str) -> list[dict]:
    path = ROOT / "data" / "analysis" / f"{wanted_no}.json"
    return json.loads(path.read_text(encoding="utf-8"))["blanks"]


def params():
    for p in POSTINGS:
        no = p["wantedAuthNo"]
        marks = [pytest.mark.xfail(reason=XFAIL[no], strict=True)] if no in XFAIL else []
        yield pytest.param(p, id=no, marks=marks)


PARAMS = list(params())


@pytest.mark.parametrize("posting", PARAMS)
def test_seven_postings_status_match_current(posting):
    got = {(b.topic, b.status) for b in find_blanks(posting, TEMPLATES)}
    want = {(b["topic"], b["status"]) for b in current(posting["wantedAuthNo"])}
    assert got == want


@pytest.mark.parametrize("posting", PARAMS)
def test_quotes_verbatim(posting):
    blanks = find_blanks(posting, TEMPLATES)
    for b in blanks:
        assert isinstance(b, OfferBlank)
        assert "{quote}" not in b.basis + b.question + b.label
        if b.evidence:
            assert b.evidence.quote in str(posting.get(b.evidence.field, ""))
            assert b.evidence.quote == b.evidence.quote.strip() and b.evidence.quote
    topics = [b.topic for b in blanks]
    assert topics == sorted(topics, key=ORDER.index)


def test_blank_posting_all_missing():
    blanks = find_blanks({"wantedAuthNo": "K-X"}, TEMPLATES)
    assert [(b.topic, b.status) for b in blanks] == [
        ("sal", "missing"),
        ("workHours", "missing"),
        ("probation", "missing"),
    ]
    assert all(b.evidence is None for b in blanks)


def test_sal_vague_uses_segment_and_check_uses_whole_value():
    vague = find_blanks({"sal": "경력에 따라, 회사 내규에 따름"}, TEMPLATES)[0]
    assert (vague.status, vague.evidence.quote) == ("vague", "회사 내규에 따름")
    check = find_blanks({"sal": "3,200만 원 ~ 3,800만 원"}, TEMPLATES)[0]
    assert (check.status, check.evidence.quote) == ("check", "3,200만 원 ~ 3,800만 원")


def test_work_hours_filled_without_hint_has_no_blank():
    got = find_blanks({"sal": "", "workdayWorkhrCont": "주 5일 09:00~18:00"}, TEMPLATES)
    assert "workHours" not in [b.topic for b in got]


def test_probation_vague_and_onsite_label():
    p = find_blanks({"empTpNm": "정규직 (수습)", "jobCont": "고객사 파견 근무"}, TEMPLATES)
    by = {b.topic: b for b in p}
    assert by["probation"].status == "vague"
    assert by["onsite"].label == "파견 근무 조건"
    r = find_blanks({"pfCond": "상주 가능자"}, TEMPLATES)
    assert {b.topic: b for b in r}["onsite"].label == "상주 근무 조건"


def test_probation_months_phrasings():
    for text in ("수습기간 3개월", "수습 기간 3개월", "수습(3개월)", "수습 3개월"):
        b = {x.topic: x for x in find_blanks({"empTpNm": f"정규직, {text}"}, TEMPLATES)}
        assert b["probation"].status == "check", text
        assert b["probation"].evidence.quote == text
    assert {x.topic: x for x in find_blanks({"empTpNm": "정규직 (수습)"}, TEMPLATES)}["probation"].status == "vague"
