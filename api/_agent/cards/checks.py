from ..checks import FORBIDDEN

QTYPES = ("conflict", "opportunity", "depth", "explore")
_ANCHOR = "{anchor}"


def _is_str_list(v) -> bool:
    return isinstance(v, list) and all(isinstance(x, str) for x in v)


def _shape_ok(card: dict) -> bool:
    label, plain = card.get("label"), card.get("plain")
    if not (isinstance(label, str) and 1 <= len(label) <= 20):
        return False
    if not (isinstance(plain, str) and 1 <= len(plain) <= 60):
        return False
    ex = card.get("examples")
    if not (_is_str_list(ex) and len(ex) == 2):
        return False
    sig = card.get("posting_signals")
    if not (isinstance(sig, dict) and _is_str_list(sig.get("explicit")) and _is_str_list(sig.get("implicit"))):
        return False
    interp = card.get("interpretation")
    keys = ("mismatch_if_want", "mismatch_if_avoid", "good_if")
    if not (isinstance(interp, dict) and all(isinstance(interp.get(k), str) and interp[k] for k in keys)):
        return False
    units = card.get("units")
    return _is_str_list(units) and len(units) > 0


def _question_texts(card: dict) -> list[str]:
    qs = card.get("questions")
    out = [v for v in qs.values() if isinstance(v, str)] if isinstance(qs, dict) else []
    eq = card.get("example_question")
    if isinstance(eq, str):
        out.append(eq)
    return out


def _strs(v) -> list[str]:
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def _all_texts(card: dict) -> list[str]:
    out = [x for x in (card.get("label"), card.get("plain")) if isinstance(x, str)]
    out += _strs(card.get("examples"))
    sig = card.get("posting_signals")
    if isinstance(sig, dict):
        out += _strs(sig.get("explicit")) + _strs(sig.get("implicit"))
    out += _question_texts(card)
    interp = card.get("interpretation")
    if isinstance(interp, dict):
        out += [v for v in interp.values() if isinstance(v, str)]
    return out


def check_card_draft(card: dict, candidate_codes: set[str], used_codes: set[str]) -> list[str]:
    issues: list[str] = []
    if not isinstance(card, dict):
        card = {}  # 모양이 아닌 초안도 예외 없이 shape로 낸다
    if not _shape_ok(card):
        issues.append("shape")
    units = card.get("units") if _is_str_list(card.get("units")) else []
    if any(c not in candidate_codes for c in units):
        issues.append("unit_not_in_candidates")
    if any(c in used_codes for c in units):
        issues.append("unit_reused")
    qs = card.get("questions")
    if not isinstance(qs, dict) or any(not (isinstance(qs.get(t), str) and qs[t].strip()) for t in QTYPES):
        issues.append("missing_question_type")
    texts = _question_texts(card)
    if any("공고" in t for t in texts):
        issues.append("question_mentions_posting")
    if any(not 10 <= len(t.replace(_ANCHOR, "")) <= 260 for t in texts):
        issues.append("question_length")
    if any(p.search(t) for t in _all_texts(card) for p in FORBIDDEN):
        issues.append("forbidden_word")
    return issues
