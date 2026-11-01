import csv
import json

from evals.human import COLUMNS, export_sample, import_scores
from evals.runlog import read_jsonl


def _write_run(run, n_a=15, n_b=15):
    run.mkdir(parents=True, exist_ok=True)
    rows = []
    for persona, n in (("A", n_a), ("B", n_b)):
        for i in range(n):
            rows.append({
                "wantedAuthNo": f"W{i}", "persona": persona,
                "first": {"questions": [
                    {"rank": 1, "card_id": "c1", "text": f"질문 {persona}{i}", "source": "ai"},
                    {"rank": 2, "card_id": "c2", "text": "고정 질문", "source": "template"},
                ]},
            })
    (run / "questions.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8"
    )


def _read(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def test_export_balanced(tmp_path):
    run = tmp_path / "run"
    _write_run(run)
    out = tmp_path / "h" / "s.csv"
    assert export_sample(run, out, n=20, seed=7) == 20
    rows = _read(out)
    assert len(rows) == 20
    assert [r["persona"] for r in rows].count("A") == 10
    assert [r["persona"] for r in rows].count("B") == 10
    assert all(r["id"].endswith(":first:1") and r["usable"] == "" for r in rows)
    assert out.read_bytes().startswith(b"\xef\xbb\xbf")
    assert list(rows[0]) == list(COLUMNS)
    out2 = tmp_path / "s2.csv"
    export_sample(run, out2, n=20, seed=7)
    assert [r["id"] for r in _read(out2)] == [r["id"] for r in rows]


def test_export_fewer_than_half(tmp_path):
    run = tmp_path / "run"
    _write_run(run, n_a=3, n_b=15)
    assert export_sample(run, tmp_path / "s.csv", n=20) == 13


def _csv(path, rows, crlf=False):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\r\n" if crlf else "\n")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in COLUMNS})
        f.write("\r\n" if crlf else "\n")  # 끝 빈 줄


def _judge(run, rows):
    run.mkdir(parents=True, exist_ok=True)
    (run / "judge.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")


def test_import_means_and_agreement(tmp_path):
    run = tmp_path / "run"
    _judge(run, [
        {"id": "a", "presupposes": True, "inflated": False, "na": []},
        {"id": "b", "presupposes": True, "inflated": False, "na": []},
    ])
    _csv(tmp_path / "h.csv", [
        {"id": "a", "usable": "3", "company_fit": "2", "presupposes": "Y", "inflated": "n"},
        {"id": "b", "usable": "1", "newbie_natural": "3", "presupposes": " N ", "inflated": "N"},
    ], crlf=True)
    m = import_scores(tmp_path / "h.csv", run)
    assert m["usable_mean"] == 2.0
    assert m["company_fit_mean"] == 2.0
    assert m["newbie_natural_mean"] == 3.0
    assert m["judge_agreement_presupposition"] == 0.5
    assert m["judge_agreement_inflation"] == 1.0
    assert json.loads((run / "human.metrics.json").read_text(encoding="utf-8")) == m


def test_import_skips_blank_bad_and_missing_judge(tmp_path):
    run = tmp_path / "run"
    _judge(run, [
        {"id": "a", "presupposes": None, "inflated": True, "na": []},
        {"id": "b", "presupposes": True, "inflated": None, "na": ["inflated"]},
    ])
    _csv(tmp_path / "h.csv", [
        {"id": "a", "usable": "5", "company_fit": "x", "presupposes": "Y", "inflated": "Y"},
        {"id": "b", "usable": "", "presupposes": "Y", "inflated": "Y"},
    ])
    m = import_scores(tmp_path / "h.csv", run)
    assert m["usable_mean"] is None
    assert m["skipped_scores"] == 2
    assert m["judge_agreement_presupposition"] == 1.0
    assert m["judge_agreement_inflation"] == 1.0
    _csv(tmp_path / "h2.csv", [{"id": "zzz", "presupposes": "Y"}])
    assert import_scores(tmp_path / "h2.csv", run)["judge_agreement_presupposition"] is None
