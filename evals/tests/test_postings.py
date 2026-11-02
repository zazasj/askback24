import json

import pytest

from evals.postings import PostingError, load_postings

REQUIRED = {"wantedAuthNo": "E1", "corpNm": "(주)OO소프트", "wantedTitle": "백엔드", "jobCont": "API 개발"}


def _write(d, name, obj):
    (d / name).write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")


def test_postings_fill_defaults(tmp_path):
    _write(tmp_path, "a.json", REQUIRED)
    got = load_postings(tmp_path)
    assert got["E1"]["sal"] == ""
    assert got["E1"]["draft"] is False
    assert got["E1"]["jobCont"] == "API 개발"


def test_missing_required_raises(tmp_path):
    _write(tmp_path, "a.json", {k: v for k, v in REQUIRED.items() if k != "jobCont"})
    with pytest.raises(PostingError) as e:
        load_postings(tmp_path)
    assert "a.json" in str(e.value)


def test_duplicate_id_raises(tmp_path):
    _write(tmp_path, "a.json", REQUIRED)
    _write(tmp_path, "b.json", REQUIRED)
    with pytest.raises(PostingError) as e:
        load_postings(tmp_path)
    assert "b.json" in str(e.value)


def test_empty_required_raises(tmp_path):
    _write(tmp_path, "a.json", {**REQUIRED, "jobCont": ""})
    with pytest.raises(PostingError):
        load_postings(tmp_path)
