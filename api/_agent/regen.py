"""시연 공고 분석을 파이프라인으로 다시 만들어 후보와 비교 보고서를 쓴다(설계 §2 ①).
기본은 review/ 에만 쓴다. 사람이 보고서를 보고 후보 파일을 고친 뒤 --apply-candidates 로 그 파일을 그대로 data/ 에 옮긴다
(LLM 을 다시 부르지 않는다). 사람이 검수한 글은 후보에서도 지킨다."""
import argparse
import asyncio
import hashlib
import json
import os
import re
from collections.abc import Mapping
from datetime import date
from pathlib import Path

import httpx
from pydantic import ValidationError

from .analysis.cards import check_card
from .errors import ApiError
from .graphs.analysis import AnalysisAgent
from .llm import Llm, LlmError, llm_from_env
from .schemas import AnalysisRequest, AnalysisResponse, OfferBlank, Signal

ROOT = Path(__file__).resolve().parents[2]
JOB = "backend"
# kind 없는 지금 줄은 출처 이름과 문장 모양이 둘 다 맞아야 그 종류로 본다.
# 모양이 안 맞는 줄(사람이 쓴 뜻의 줄)은 파이프라인이 만들지 않으니 legacy 로 지킨다.
_SHAPES = {
    "reposting": ("고용24 공고 이력", re.compile(r"^같은 직무 공고가 \d+개월 안에 \d+번 등록됐어요$")),
    "pension_flow": ("국민연금 사업장 가입자 현황", re.compile(r"^최근 12개월 퇴사 인원이 입사 인원보다 많아요$")),
    "small_giant": ("고용24 강소기업 정보", re.compile(r"^강소기업 명단에 '.+'")),
    "industry_baseline": ("고용보험 통계(EIS)", re.compile(r"(월 평균 상실률은 .+%, 순증은 .+명이에요|한 달에 평균 .+%가 나가고, .+요)$")),
}
_WAGE_SOURCE = "임금체불 사업주 명단"
_KINDS = ("reposting", "pension_flow", "industry_baseline", "small_giant", "wage_arrears")


def current_kind(line: dict) -> str | None:
    if line.get("kind") in _KINDS:
        return line["kind"]
    name, text = line.get("source_name"), line.get("text", "")
    for kind, (src, shape) in _SHAPES.items():
        if name == src and shape.search(text):
            return kind
    if name == _WAGE_SOURCE and "올라 있어요" in text and "않아요" not in text:
        return "wage_arrears"
    return None


def merge_candidate(current: dict, fresh: AnalysisResponse) -> dict:
    old_cards = {c["card_id"]: c for c in current.get("cards", [])}
    cards = []
    for c in fresh.analysis.cards:
        if c.state == "absent":  # shared/rules.ts 가 파일에 없는 카드를 absent 로 본다
            continue
        row = c.model_dump(exclude_none=True, exclude={"needs_review"})
        if "questions" in old_cards.get(c.card_id, {}):
            row["questions"] = old_cards[c.card_id]["questions"]
        cards.append(row)
    old_blanks = {(b["topic"], b["status"]): b for b in current.get("blanks", [])}
    blanks = []
    for b in fresh.analysis.blanks:
        kept = old_blanks.get((b.topic, b.status))
        blanks.append(kept if kept else b.model_dump(exclude_none=True))
    return {"wantedAuthNo": fresh.analysis.wantedAuthNo, "meta": fresh.meta.model_dump(), "cards": cards, "blanks": blanks}


def _group(lines: list) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for line in lines:
        k = current_kind(line)
        if k:
            out.setdefault(k, []).append(line)
    return out


def merge_signals(current: list, fresh: list[Signal]) -> list:
    cur = _group(current)
    seen: dict[str, int] = {}
    out = []
    for s in fresh:
        row = s.model_dump(exclude_none=True)
        i = seen[s.kind] = seen.get(s.kind, -1) + 1
        olds = cur.get(s.kind, [])
        # 강소기업은 질문을 LLM 이 만들지 않아 사람이 쓴 지금 질문을 지킨다.
        if s.kind == "small_giant" and "ask" not in row and olds:
            old = olds[i] if i < len(olds) else olds[0]
            if old.get("ask"):
                row["ask"] = old["ask"]
        out.append(row)
    return out + [line for line in current if current_kind(line) is None]


