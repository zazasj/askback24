"""⓪ 업무 카드 초안 지표: 분야 밖 후보·두 번 사이 안정성·공고 담당업무 덮임.
콘솔에는 건수와 경로만 찍는다. 덮이지 않은 공고 줄은 결과 파일에만 쓴다."""
import argparse
import asyncio
import itertools
import json
import sys
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path

import httpx  # noqa: F401  (main 시그니처를 다른 평가 스크립트와 맞추지 않아도 되도록 쓰지 않음)

from api._agent.llm import llm_from_env
from api._agent.regen import load_env
from evals.judges import uncovered_lines
from evals.postings import PostingError, load_postings
from evals.runlog import RunMeta, git_commit, new_run, prompt_hashes, write_meta, write_metrics

ROOT = Path(__file__).resolve().parents[1]
_BULLETS = ("-", "·", "•")
_EXAMPLES_MAX = 20


def off_domain(draft: dict, ncs: list[str]) -> dict:
    cands = draft.get("candidates", [])
    # 실제 초안의 subcategory는 이름이라, 세분류 코드는 능력단위 번호 앞 8자리로도 맞춘다
    out = [c for c in cands if c.get("subcategory") not in ncs and str(c.get("ablt_unit") or "")[:8] not in ncs]
    used = [c for c in out if c.get("used_in")]
    return {
        "candidates": len(cands),
        "off_domain": len(out),
        "off_domain_rate": len(out) / len(cands) if cands else 0.0,
        "off_domain_used": len(used),
        "off_domain_used_units": [c.get("unit") for c in used],
    }


def _pairs(draft: dict) -> set[frozenset[str]]:
    out: set[frozenset[str]] = set()
    for card in draft.get("cards", []):
        units = sorted({n["ablt_unit"] for n in card.get("ncs", [])})
        out.update(frozenset(p) for p in itertools.combinations(units, 2))
    return out


def stability(a: dict, b: dict) -> float:
    pa, pb = _pairs(a), _pairs(b)
    if not pa and not pb:
        return 1.0
    return len(pa & pb) / len(pa | pb)


def duty_lines(job_cont: str) -> list[str]:
    out: list[str] = []
    inside = False
    for raw in job_cont.splitlines():
        line = raw.strip()
        if line.startswith("[담당업무]"):
            inside = True
            continue
        if not inside:
            continue
        if line.startswith("["):
            break
        if line.startswith(_BULLETS):
            text = line[1:].strip()
            if text:
                out.append(text)
    return out


async def coverage(llm, postings: dict[str, dict], cards: list[dict]) -> dict:
    withd = lines_n = uncovered_n = failed = 0
    examples: list[list[str]] = []
    for no, p in postings.items():
        lines = duty_lines(str(p.get("jobCont") or ""))
        if not lines:
            continue
        withd += 1
        bad = await uncovered_lines(llm, lines, cards)
        if bad is None:
            failed += 1  # 판정 실패는 덮임·안 덮임이 아니라 따로 세고 분모에서도 뺀다
            continue
        lines_n += len(lines)
        uncovered_n += len(bad)
        for i in bad:
            if len(examples) < _EXAMPLES_MAX:
                examples.append([no, lines[i]])
    return {
        "postings_with_duties": withd,
        "lines": lines_n,
        "uncovered": uncovered_n,
        "covered_rate": (lines_n - uncovered_n) / lines_n if lines_n else None,
        "failed": failed,
        "uncovered_examples": examples,
    }


def _read(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def main(argv: list[str] | None = None, root: Path = ROOT, env: Mapping[str, str] | None = None,
         llm=None, now: datetime | None = None) -> int:
    ap = argparse.ArgumentParser(prog="eval:cards")
    ap.add_argument("--draft", required=True)
    ap.add_argument("--ncs", required=True)
    ap.add_argument("--draft2")
    ap.add_argument("--postings")
    ap.add_argument("--label", default="cards")
    args = ap.parse_args(argv)
    root = Path(root)
    try:
        draft = _read(args.draft)
        draft2 = _read(args.draft2) if args.draft2 else None
    except (OSError, ValueError):
        print("초안 파일을 읽지 못했어요")
        return 1
    ncs = [c.strip() for c in args.ncs.split(",") if c.strip()]
    commit = git_commit(root)
    try:
        run = new_run(root, args.label, now or datetime.now(), commit)
    except ValueError as e:
        print(e)
        return 2
    metrics: dict = {"off_domain": off_domain(draft, ncs)}
    od = metrics["off_domain"]
    print(f"분야 밖 후보 {od['off_domain']}/{od['candidates']}개 · 그중 카드에 쓰인 것 {od['off_domain_used']}개")
    if draft2 is not None:
        metrics["stability"] = stability(draft, draft2)
        print(f"두 초안의 묶음 안정성 {metrics['stability']:.2f}")
    pdir = Path(args.postings) if args.postings else None
    if pdir is not None and pdir.is_dir():
        try:
            postings = load_postings(pdir)
        except PostingError as e:
            print(f"공고 {e}")
            return 1
    else:
        postings = {}
    models: dict[str, str] = {}
    if postings:
        llm = llm or llm_from_env(env if env is not None else load_env(root))
        cards = [{"label": c.get("label"), "description": c.get("plain")} for c in draft.get("cards", [])]
        metrics["coverage"] = asyncio.run(coverage(llm, postings, cards))
        cv = metrics["coverage"]
        rate = "없음" if cv["covered_rate"] is None else f"{cv['covered_rate']:.2f}"
        print(f"담당업무 줄 {cv['lines']}개 · 안 덮임 {cv['uncovered']}개 · 덮임 비율 {rate} · 판정 실패 {cv['failed']}건")
        models = {"judge": "accurate"}
    else:
        print("평가 공고가 없어 덮임 지표는 건너뜀")
    write_meta(run, RunMeta(
        args.label, commit, (now or datetime.now()).isoformat(timespec="seconds"),
        models, prompt_hashes(), None,
    ))
    write_metrics(run, "cards", metrics)
    print(run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
