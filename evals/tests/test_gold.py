import json

import pytest

from evals import gold
from evals.gold import GoldError, read_gold

CARD_HEAD = "wantedAuthNo,card_id,state,field,note,labeler,use"
BLANK_HEAD = "wantedAuthNo,topic,status,field,note,labeler,use"
JUDGE_HEAD = "wantedAuthNo,card_id,question,heard,pref,expected,labeler"
CARDS = {"BE01", "BE02"}


def _sheet(tmp_path, cards=(), blanks=None, judgements=(), nl="\n", bom=False):
    """blanks를 안 주면 E1의 처우 4칸을 정상으로 채운다."""
    if blanks is None:
        blanks = [f"E1,{t},present,sal,,A,Y" for t in gold.TOPICS]
    for name, head, rows in (
        ("cards.csv", CARD_HEAD, cards),
        ("blanks.csv", BLANK_HEAD, blanks),
        ("judgements.csv", JUDGE_HEAD, judgements),
    ):
        text = nl.join([head, *rows]) + nl
        (tmp_path / name).write_text(("﻿" if bom else "") + text, encoding="utf-8", newline="")
    return tmp_path


def _errors(tmp_path, **kw):
    _sheet(tmp_path, **kw)
    with pytest.raises(GoldError) as e:
        read_gold(tmp_path, {"E1"}, CARDS)
    return e.value.messages


def test_reads_excel_csv(tmp_path):
    rows = ["E1,BE01,explicit,jobCont,,A,Y", "E1,BE02,absent,,,A,Y"]
    # 엑셀: BOM + CRLF + 끝 빈 줄 두 개
    _sheet(tmp_path, cards=rows, nl="\r\n", bom=True)
    with (tmp_path / "cards.csv").open("a", encoding="utf-8", newline="") as f:
        f.write("\r\n,,,,,,\r\n")
    g = read_gold(tmp_path, {"E1"}, CARDS)
    assert g.cards[("E1", "BE01")].state == "explicit"
    assert g.cards[("E1", "BE01")].field == "jobCont"
    assert g.cards[("E1", "BE02")].field is None
    assert g.blanks[("E1", "sal")] == "present"
    assert g.overlap == {}


def test_field_required(tmp_path):
    msgs = _errors(tmp_path, cards=["E1,BE01,explicit,,,A,Y", "E1,BE02,absent,,,A,Y"])
    assert any("cards.csv 2행" in m for m in msgs)


def test_field_must_be_evidence_field(tmp_path):
    msgs = _errors(tmp_path, cards=["E1,BE01,vague,title,,A,Y", "E1,BE02,absent,,,A,Y"])
    assert any("cards.csv 2행" in m for m in msgs)


def test_bad_state(tmp_path):
    msgs = _errors(tmp_path, cards=["E1,BE01,maybe,,,A,Y", "E1,BE02,absent,,,A,Y"])
    assert any("cards.csv 2행" in m and "state" in m for m in msgs)


def test_one_use_row(tmp_path):
    two = ["E1,BE01,explicit,jobCont,,A,Y", "E1,BE01,inferred,pfCond,,B,Y", "E1,BE02,absent,,,A,Y"]
    assert any("E1 BE01" in m for m in _errors(tmp_path, cards=two))
    zero = ["E1,BE01,explicit,jobCont,,A,Y"]
    assert any("E1 BE02: 정답 줄 없음" in m for m in _errors(tmp_path, cards=zero))


def test_overlap_collected(tmp_path):
    rows = [
        "E1,BE01,explicit,jobCont,,A,Y",
        "E1,BE01,inferred,pfCond,,B,N",
        "E1,BE02,absent,,,A,Y",
    ]
    _sheet(tmp_path, cards=rows)
    g = read_gold(tmp_path, {"E1"}, CARDS)
    assert g.overlap == {("E1", "BE01"): {"A": "explicit", "B": "inferred"}}
    assert g.cards[("E1", "BE01")].state == "explicit"


def test_unknown_card(tmp_path):
    msgs = _errors(tmp_path, cards=["E1,BE99,absent,,,A,Y", "E1,BE01,absent,,,A,Y", "E1,BE02,absent,,,A,Y"])
    assert any("cards.csv 2행" in m and "BE99" in m for m in msgs)


def test_unknown_posting(tmp_path):
    rows = ["E9,BE01,absent,,,A,Y", "E1,BE01,absent,,,A,Y", "E1,BE02,absent,,,A,Y"]
    assert any("cards.csv 2행" in m and "E9" in m for m in _errors(tmp_path, cards=rows))


def test_errors_are_collected(tmp_path):
    msgs = _errors(tmp_path, cards=["E1,BE99,maybe,,,A,Y"])
    assert len(msgs) >= 3


