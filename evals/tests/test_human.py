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
    # 두 줄뿐이라 일치율은 내지 않고 건수만 남긴다
    assert m["judge_agreement_presupposition"] is None and m["judge_agreement_presupposition_n"] == 2
    assert m["judge_agreement_inflation"] is None and m["judge_agreement_inflation_n"] == 2
    assert m["usable_n"] == 2 and m["agreement_min_n"] == 5
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
    assert m["judge_agreement_presupposition_n"] == 1 and m["judge_agreement_presupposition"] is None
    assert m["judge_agreement_inflation_n"] == 1 and m["judge_agreement_inflation"] is None
    _csv(tmp_path / "h2.csv", [{"id": "zzz", "presupposes": "Y"}])
    assert import_scores(tmp_path / "h2.csv", run)["judge_agreement_presupposition"] is None


def test_agreement_from_five_rows(tmp_path):
    run = tmp_path / "run"
    ids = [f"q{i}" for i in range(5)]
    _judge(run, [{"id": i, "presupposes": True, "inflated": False, "na": []} for i in ids])
    _csv(tmp_path / "h.csv", [{"id": i, "presupposes": "Y" if k < 4 else "N", "inflated": "N"} for k, i in enumerate(ids)])
    m = import_scores(tmp_path / "h.csv", run)
    assert m["judge_agreement_presupposition"] == 0.8 and m["judge_agreement_presupposition_n"] == 5
    assert m["judge_agreement_inflation"] == 1.0


def test_export_includes_judge_applicable_rows(tmp_path):
    run = tmp_path / "run"
    _write_run(run)
    # 판정이 붙은 질문은 A·B 에 하나씩뿐 — 무작위로는 잘 안 뽑히는 줄
    _judge(run, [
        {"id": "W13:A:first:1", "presupposes": None, "inflated": True, "na": ["presupposes"]},
        {"id": "W14:B:first:1", "presupposes": False, "inflated": None, "na": ["inflated"]},
        {"id": "W12:A:first:1", "presupposes": None, "inflated": None, "na": ["presupposes", "inflated"]},
    ])
    for seed in range(5):
        out = tmp_path / f"s{seed}.csv"
        assert export_sample(run, out, n=4, seed=seed) == 4
        ids = {r["id"] for r in _read(out)}
        assert {"W13:A:first:1", "W14:B:first:1"} <= ids
