import json
from datetime import datetime

import pytest

from evals.runlog import (
    RunMeta,
    append_jsonl,
    git_commit,
    new_run,
    prompt_hashes,
    read_jsonl,
    write_meta,
    write_metrics,
)


def test_new_run_path(tmp_path):
    run = new_run(tmp_path, "base", datetime(2026, 11, 1, 9, 5), "abcdef1234")
    assert run == tmp_path / "review/evals/20261101-0905-abcdef1-base"
    assert run.is_dir()
    with pytest.raises(ValueError):
        new_run(tmp_path, "Base!", datetime(2026, 11, 1, 9, 5), "abcdef1234")


def test_meta_roundtrip(tmp_path):
    run = new_run(tmp_path, "base", datetime(2026, 11, 1, 9, 5), "abcdef1234")
    meta = RunMeta("base", "abcdef1234", "2026-11-01T09:05:00", {"fast": "m"}, prompt_hashes(), None)
    write_meta(run, meta)
    data = json.loads((run / "meta.json").read_text(encoding="utf-8"))
    assert "first" in data["prompt_hashes"]
    assert data["gold_hash"] is None


def test_prompt_hashes_shape():
    hashes = prompt_hashes()
    for key in ("first", "final", "judge", "analysis", "signal_ask"):
        assert len(hashes[key]) == 12


def test_metrics_and_jsonl(tmp_path):
    write_metrics(tmp_path, "questions", {"이름": 1})
    text = (tmp_path / "questions.metrics.json").read_text(encoding="utf-8")
    assert "이름" in text and '\n  "' in text
    p = tmp_path / "x.jsonl"
    assert read_jsonl(p) == []
    append_jsonl(p, {"a": "가"})
    append_jsonl(p, {"a": 2})
    assert read_jsonl(p) == [{"a": "가"}, {"a": 2}]


def test_git_commit_unknown(tmp_path):
    assert git_commit(tmp_path) == "unknown"