def _by_id(cards: list[dict]) -> dict[str, dict]:
    return {c["card_id"]: c for c in cards}


def report_header() -> str:
    return ("# 공고 분석 다시 만들기 비교 보고서\n\n"
            "후보는 `data/`를 바꾸지 않았어요. 틀린 판정은 후보 파일(`analysis/<공고>.json`·`signals.json`)에서 고치고, "
            "`npm run analysis:regen -- --apply-candidates analysis|signals|all`로 그 파일을 그대로 적용해요. "
            "적용 전 `npm run check`를 돌리고, 깨지는 e2e는 SPEC-ISSUES에 적어요.\n")


def _desc(line: dict) -> str:
    return f"[{line.get('source')}] {line.get('text')} / ask: {line.get('ask', '없음')}"


def _pair(olds: list[dict], news: list[dict]) -> list[tuple[dict | None, dict | None]]:
    # 글이 같은 줄을 먼저 짝짓고, 남은 줄은 순서대로 짝짓는다. 남는 쪽은 더해짐·빠짐이다.
    free = list(range(len(news)))
    match: dict[int, int] = {}
    for i, o in enumerate(olds):
        for j in free:
            if news[j].get("text") == o.get("text"):
                match[i] = j
                free.remove(j)
                break
    for i in range(len(olds)):
        if i not in match and free:
            match[i] = free.pop(0)
    pairs = [(o, news[match[i]] if i in match else None) for i, o in enumerate(olds)]
    return pairs + [(None, news[j]) for j in free]


def report_section(wanted: str, current: dict, current_signals: list, fresh: AnalysisResponse, signals: list) -> str:
    L = [f"\n## {wanted}\n"]
    old, new = _by_id(current.get("cards", [])), _by_id([c.model_dump() for c in fresh.analysis.cards if c.state != "absent"])
    sub: list[str] = []
    state = [f"- {i}: {old[i]['state']} → {new[i]['state']}" for i in old if i in new and old[i]["state"] != new[i]["state"]]
    ev = [f"- {i}: {old[i].get('evidence')} → {new[i].get('evidence')}" for i in old if i in new and old[i].get("evidence") != new[i].get("evidence")]
    reason = [f"- {i}: {old[i].get('reason')} → {new[i].get('reason')}" for i in old if i in new and old[i].get("reason") != new[i].get("reason")]
    review = [f"- {c.card_id} ({c.state})" for c in fresh.analysis.cards if c.needs_review]
    gone = [f"- {i}" for i in old if i not in new]
    added = [f"- {i} ({new[i]['state']})" for i in new if i not in old]
    ood = [f"- {o.field}: {o.quote} / {o.note}" for o in fresh.out_of_dictionary]
    for title, rows in (("카드 상태 바뀜", state), ("근거 바뀜", ev), ("이유(reason) 바뀜", reason),
                        ("needs_review 카드", review), ("사라진 카드", gone), ("새 카드", added), ("out_of_dictionary", ood)):
        sub.append(f"### {title}\n" + ("\n".join(rows) if rows else "- 없음"))
    cur, new_sig = _group(current_signals), _group(signals)
    sig_rows, src = [], []
    for k in _KINDS:
        for o, n in _pair(cur.get(k, []), new_sig.get(k, [])):
            if o is None:
                sig_rows.append(f"- 더해짐: {k} / {_desc(n)}")
            elif n is None:
                sig_rows.append(f"- 빠짐: {k} / {_desc(o)}")
                if o.get("source") == "실제":
                    src.append(f"- {k}: 실제 줄 빠짐")
            elif (o.get("text"), o.get("ask"), o.get("source")) != (n.get("text"), n.get("ask"), n.get("source")):
                sig_rows.append(f"- 바뀜: {k} / {_desc(o)} → {_desc(n)}")
                if o.get("source") != n.get("source"):
                    tag = "배지 실제 → 모의" if (o.get("source"), n.get("source")) == ("실제", "모의") else f"{o.get('source')} → {n.get('source')}"
                    src.append(f"- {k}: {tag}")
    sub.append("### 신호 줄 더해짐·빠짐·바뀜\n" + ("\n".join(sig_rows) if sig_rows else "- 없음"))
    sub.append("### 출처(실제·모의)\n" + ("\n".join(src) if src else "- 바뀜 없음"))
    legacy = [line for line in current_signals if current_kind(line) is None]
    # merge_signals 가 이 줄들을 그대로 남기니, 실제 배지가 맞는지 검수자가 봐야 한다.
    sub.append("### 그대로 남는 옛 줄\n" + ("\n".join(
        (f"- ⚠ 실제 배지인데 파이프라인이 만들지 않은 줄: {line.get('text')}" if line.get("source") == "실제"
         else f"- {_desc(line)}") for line in legacy) if legacy else "- 없음"))
    ob = {b["topic"]: b["status"] for b in current.get("blanks", [])}
    nb = {b.topic: b.status for b in fresh.analysis.blanks}
    blanks = [f"- {t}: {ob.get(t, '없음')} → {nb.get(t, '없음')}" for t in {**ob, **nb} if ob.get(t) != nb.get(t)]
    sub.append("### 처우 빈칸 상태 바뀜\n" + ("\n".join(blanks) if blanks else "- 없음"))
    warn = []
    if not signals:
        warn.append("- 신호가 하나도 없어요")
    for k, olds in cur.items():
        if k != "small_giant":
            continue
        for j, o in enumerate(olds):
            m = new_sig.get(k, [])
            if o.get("ask") and j < len(m) and not m[j].get("ask"):
                warn.append(f"- small_giant 줄이 질문을 잃었어요: {m[j].get('text')}")
    warn += [f"- 실제 배지 옛 줄: {line.get('text')}" for line in legacy if line.get("source") == "실제"]
    warn += [f"- 질문이 ?로 끝나지 않아요: {line.get('ask')}" for line in signals if line.get("ask") and not str(line["ask"]).endswith("?")]
    sub.append("### 경고\n" + ("\n".join(warn) if warn else "- 없음"))
    return "\n".join(L) + "\n" + "\n\n".join(sub) + "\n"


