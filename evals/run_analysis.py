"""① 공고 분석을 평가 공고로 돌려 review/evals/<실행>/ 에 남기고, 정답표가 있으면 지표를 계산한다.
콘솔에는 건수와 경로만 찍는다(공고 글·회사명은 찍지 않는다)."""
import argparse
import asyncio
import hashlib
import json
import sys
import time
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path

import httpx

from api._agent.errors import ApiError
from api._agent.graphs.analysis import AnalysisAgent
from api._agent.llm import LlmError, llm_from_env
from api._agent.regen import JOB, load_env, merge_candidate
from api._agent.schemas import AnalysisRequest
from evals.gold import load_gold_json
from evals.metrics_analysis import analysis_metrics
from evals.postings import PostingError, load_postings
from evals.runlog import RunMeta, append_jsonl, git_commit, new_run, prompt_hashes, read_jsonl, write_meta, write_metrics

ROOT = Path(__file__).resolve().parents[1]


async def run_analysis(agent, postings: dict[str, dict], run: Path) -> dict[str, dict | str]:
    out: dict[str, dict | str] = {}
    for no, p in postings.items():
        t0 = time.monotonic()
        try:
            res = await agent.run(AnalysisRequest(posting=p, job=JOB))
            out[no] = merge_candidate({"cards": [], "blanks": []}, res)
            (run / "analysis").mkdir(parents=True, exist_ok=True)
            (run / "analysis" / f"{no}.json").write_text(
                json.dumps(out[no], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        except (LlmError, ApiError) as e:
            out[no] = getattr(e, "code", "error")
        except Exception as e:  # 한 공고가 터져도 나머지는 계속한다. 글에 회사 정보가 섞일 수 있어 종류만 남긴다.
            out[no] = type(e).__name__
        append_jsonl(run / "analysis.timing.jsonl", {
            "wantedAuthNo": no, "elapsed_s": round(time.monotonic() - t0, 3), "ok": isinstance(out[no], dict),
        })
    return out


def main(argv: list[str] | None = None, root: Path = ROOT, env: Mapping[str, str] | None = None,
         agent=None, http: httpx.AsyncClient | None = None, now: datetime | None = None) -> int:
    ap = argparse.ArgumentParser(prog="eval:analysis")
    ap.add_argument("--label", required=True)
    ap.add_argument("--limit", type=int)
    args = ap.parse_args(argv)
    root = Path(root)
    data = root / "evals" / "data"
    try:
        postings = load_postings(data / "postings")
    except PostingError as e:
        print(f"공고 {e}")
        return 1
    if args.limit is not None:
        postings = dict(list(postings.items())[: args.limit])
    if not postings:
        print("평가 공고가 없어요")
        return 1
    gold_path = data / "gold.json"
    gold_hash = hashlib.sha256(gold_path.read_bytes()).hexdigest()[:12] if gold_path.exists() else None
    commit = git_commit(root)
    try:
        run = new_run(root, args.label, now or datetime.now(), commit)
    except ValueError as e:
        print(e)
        return 2
    if agent is None:
        env = env if env is not None else load_env(root)
        agent = AnalysisAgent(llm_from_env(env), root, env, http=http)
    outs = asyncio.run(run_analysis(agent, postings, run))
    models = sorted({o["meta"]["model"] for o in outs.values() if isinstance(o, dict) and o.get("meta", {}).get("model")})
    write_meta(run, RunMeta(
        args.label, commit, (now or datetime.now()).isoformat(timespec="seconds"),
        {"analysis": ",".join(models)} if models else {}, prompt_hashes(), gold_hash,
    ))
    failed = sum(not isinstance(o, dict) for o in outs.values())
    print(f"분석 {len(outs) - failed}건 · 실패 {failed}건")
    if gold_hash:
        elapsed = [r["elapsed_s"] for r in read_jsonl(run / "analysis.timing.jsonl")]
        m = analysis_metrics(load_gold_json(gold_path), outs, postings, elapsed)
        write_metrics(run, "analysis", m)
        print(f"① 지표 기록: 날조 {m['fabricated']}칸 · 놓침 {m['missed']}칸 · 실패 {m['failed']}건")
    else:
        print("정답표가 없어 ① 지표는 건너뜀")
    print(run)
    return 1 if failed == len(outs) else 0


if __name__ == "__main__":
    sys.exit(main())
