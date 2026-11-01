"""업무 카드 초안을 CLI로 만들어 review/ 에 JSON과 검수 보고서를 쓴다(설계 §2 ⓪). data/ 는 건드리지 않는다."""
import argparse
import asyncio
import json
import re
from collections.abc import Mapping
from pathlib import Path

import httpx

from .cards.sources import SourceError
from .errors import ApiError
from .budget import CARDS_LLM_MAX_S
from .llm import Llm, LlmError, llm_from_env
from .graphs.cards import CardsAgent
from .regen import load_env
from .schemas import CardDraftRequest, CardDraftResponse

ROOT = Path(__file__).resolve().parents[2]
CLI_DEADLINE_S = 300.0
# 한 번 부르는 상한도 전체 한도에 맞춰 늘린다(묶기 호출이 45초를 넘길 수 있음). 10초만 남기므로 호출이 상한까지 가면
# 남은 시간이 다시 쓰기 기준(20초)에 못 미쳐 다시 쓰기를 건너뛴다. 보통은 그보다 일찍 끝난다.
LLM_HEADROOM_S = 10.0


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def compare_section(book: list[dict], res: CardDraftResponse) -> str:
    by_name: dict[str, list[str]] = {}
    for c in res.candidates:
        by_name.setdefault(_norm(c.unit), []).append(c.ablt_unit)
    labels = {c.id: c.label for c in res.cards}
    holders: dict[str, list[str]] = {}
    for c in res.cards:
        for n in c.ncs:
            holders.setdefault(n.ablt_unit, []).append(c.id)
    rows = []
    for card in book:
        names = [n.get("unit", "") for n in card.get("ncs", [])]
        codes = [code for n in names for code in by_name.get(_norm(n), [])]
        missing = [n for n in names if _norm(n) not in by_name]
        mine = list(dict.fromkeys(i for code in codes for i in holders.get(code, [])))
        tail = ", ".join(f"{i} {labels[i]}" for i in mine) if mine else "묶은 초안 카드 없음"
        miss = f" / 후보에 없는 이름: {', '.join(missing)}" if missing else ""
        rows.append(f"- {card.get('id')} {card.get('label')} [{', '.join(names)}] → {tail}{miss}")
    return "\n## 기존 사전과 비교\n\n" + ("\n".join(rows) if rows else "- 기존 카드가 없어요") + "\n"


def report(res: CardDraftResponse, compare: list[dict] | None) -> str:
    cands = res.candidates
    high = sum(1 for c in cands if c.high_level)
    unknown = sum(1 for c in cands if c.level is None)
    L = ["# 업무 카드 초안 검수 보고서\n", "초안은 검수 전이에요. `data/`는 바꾸지 않았어요.\n"]
    L.append("## 출처\n\n" + "\n".join(f"- {k}: {v}" for k, v in res.meta.sources.items()))
    L.append(f"\n- 모델: {res.meta.model} / 만든 때: {res.meta.created_at}")
    L.append(f"\n## 후보\n\n후보 {len(cands)}개, 수준 6 이상 {high}개, 수준 모름 {unknown}개")
    L.append("\n## 카드와 묶인 능력단위\n")
    for c in res.cards:
        units = ", ".join(f"{n.unit}({n.ablt_unit})" for n in c.ncs) or "없음"
        L.append(f"- {c.id}{' (core)' if c.core else ''} {c.label}: {units}")
    L.append("\n## issues\n")
    L.append("\n".join(f"- {i.card_id or '전체'}: {i.rule}" for i in res.issues) if res.issues else "- 없음")
    unused = [c for c in cands if c.used_in is None]
    L.append("\n## 안 쓰인 후보\n")
    L.append("\n".join(f"- {c.unit}({c.ablt_unit}){' 수준 6 이상' if c.high_level else ''}" for c in unused) if unused else "- 없음")
    text = "\n".join(L) + "\n"
    if compare is not None:
        text += compare_section(compare, res)
    return text


def main(argv: list[str] | None = None, root: Path = ROOT, env: Mapping[str, str] | None = None,
         llm: Llm | None = None, http: httpx.AsyncClient | None = None) -> int:
    ap = argparse.ArgumentParser(prog="cards:draft")
    ap.add_argument("--job", required=True)
    ap.add_argument("--job-label", required=True)
    ap.add_argument("--ncs", required=True, help="쉼표로 여러 개")
    ap.add_argument("--job-dictionary-code")
    ap.add_argument("--max-cards", type=int, default=15)
    ap.add_argument("--deadline", type=float, default=CLI_DEADLINE_S)
    ap.add_argument("--compare")
    ap.add_argument("--out", default="review/card-drafts")
    args = ap.parse_args(argv)
    root = Path(root)
    env = env if env is not None else load_env(root)
    try:
        req = CardDraftRequest(job=args.job, job_label=args.job_label, ncs_subcategories=args.ncs.split(","),
                               job_dictionary_code=args.job_dictionary_code, max_cards=args.max_cards)
    except ValueError:
        print("입력이 올바르지 않아요")
        return 1
    book = None
    if args.compare:
        try:
            book = json.loads((root / args.compare).read_text(encoding="utf-8"))["cards"]
        except (OSError, ValueError, KeyError):
            print("비교할 사전을 읽지 못했어요")
            return 1
    out = (root / args.out).resolve()
    if out == (root / "data").resolve() or (root / "data").resolve() in out.parents:
        print("data/ 안에는 쓰지 않아요. review/ 아래 경로를 쓰세요")  # 사전은 검수 뒤 사람이 옮긴다
        return 1
    agent = CardsAgent(llm or llm_from_env(env), root, env, http=http, deadline_s=args.deadline,
                       llm_max_s=max(CARDS_LLM_MAX_S, args.deadline - LLM_HEADROOM_S))
    try:
        res = asyncio.run(agent.run(req))
    except (LlmError, ApiError) as e:
        msg = f", {e.message}" if isinstance(e, ApiError) else ""
        print(f"실패(code={getattr(e, 'code', 'error')}{msg})")
        return 1
    except SourceError as e:
        print(f"실패(code={e.code})")
        return 1
    except Exception as e:  # 글에 키나 응답이 섞일 수 있어 종류만 남긴다
        print(f"실패(code={type(e).__name__})")
        return 1
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{args.job}.json").write_text(json.dumps(res.model_dump(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / f"{args.job}.report.md").write_text(report(res, book), encoding="utf-8")
    print(f"카드 {len(res.cards)}개, issues {len(res.issues)}개 -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