def _read(p: Path, default):
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else default


def _write(p: Path, data) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_env(root: Path) -> dict[str, str]:
    # python-dotenv 없이 단순 KEY=VALUE 줄만 읽는다. 실제 환경변수가 우선한다.
    env: dict[str, str] = {}
    f = root / ".env"
    if f.is_file():
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    env.update(os.environ)
    return env


def fingerprint(value) -> str | None:
    # 후보를 만든 때의 data/ 값. 적용할 때 달라졌으면 그 사이 사람이 고친 것을 덮게 된다.
    if value is None:
        return None
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


APPLY_PARTS = ("analysis", "signals", "all")
_MISSING = object()


def validate_candidate(wanted: str, cand, posting: dict, book_ids: set[str]) -> list[str]:
    """사람이 고친 후보도 파이프라인 판정과 같은 검사(check_card)를 지나야 data/ 에 들어간다."""
    if not isinstance(cand, dict):
        return ["후보 파일 모양이 틀렸어요"]
    errs = [] if cand.get("wantedAuthNo") == wanted else ["wantedAuthNo 가 파일 이름과 달라요"]
    cards = cand.get("cards")
    if not isinstance(cards, list):
        return errs + ["cards 가 목록이 아니에요"]
    seen: set = set()
    for i, c in enumerate(cards):
        if not isinstance(c, dict):
            errs.append(f"cards[{i}]: 모양이 틀렸어요")
            continue
        cid = c.get("card_id")
        if cid in seen:
            errs.append(f"{cid}: 같은 카드가 두 번 있어요")
        seen.add(cid)
        if c.get("state") == "absent":
            # shared/rules.ts 는 파일에 없는 카드를 absent 로 본다.
            errs.append(f"{cid}: absent 카드는 파일에서 지워요")
        errs += [f"{cid}: {x}" for x in check_card(c, book_ids, posting)]
        q = c.get("questions")
        if q is not None and not (isinstance(q, dict) and q and all(isinstance(v, str) and v.strip() for v in q.values())):
            errs.append(f"{cid}: questions 모양이 틀렸어요")
    blanks = cand.get("blanks")
    if not isinstance(blanks, list):
        errs.append("blanks 가 목록이 아니에요")
    else:
        for i, b in enumerate(blanks):
            try:
                OfferBlank.model_validate(b)
            except ValidationError:
                errs.append(f"blanks[{i}]: 모양이 틀렸어요")
    return errs


