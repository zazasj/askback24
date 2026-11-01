"""②③ 질문 평가의 지표·판정·요약. 입력은 <실행 폴더>/questions.jsonl(+judgements.jsonl, analysis/).
콘솔에는 건수와 지표만 찍는다(질문·공고·이력 글은 찍지 않는다). 결과는 실행 폴더에만 쓴다."""
import argparse
import asyncio
import json
import sys
from collections.abc import Mapping
from pathlib import Path

from api._agent.checks import load_card_labels
from api._agent.llm import llm_from_env
from api._agent.regen import load_env
from evals.metrics_questions import (
    judge_rows, judgement_metrics, latency_p95, rates, similarity_ab, template_rate, unknown_terms,
)
from evals.postings import PostingError, load_postings
from evals.raw_first import raw_violations
from evals.runlog import read_jsonl, write_metrics

ROOT = Path(__file__).resolve().parents[1]


def _flatten(v: object, prefix: str = "") -> list[tuple[str, str]]:
    if isinstance(v, dict):
        return [kv for k, x in v.items() for kv in _flatten(x, f"{prefix}.{k}" if prefix else str(k))]
    if isinstance(v, list):
        return [(prefix, f"{len(v)}개")]
    if isinstance(v, float):
        return [(prefix, f"{v:.3f}")]
    return [(prefix, "-" if v is None else str(v))]


def _failed_total(m: dict) -> int:
    n = sum(v.get("failed", 0) for v in (m.get("judge") or {}).values() if isinstance(v, dict))
    raw = m.get("raw")
    return n + (raw.get("failed", 0) if isinstance(raw, dict) else 0)


def write_summary(run: Path) -> None:
    lines = ["# 평가 요약", ""]
    meta = run / "meta.json"
    if meta.exists():
        lines += ["## 메타", "", "| 항목 | 값 |", "|---|---|"]
        lines += [f"| {k} | {v} |" for k, v in _flatten(json.loads(meta.read_text(encoding="utf-8")))]
        lines.append("")
    failed = 0
    for f in sorted(run.glob("*.metrics.json")):
        m = json.loads(f.read_text(encoding="utf-8"))
        failed += _failed_total(m)
        lines += [f"## {f.name}", "", "| 지표 | 값 |", "|---|---|"]
        lines += [f"| {k} | {v} |" for k, v in _flatten(m)]
        lines.append("")
    lines.append(f"판정 실패 {failed}건 (지표 분모에서 뺀 것)")
    (run / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _personas(root: Path) -> dict[str, dict]:
    return {n: json.loads((root / "evals" / "personas" / f"{n}.json").read_text(encoding="utf-8")) for n in ("A", "B")}


def _analyses(run: Path) -> dict[str, dict]:
    return {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in sorted((run / "analysis").glob("*.json"))}


def main(argv: list[str] | None = None, root: Path = ROOT, env: Mapping[str, str] | None = None, llm=None) -> int:
    ap = argparse.ArgumentParser(prog="eval:score")
    ap.add_argument("--run", required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--skip-raw", action="store_true")
    args = ap.parse_args(argv)
    root, run = Path(root), Path(args.run)
    rows = read_jsonl(run / "questions.jsonl")
    if not rows:
        print("questions.jsonl이 없어요. 먼저 npm run eval:questions 로 질문을 만드세요")
        return 1
    if args.limit is not None:
        rows = rows[: args.limit]
    try:
        postings = load_postings(root / "evals" / "data" / "postings")
        personas = _personas(root)
    except (PostingError, OSError, ValueError) as e:
        print(f"평가 자료를 읽지 못했어요: {type(e).__name__}")
        return 1
    if not postings:
        print("평가 공고가 없어요")
        return 1

    metrics: dict = {
        "first": {"template_rate": template_rate(rows, "first"), "latency_p95_s": latency_p95(rows, "first"),
                  "similarity_ab": similarity_ab(rows)},
        "final": {"template_rate": template_rate(rows, "final"), "latency_p95_s": latency_p95(rows, "final")},
        "unknown_terms": unknown_terms(rows, postings, personas),
    }
    llm = llm or llm_from_env(env if env is not None else load_env(root))
    judged = asyncio.run(judge_rows(llm, rows, postings, _analyses(run), personas, args.seed))
    jpath = run / "judge.jsonl"
    jpath.write_text("".join(json.dumps(j, ensure_ascii=False) + "\n" for j in judged), encoding="utf-8")
    metrics["judge"] = rates(judged)

    if not args.skip_raw:
        inputs = [r["first_input"] for r in rows if r.get("first_input")]
        metrics["raw"] = asyncio.run(raw_violations(llm, inputs, load_card_labels(root)))

    jg = read_jsonl(run / "judgements.jsonl")
    if (run / "judgements.jsonl").exists():
        metrics["judgements"] = judgement_metrics(jg)
    else:
        print("judgements.jsonl이 없어 judgements 지표는 건너뜀")

    write_metrics(run, "questions", metrics)
    write_summary(run)
    j = metrics["judge"]
    print(f"질문 {len(judged)}개 판정 · " + " · ".join(
        f"{k} {'-' if v['rate'] is None else format(v['rate'], '.2f')}(n={v['n']}, 실패 {v['failed']})" for k, v in j.items()))
    if "raw" in metrics:
        print(f"날것 위반율 {metrics['raw']['rate']:.2f} · 실패 {metrics['raw']['failed']}건")
    print(run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
