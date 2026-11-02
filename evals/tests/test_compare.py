import json

from evals.compare import compare_runs


def _put(run, name, data):
    run.mkdir(parents=True, exist_ok=True)
    (run / f"{name}.metrics.json").write_text(json.dumps(data), encoding="utf-8")


def test_compare_table(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    _put(a, "questions", {"first": {"posting_guess": 0.4}})
    _put(b, "questions", {"first": {"posting_guess": 0.55}})
    _put(b, "questions", {"first": {"posting_guess": 0.55, "template_rate": 0.1}})
    out = compare_runs(a, b)
    assert "| 지표 | 전 | 후 | 차이 |" in out
    assert "| questions.first.posting_guess | 0.40 | 0.55 | +0.15 |" in out
    assert "| questions.first.template_rate | — | 0.10 | — |" in out


def test_compare_skips_non_numbers(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    _put(a, "m", {"n": "text", "ok": True, "x": 1})
    _put(b, "m", {"n": "text", "x": 1})
    out = compare_runs(a, b)
    assert "m.x | 1.00 | 1.00 | +0.00" in out
    assert "m.n" not in out and "m.ok" not in out