def validate_signal_lines(lines) -> list[str]:
    if not isinstance(lines, list):
        return ["목록이 아니에요"]
    errs = []
    for i, line in enumerate(lines):
        ok = isinstance(line, dict) and line.get("source") in ("실제", "모의") \
            and all(isinstance(line.get(k), str) and line[k].strip() for k in ("text", "source_name")) \
            and (line.get("ask") is None or isinstance(line.get("ask"), str))
        if not ok:
            errs.append(f"[{i}]: text·source·source_name 모양이 틀렸어요")
    return errs


def apply_candidates(root: Path, out_dir: Path, part: str, only: str | None, ignore_base: bool, today: str) -> int:
    """검토한 후보 파일을 그대로 data/ 에 쓴다. 하나라도 걸리면 아무것도 쓰지 않는다."""
    base = _read(out_dir / "base.json", None)
    errors: list[str] = []
    if not ignore_base and not isinstance(base, dict):
        errors.append("후보를 만든 때의 기준(base.json)이 없어요. 다시 만들거나, data/ 가 그 뒤 바뀌지 않은 것을 확인하고 --ignore-base 를 붙여요")

    def stale(kind: str, w: str, current) -> list[str]:
        if ignore_base or not isinstance(base, dict):
            return []
        want = base.get(kind, {}).get(w, _MISSING)
        if want is _MISSING:
            return [f"{w}: 이 공고 {kind} 후보의 기준이 base.json 에 없어요"]
        if want != fingerprint(current):
            return [f"{w}: 후보를 만든 뒤 data/ 의 {kind} 가 바뀌었어요. 바뀐 것을 후보에 옮긴 뒤 --ignore-base 를 붙이거나 다시 만들어요"]
        return []

    writes: list[tuple[Path, object]] = []
    if part in ("analysis", "all"):
        postings = {p["wantedAuthNo"]: p for p in _read(root / "data/postings.json", [])}
        book_ids = {c["id"] for c in _read(root / f"data/cards.{JOB}.json", {}).get("cards", [])}
        files = sorted((out_dir / "analysis").glob("*.json"))
        files = [f for f in files if not only or f.stem == only]
        if not files:
            errors.append("적용할 분석 후보가 없어요")
        for f in files:
            w = f.stem
            if w not in postings:
                errors.append(f"{w}: data/postings.json 에 없는 공고예요")
                continue
            cand = _read(f, None)
            errors += [f"{w}: {e}" for e in validate_candidate(w, cand, postings[w], book_ids)]
            target = root / f"data/analysis/{w}.json"
            errors += stale("analysis", w, _read(target, None))
            if isinstance(cand, dict):
                meta = cand.get("meta") if isinstance(cand.get("meta"), dict) else {}
                writes.append((target, {**cand, "meta": {**meta, "applied_on": today}}))
    if part in ("signals", "all"):
        cand_all = _read(out_dir / "signals.json", None)
        if not isinstance(cand_all, dict) or not cand_all:
            errors.append("적용할 신호 후보가 없어요")
        else:
            current = _read(root / "data/signals.json", {})
            merged = dict(current)
            for w in [only] if only else sorted(cand_all):
                if w not in cand_all:
                    errors.append(f"{w}: 신호 후보가 없어요")
                    continue
                errors += [f"{w} 신호{e}" for e in validate_signal_lines(cand_all[w])]
                errors += stale("signals", w, current.get(w))
                merged[w] = cand_all[w]
            writes.append((root / "data/signals.json", merged))
    if errors:
        print("적용하지 않았어요:")
        for e in errors:
            print(f"- {e}")
        return 1
    for path, data in writes:
        _write(path, data)
    print(f"적용했어요({part}): " + ", ".join(str(p.relative_to(root)) for p, _ in writes))
    return 0


