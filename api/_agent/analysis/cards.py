"""카드 판정 검사와 독립 두 판정 비교. 근거 대조는 TS quoteInPosting 처럼 글자 그대로 includes 이다."""
from ..checks import FORBIDDEN, squash
from ..schemas import AnalysisCard, Evidence

EVIDENCE_FIELDS = ("jobCont", "pfCond", "etcPfCond", "empTpNm", "salTpNm", "sal", "workdayWorkhrCont", "etcWelfare")
STATES = ("explicit", "inferred", "vague", "absent")
REASON_MAX = 160
ABSENT_REASON = "공고에서 확인하지 못했어요"


def check_card(card: dict, book_ids: set[str], posting: dict) -> list[str]:
    issues: list[str] = []
    if card.get("card_id") not in book_ids:
        issues.append("unknown_card")
    state = card.get("state")
    if state not in STATES:
        issues.append("bad_state")
    ev = card.get("evidence")
    if ev is None:
        if state in ("explicit", "vague"):
            issues.append("evidence_required")
    elif state == "absent":
        issues.append("evidence_on_absent")
    else:
        field, quote = (ev.get("field"), ev.get("quote")) if isinstance(ev, dict) else (None, None)
        if field not in EVIDENCE_FIELDS:
            issues.append("evidence_field")
        else:
            text = posting.get(field)
            if not isinstance(quote, str) or not quote.strip() or not isinstance(text, str) or quote not in text:
                issues.append("evidence_not_in_posting")
    reason = card.get("reason")
    r = squash(reason).strip() if isinstance(reason, str) else ""
    if not r:
        issues.append("reason_empty")
    elif len(r) > REASON_MAX:
        issues.append("reason_too_long")
    if r and any(p.search(r) for p in FORBIDDEN):
        issues.append("forbidden_word")
    return issues


def _build(c: dict, review: bool) -> AnalysisCard:
    ev = c.get("evidence")
    return AnalysisCard(
        card_id=c["card_id"], state=c["state"], reason=squash(c["reason"]).strip(), needs_review=review,
        evidence=Evidence(field=ev["field"], quote=ev["quote"]) if isinstance(ev, dict) and c["state"] != "absent" else None,
    )


def compare(book_ids: list[str], a: dict[str, dict] | None, b: dict[str, dict] | None) -> list[AnalysisCard]:
    """a·b 는 검사를 통과한 카드(card_id → 카드). None 은 그 판정 전체가 LLM 오류."""
    whole_missing = a is None or b is None
    out: list[AnalysisCard] = []
    for cid in book_ids:
        ca, cb = (a or {}).get(cid), (b or {}).get(cid)
        if ca and cb:
            out.append(_build(ca, whole_missing or ca["state"] != cb["state"]))
        elif ca or cb:
            out.append(_build(ca or cb, True))
        else:
            out.append(AnalysisCard(card_id=cid, state="absent", reason=ABSENT_REASON, needs_review=True))
    return out