def test_blanks_one_use_row(tmp_path):
    cards = ["E1,BE01,absent,,,A,Y", "E1,BE02,absent,,,A,Y"]
    blanks = [f"E1,{t},present,sal,,A,Y" for t in gold.TOPICS[:3]]
    assert any("E1 onsite" in m for m in _errors(tmp_path, cards=cards, blanks=blanks))
    bad = [f"E1,{t},unknown,,,A,Y" for t in gold.TOPICS]
    assert any("blanks.csv 2행" in m for m in _errors(tmp_path, cards=cards, blanks=bad))


def test_judgements(tmp_path):
    cards = ["E1,BE01,absent,,,A,Y", "E1,BE02,absent,,,A,Y"]
    ok = ["E1,BE01,연봉이 얼마인가요?,연봉은 면접 때 말씀드려요,none,still_unknown,A"]
    _sheet(tmp_path, cards=cards, judgements=ok)
    g = read_gold(tmp_path, {"E1"}, CARDS)
    assert g.judgements[0].expected == "still_unknown"
    assert g.judgements[0].heard.startswith("연봉은")
    bad = ["E1,BE01,질문,,want,confirmed,A", "E1,BE01,질문,들음,avoid,maybe,A", "E1,BE01,질문,들음,상관없음,confirmed,A"]
    msgs = _errors(tmp_path, cards=cards, judgements=bad)
    assert any("judgements.csv 2행" in m and "heard" in m for m in msgs)
    assert any("judgements.csv 3행" in m and "expected" in m for m in msgs)
    assert any("judgements.csv 4행" in m and "pref" in m for m in msgs)


def test_missing_file(tmp_path):
    _sheet(tmp_path, cards=["E1,BE01,absent,,,A,Y", "E1,BE02,absent,,,A,Y"])
    (tmp_path / "blanks.csv").unlink()
    with pytest.raises(GoldError) as e:
        read_gold(tmp_path, {"E1"}, CARDS)
    assert any("blanks.csv" in m for m in e.value.messages)


def test_missing_column(tmp_path):
    _sheet(tmp_path, cards=["E1,BE01,absent,,,A,Y"])
    (tmp_path / "cards.csv").write_text("wantedAuthNo,card_id,state\nE1,BE01,absent\n", encoding="utf-8")
    with pytest.raises(GoldError) as e:
        read_gold(tmp_path, {"E1"}, CARDS)
    assert any("cards.csv" in m and "field" in m for m in e.value.messages)


def test_cli_writes_gold_json(tmp_path, capsys):
    root = tmp_path
    (root / "postings").mkdir()
    (root / "postings" / "a.json").write_text(
        json.dumps({"wantedAuthNo": "E1", "corpNm": "c", "wantedTitle": "t", "jobCont": "j"}), encoding="utf-8"
    )
    sheet = root / "sheet"
    sheet.mkdir()
    cards = [f"E1,{c},absent,,,A,Y" for c in sorted(gold.card_ids())]
    _sheet(sheet, cards=cards)
    assert gold.main(root) == 0
    out = capsys.readouterr().out
    assert "정답 17칸 · 처우 4칸 · 판정 0줄 · 겹친 공고 0건" in out
    data = json.loads((root / "gold.json").read_text(encoding="utf-8"))
    assert len(data["cards"]) == 17


def test_cli_exit_1_on_errors(tmp_path, capsys):
    (tmp_path / "postings").mkdir()
    (tmp_path / "postings" / "a.json").write_text(
        json.dumps({"wantedAuthNo": "E1", "corpNm": "c", "wantedTitle": "t", "jobCont": "j"}), encoding="utf-8"
    )
    (tmp_path / "sheet").mkdir()
    _sheet(tmp_path / "sheet", cards=["E1,BE01,explicit,,,A,Y"])
    assert gold.main(tmp_path) == 1
    assert "cards.csv 2행" in capsys.readouterr().out


def test_load_gold_json_roundtrip(tmp_path):
    g = gold.Gold(
        cards={("E1", "BE01"): gold.GoldCard("explicit", "jobCont"), ("E1", "BE02"): gold.GoldCard("absent", None)},
        blanks={("E1", "sal"): "missing"},
        overlap={("E1", "BE01"): {"A": "explicit", "B": "vague"}},
        judgements=[gold.GoldJudgement("E1", "BE01", "q", "h", "p", "confirmed")],
    )
    path = tmp_path / "gold.json"
    path.write_text(json.dumps(gold._dump(g), ensure_ascii=False), encoding="utf-8")
    assert gold.load_gold_json(path) == g