async def _run_all(agent: AnalysisAgent, postings: list[dict]) -> dict[str, AnalysisResponse | str]:
    out: dict[str, AnalysisResponse | str] = {}
    for p in postings:
        try:
            out[p["wantedAuthNo"]] = await agent.run(AnalysisRequest(posting=p, job=JOB))
        except (LlmError, ApiError) as e:
            out[p["wantedAuthNo"]] = getattr(e, "code", "error")
        except Exception as e:  # 한 공고가 터져도 나머지는 계속한다. 글에 회사 정보가 섞일 수 있어 종류만 남긴다.
            out[p["wantedAuthNo"]] = type(e).__name__
    return out


def main(argv: list[str] | None = None, root: Path = ROOT, env: Mapping[str, str] | None = None,
         llm: Llm | None = None, http: httpx.AsyncClient | None = None, today: str | None = None) -> int:
    ap = argparse.ArgumentParser(prog="analysis:regen")
    ap.add_argument("--out", default="review/analysis-regen")
    ap.add_argument("--apply-candidates", choices=APPLY_PARTS)
    ap.add_argument("--ignore-base", action="store_true")
    ap.add_argument("--apply", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--only")
    args = ap.parse_args(argv)
    root = Path(root)
    if args.apply:
        # 다시 돌린 결과를 바로 쓰면 사람이 본 보고서와 다른 판정이 들어간다.
        print("--apply 는 없앴어요. 검토한 후보를 적용하려면 --apply-candidates analysis|signals|all 을 써요")
        return 2
    if args.apply_candidates:
        return apply_candidates(root, root / args.out, args.apply_candidates, args.only, args.ignore_base,
                                today or date.today().isoformat())
    env = env if env is not None else load_env(root)
    postings = [p for p in _read(root / "data/postings.json", []) if not args.only or p["wantedAuthNo"] == args.only]
    if not postings:
        print("대상 공고가 없어요")
        return 1
    agent = AnalysisAgent(llm or llm_from_env(env), root, env, http=http)
    results = asyncio.run(_run_all(agent, postings))
    cur_signals = _read(root / "data/signals.json", {})
    out_dir = root / args.out
    base = _read(out_dir / "base.json", None)
    base = base if isinstance(base, dict) else {}
    base = {"analysis": dict(base.get("analysis", {})), "signals": dict(base.get("signals", {}))}
    cand_signals, report, failed = {}, [report_header()], 0
    for p in postings:
        w, res = p["wantedAuthNo"], results[p["wantedAuthNo"]]
        if isinstance(res, str):
            failed += 1
            report.append(f"\n## {w}\n\n- 실패(code={res}): 후보를 만들지 못했어요\n")
            continue
        raw = _read(root / f"data/analysis/{w}.json", None)
        current = raw if isinstance(raw, dict) else {"cards": [], "blanks": []}
        cand = merge_candidate(current, res)
        cand_signals[w] = merge_signals(cur_signals.get(w, []), res.signals)
        base["analysis"][w], base["signals"][w] = fingerprint(raw), fingerprint(cur_signals.get(w))
        _write(out_dir / "analysis" / f"{w}.json", cand)
        report.append(report_section(w, current, cur_signals.get(w, []), res, cand_signals[w]))
    # 분석 후보 파일처럼, --only 로 일부만 다시 만들어도 앞서 만든 다른 공고의 신호 후보는 남긴다.
    prev = _read(out_dir / "signals.json", {})
    _write(out_dir / "signals.json", {**(prev if isinstance(prev, dict) else {}), **cand_signals})
    _write(out_dir / "base.json", base)
    (out_dir / "report.md").write_text("\n".join(report), encoding="utf-8")
    print(f"후보 {len(cand_signals)}건, 실패 {failed}건 -> {out_dir}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
