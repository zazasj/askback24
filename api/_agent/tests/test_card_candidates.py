from _agent.cards.candidates import HIGH_LEVEL_MIN, build_candidates
from _agent.cards.sources import Unit


def u(code, level=3, name=None):
    return Unit(code, name or f"단위{code}", level, "S1", "응용SW엔지니어링")


def test_one_unit_one_candidate():
    out = build_candidates([u("A"), u("B")], [])
    assert [c.ablt_unit for c in out] == ["A", "B"]
    assert out[0].unit == "단위A" and out[0].subcategory == "응용SW엔지니어링"
    assert not out[0].recommended and out[0].used_in is None


def test_high_level_marked_not_dropped():
    out = build_candidates([u("A", HIGH_LEVEL_MIN), u("B", None), u("C", 3)], [])
    assert [c.high_level for c in out] == [True, False, False]
    assert len(out) == 3


def test_recommended_extra_appended():
    out = build_candidates([u("A"), u("B")], [u("X"), u("A")])
    assert [c.ablt_unit for c in out] == ["A", "B", "X"]
    assert [c.recommended for c in out] == [True, False, True]


def test_dedupe_by_code():
    out = build_candidates([u("A"), u("A"), u("B")], [u("X"), u("X")])
    assert [c.ablt_unit for c in out] == ["A", "B", "X"]
