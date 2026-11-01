"""사람 점수 표본 내보내기·가져오기. CSV에 질문 글이 들어가므로 evals/data/human/(git 밖)에만 두고 콘솔에는 건수·경로만 찍는다."""
import argparse
import csv
import random
import sys
from pathlib import Path

from evals.metrics_questions import question_id
from evals.runlog import read_jsonl, write_metrics

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = (
    "id", "wantedAuthNo", "persona", "card_id", "question",
    "usable", "company_fit", "newbie_natural", "presupposes", "inflated", "note",
)
_SCORES = ("usable", "company_fit", "newbie_natural")
_FLAGS = (("presupposes", "presupposes"), ("inflated", "inflated"))


def _candidates(run: Path) -> dict[str, list[dict]]:
    by_persona: dict[str, list[dict]] = {"A": [], "B": []}
    for row in read_jsonl(run / "questions.jsonl"):
        if row.get("persona") not in by_persona:
            continue
        for q in (row.get("first") or {}).get("questions") or []:
            if q.get("source") != "ai":
                continue
            by_persona[row["persona"]].append({
                "id": question_id(row, "first", q["rank"]),
                "wantedAuthNo": row["wantedAuthNo"],
                "persona": row["persona"],
                "card_id": q.get("card_id", ""),
                "question": q.get("text", ""),
            })
    return by_persona


def export_sample(run: Path, out: Path, n: int = 20, seed: int = 7) -> int:
    rng = random.Random(seed)
    picked: list[dict] = []
    for persona, rows in _candidates(run).items():
        rows = sorted(rows, key=lambda r: r["id"])  # 입력 순서와 무관하게 같은 seed면 같은 표본
        picked += rng.sample(rows, min(n // 2, len(rows)))
    out.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig: 엑셀이 한글을 바로 읽도록 BOM을 붙인다
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in picked:
            w.writerow({c: r.get(c, "") for c in COLUMNS})
    return len(picked)


def _score(v: str) -> int | None:
    v = (v or "").strip()
    return int(v) if v in ("1", "2", "3") else None


def _flag(v: str) -> bool | None:
    v = (v or "").strip().upper()
    return {"Y": True, "N": False}.get(v)


def _judge_value(j: dict | None, key: str) -> bool | None:
    if not j or key in (j.get("na") or []):
        return None
    return j.get(key)  # None이면 판정 실패


def import_scores(csv_path: Path, run: Path) -> dict:
    judged = {r["id"]: r for r in read_jsonl(run / "judge.jsonl")}
    # utf-8-sig·newline="": 엑셀 BOM·CRLF를 그대로 읽는다
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("id") or "").strip()]
    sums: dict[str, list[int]] = {k: [] for k in _SCORES}
    # 채우지 않은 칸은 세지 않고, 1~3 밖이거나 숫자가 아닌 칸만 건너뛴 것으로 센다
    skipped = 0
    agree: dict[str, list[bool]] = {k: [] for k, _ in _FLAGS}
    for r in rows:
        for k in _SCORES:
            raw = (r.get(k) or "").strip()
            s = _score(raw)
            if s is not None:
                sums[k].append(s)
            elif raw:
                skipped += 1
        j = judged.get(r["id"].strip())
        for k, jk in _FLAGS:
            h, jv = _flag(r.get(k) or ""), _judge_value(j, jk)
            if h is not None and jv is not None:
                agree[k].append(h == jv)

    def mean(xs: list[int]) -> float | None:
        return sum(xs) / len(xs) if xs else None

    def rate(xs: list[bool]) -> float | None:
        return sum(xs) / len(xs) if xs else None

    metrics = {
        "usable_mean": mean(sums["usable"]),
        "company_fit_mean": mean(sums["company_fit"]),
        "newbie_natural_mean": mean(sums["newbie_natural"]),
        "judge_agreement_presupposition": rate(agree["presupposes"]),
        "judge_agreement_inflation": rate(agree["inflated"]),
        "rows": len(rows),
        "skipped_scores": skipped,
    }
    write_metrics(run, "human", metrics)
    return metrics


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="evals.human")
    p.add_argument("action", choices=("export", "import"))
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--csv", type=Path, help="기본값: evals/data/human/<실행 이름>.csv")
    p.add_argument("--n", type=int, default=20)
    p.add_argument("--seed", type=int, default=7)
    a = p.parse_args(argv)
    path = a.csv or ROOT / "evals" / "data" / "human" / f"{a.run.name}.csv"
    if a.action == "export":
        n = export_sample(a.run, path, a.n, a.seed)
        print(f"표본 {n}줄 → {path}")
        return 0
    if not path.exists():
        print(f"CSV가 없습니다: {path}")
        return 1
    m = import_scores(path, a.run)
    from evals.score import write_summary  # 무거운 import는 가져오기 때만

    write_summary(a.run)
    print(f"가져옴 {m['rows']}줄 · 건너뛴 점수 {m['skipped_scores']}칸 → {a.run / 'human.metrics.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
