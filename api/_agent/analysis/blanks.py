"""처우 빈칸 규칙. 같은 공고는 늘 같은 빈칸이 나온다(LLM 없음)."""
import json
import re
from pathlib import Path

from ..schemas import Evidence, OfferBlank

_SPLIT = re.compile(r"[,\n·]")
_SAL_VAGUE = re.compile(r"회사\s*내규|면접\s*(?:후|시)|협의|추후")
_HOURS_JOB = re.compile(r"당직|코어타임|출퇴근|야간|주말")
_HOURS_FIELD = re.compile(r"야간|주말|당직|시차|교대|연장")
_PROB_MONTHS = re.compile(r"수습\s*\d+\s*개월")
_ONSITE = re.compile(r"상주|파견")


def load_blank_templates(root: Path) -> dict:
    return json.loads((root / "data" / "offer-blanks.json").read_text(encoding="utf-8"))


def _text(posting: dict, field: str) -> str:
    v = posting.get(field)
    return v if isinstance(v, str) else ""


def _segment(text: str, pattern: re.Pattern) -> str | None:
    # 맞은 낱말이 든 조각. 조각은 원문 부분 문자열이라 인용이 글자 그대로다.
    for seg in _SPLIT.split(text):
        seg = seg.strip()
        if seg and pattern.search(seg):
            return seg
    return None


def _make(tpl: dict, field: str | None = None, quote: str | None = None) -> OfferBlank:
    def fill(s: str) -> str:
        return s.replace("{quote}", quote or "")

    return OfferBlank(
        topic=tpl["topic"],
        status=tpl["status"],
        label=fill(tpl["label"]),
        basis=fill(tpl["basis"]),
        question=fill(tpl["question"]),
        evidence=Evidence(field=field, quote=quote) if field and quote else None,
    )


def find_blanks(posting: dict, templates: dict) -> list[OfferBlank]:
    def tpl(topic: str, key: str, status: str) -> dict:
        return {**templates[topic][key], "topic": topic, "status": status}

    out: list[OfferBlank] = []

    sal = _text(posting, "sal").strip()
    if not sal:
        out.append(_make(tpl("sal", "missing", "missing")))
    elif (seg := _segment(sal, _SAL_VAGUE)) is not None:
        out.append(_make(tpl("sal", "vague", "vague"), "sal", seg))
    elif re.search(r"\d", sal):
        # 금액의 천 단위 쉼표(3,200)가 조각 나누기에 잘리므로 값 전체를 인용한다.
        out.append(_make(tpl("sal", "check", "check"), "sal", sal))

    hours = _text(posting, "workdayWorkhrCont")
    if not hours.strip():
        job = _text(posting, "jobCont")
        seg = _segment(job, _HOURS_JOB)
        if seg:
            out.append(_make(tpl("workHours", "check", "check"), "jobCont", seg))
        else:
            out.append(_make(tpl("workHours", "missing", "missing")))
    elif (seg := _segment(hours, _HOURS_FIELD)) is not None:
        out.append(_make(tpl("workHours", "check", "check"), "workdayWorkhrCont", seg))

    probation = None
    for field in ("empTpNm", "jobCont", "etcWelfare"):
        text = _text(posting, field)
        if (seg := _segment(text, _PROB_MONTHS)) is not None:
            probation = _make(tpl("probation", "check", "check"), field, seg)
            break
    if probation is None:
        for field in ("empTpNm", "jobCont", "etcWelfare"):
            if (seg := _segment(_text(posting, field), re.compile("수습"))) is not None:
                probation = _make(tpl("probation", "vague", "vague"), field, seg)
                break
    out.append(probation or _make(tpl("probation", "missing", "missing")))

    for field in ("jobCont", "pfCond", "etcPfCond"):
        text = _text(posting, field)
        m = _ONSITE.search(text)
        if m:
            seg = _segment(text, _ONSITE)
            key = "check_dispatch" if m.group() == "파견" else "check_resident"
            out.append(_make(tpl("onsite", key, "check"), field, seg))
            break

    return out
