import json
from pathlib import Path

from _agent.cards.checks import check_card_draft

ROOT = Path(__file__).resolve().parents[3]
CODES = {"2001020211", "2001020210", "OTHER"}


def draft():
    be01 = json.loads((ROOT / "data/cards.backend.json").read_text(encoding="utf-8"))["cards"][0]
    return {
        "label": be01["label"],
        "plain": be01["plain"],
        "examples": list(be01["examples"]),
        "units": ["2001020211", "2001020210"],
        "posting_signals": be01["posting_signals"],
        "questions": dict(be01["questions"]),
        "example_question": be01["example_question"],
        "interpretation": dict(be01["interpretation"]),
    }


def check(card, cand=CODES, used=None):
    return check_card_draft(card, cand, used if used is not None else set())


def test_clean_card_passes():
    assert check(draft()) == []


def test_unit_not_in_candidates():
    c = draft()
    c["units"] = ["2001020211", "ZZZ"]
    assert check(c) == ["unit_not_in_candidates"]


def test_unit_reused_across_cards():
    used = {"2001020211"}
    assert check(draft(), used=used) == ["unit_reused"]
    assert used == {"2001020211"}


def test_missing_question_type():
    c = draft()
    del c["questions"]["explore"]
    assert check(c) == ["missing_question_type"]


def test_question_mentions_posting():
    c = draft()
    c["questions"]["depth"] = "이 공고에서 신입이 새 API를 어디까지 맡나요? 궁금합니다."
    assert check(c) == ["question_mentions_posting"]
    c = draft()
    c["example_question"] = "이 공고의 새 API 개발은 어디까지 맡게 되나요?"
    assert check(c) == ["question_mentions_posting"]


def test_anchor_not_counted_in_length():
    c = draft()
    c["questions"]["conflict"] = "{anchor}" + "가" * 5  # 앵커를 빼면 5자
    assert check(c) == ["question_length"]
    c["questions"]["conflict"] = "{anchor}" + "가" * 10
    assert check(c) == []
    c["questions"]["conflict"] = "가" * 261
    assert check(c) == ["question_length"]


def test_forbidden_word():
    c = draft()
    c["interpretation"]["good_if"] = "면접관이 나이를 먼저 물어봐요"
    assert check(c) == ["forbidden_word"]


def test_examples_must_be_two():
    c = draft()
    c["examples"] = ["하나만"]
    assert check(c) == ["shape"]
    c = draft()
    c["label"] = "가" * 21
    assert check(c) == ["shape"]


def test_malformed_drafts_do_not_raise():
    for key, bad in [
        ("examples", None),
        ("examples", "문자열"),
        ("examples", [1, 2]),
        ("posting_signals", "x"),
        ("posting_signals", {"explicit": None, "implicit": []}),
        ("posting_signals", {"explicit": [1], "implicit": []}),
        ("interpretation", "x"),
        ("interpretation", None),
        ("label", None),
        ("questions", "x"),
        ("units", None),
    ]:
        c = draft()
        c[key] = bad
        assert "shape" in check(c) or key == "questions", (key, bad)
    assert "missing_question_type" in check({**draft(), "questions": "x"})


def test_non_dict_card():
    assert check("카드") == ["shape", "missing_question_type"]
    assert check(None)[0] == "shape"
