"""정답 시트(CSV) 검사. 오류는 모아서 한 번에 알린다. 실제 시트는 evals/data/sheet/ 에만 둔다(git 밖)."""
import csv
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from evals.postings import PostingError, load_postings

EVIDENCE_FIELDS = (
    "jobCont", "pfCond", "etcPfCond", "empTpNm", "salTpNm", "sal", "workdayWorkhrCont", "etcWelfare",
)
STATES = ("explicit", "inferred", "vague", "absent")
BLANK_STATUSES = ("missing", "vague", "check", "present")
TOPICS = ("sal", "workHours", "probation", "onsite")
EXPECTED = ("confirmed", "mismatch", "still_unknown")

_ROOT = Path(__file__).resolve().parents[1]
_COLUMNS = {
    "cards.csv": ("wantedAuthNo", "card_id", "state", "field", "note", "labeler", "use"),
    "blanks.csv": ("wantedAuthNo", "topic", "status", "field", "note", "labeler", "use"),
    "judgements.csv": ("wantedAuthNo", "card_id", "question", "heard", "pref", "expected", "labeler"),
}


@dataclass
class GoldCard:
    state: str
    field: str | None


@dataclass
class GoldJudgement:
    wantedAuthNo: str
    card_id: str
    question: str
    heard: str
    pref: str
    expected: str


@dataclass
class Gold:
    cards: dict[tuple[str, str], GoldCard]
    blanks: dict[tuple[str, str], str]
    overlap: dict[tuple[str, str], dict[str, str]]
    judgements: list[GoldJudgement]


class GoldError(Exception):
    def __init__(self, messages: list[str]):
        super().__init__("\n".join(messages))
        self.messages = messages


def card_ids() -> set[str]:
    data = json.loads((_ROOT / "data" / "cards.backend.json").read_text(encoding="utf-8"))
    return {c["id"] for c in data["cards"]}


def _rows(dir: Path, name: str, errors: list[str]) -> list[tuple[int, dict[str, str]]]:
    path = dir / name
    if not path.exists():
        errors.append(f"{name}: 파일이 없습니다")
        return []
    # utf-8-sig: 엑셀이 붙이는 BOM 제거. newline="": CRLF·따옴표 안 줄바꿈을 csv가 처리
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = [c for c in _COLUMNS[name] if c not in (reader.fieldnames or [])]
        if missing:
            errors.append(f"{name} 1행: 열이 없습니다: {', '.join(missing)}")
            return []
        out = []
        for row in reader:
            clean = {k: (v or "").strip() for k, v in row.items() if k is not None}
            if any(clean.values()):  # 엑셀이 남기는 빈 줄(,,,,)은 건너뜀
                out.append((reader.line_num, clean))
        return out


def _check_ref(name, line, r, posting_ids, card_ids, errors):
    ok = True
    if r["wantedAuthNo"] not in posting_ids:
        errors.append(f"{name} {line}행: 공고 목록에 없는 wantedAuthNo {r['wantedAuthNo']!r}")
        ok = False
    if "card_id" in r and r["card_id"] not in card_ids:
        errors.append(f"{name} {line}행: 카드 사전에 없는 card_id {r['card_id']!r}")
        ok = False
    return ok


def _check_field(name, line, r, status_key, needs_field, errors):
    f = r["field"]
    if f and f not in EVIDENCE_FIELDS:
        errors.append(f"{name} {line}행: field는 {'·'.join(EVIDENCE_FIELDS)} 중 하나여야 합니다 ({f!r})")
        return False
    if needs_field and not f:
        errors.append(f"{name} {line}행: {r[status_key]}는 field가 필요합니다")
        return False
    return True


def _use(name, line, r, errors) -> bool | None:
    u = r["use"].upper()
    if u not in ("Y", "N", ""):
        errors.append(f"{name} {line}행: use는 Y 또는 N이어야 합니다 ({r['use']!r})")
        return None
    return u == "Y"


def read_gold(dir: Path, posting_ids: set[str], card_ids: set[str]) -> Gold:
    errors: list[str] = []

    cards: dict[tuple[str, str], GoldCard] = {}
    use_count: dict[tuple[str, str], int] = {}
    by_labeler: dict[tuple[str, str], dict[str, str]] = {}
    for line, r in _rows(dir, "cards.csv", errors):
        ok = _check_ref("cards.csv", line, r, posting_ids, card_ids, errors)
        if r["state"] not in STATES:
            errors.append(f"cards.csv {line}행: state는 {'·'.join(STATES)} 중 하나여야 합니다 ({r['state']!r})")
            ok = False
        elif not _check_field("cards.csv", line, r, "state", r["state"] in ("explicit", "vague"), errors):
            ok = False
        use = _use("cards.csv", line, r, errors)
        if not ok or use is None:
            continue
        key = (r["wantedAuthNo"], r["card_id"])
        if r["labeler"]:
            by_labeler.setdefault(key, {})[r["labeler"]] = r["state"]
        if use:
            use_count[key] = use_count.get(key, 0) + 1
            cards[key] = GoldCard(r["state"], r["field"] or None)
    for pid in sorted(posting_ids):
        for cid in sorted(card_ids):
            n = use_count.get((pid, cid), 0)
            if n == 0:
                errors.append(f"{pid} {cid}: 정답 줄 없음")
            elif n > 1:
                errors.append(f"{pid} {cid}: use=Y 줄이 {n}개 (하나여야 합니다)")
    overlap = {k: v for k, v in by_labeler.items() if len(v) > 1}

    blanks: dict[tuple[str, str], str] = {}
    blank_use: dict[tuple[str, str], int] = {}
    for line, r in _rows(dir, "blanks.csv", errors):
        ok = _check_ref("blanks.csv", line, r, posting_ids, card_ids, errors)
        if r["topic"] not in TOPICS:
            errors.append(f"blanks.csv {line}행: topic은 {'·'.join(TOPICS)} 중 하나여야 합니다 ({r['topic']!r})")
            ok = False
        if r["status"] not in BLANK_STATUSES:
            errors.append(f"blanks.csv {line}행: status는 {'·'.join(BLANK_STATUSES)} 중 하나여야 합니다 ({r['status']!r})")
            ok = False
        if not _check_field("blanks.csv", line, r, "status", False, errors):
            ok = False
        use = _use("blanks.csv", line, r, errors)
        if ok and use:
            key = (r["wantedAuthNo"], r["topic"])
            blank_use[key] = blank_use.get(key, 0) + 1
            blanks[key] = r["status"]
    for pid in sorted(posting_ids):
        for t in TOPICS:
            n = blank_use.get((pid, t), 0)
            if n == 0:
                errors.append(f"{pid} {t}: 처우 정답 줄 없음")
            elif n > 1:
                errors.append(f"{pid} {t}: 처우 use=Y 줄이 {n}개 (하나여야 합니다)")

    judgements: list[GoldJudgement] = []
    for line, r in _rows(dir, "judgements.csv", errors):
        ok = _check_ref("judgements.csv", line, r, posting_ids, card_ids, errors)
        if r["expected"] not in EXPECTED:
            errors.append(f"judgements.csv {line}행: expected는 {'·'.join(EXPECTED)} 중 하나여야 합니다 ({r['expected']!r})")
            ok = False
        if not r["heard"]:
            errors.append(f"judgements.csv {line}행: heard가 비어 있습니다")
            ok = False
        if ok:
            judgements.append(GoldJudgement(
                r["wantedAuthNo"], r["card_id"], r["question"], r["heard"], r["pref"], r["expected"]
            ))

    if errors:
        raise GoldError(errors)
    return Gold(cards, blanks, overlap, judgements)


def _dump(g: Gold) -> dict:
    return {
        "cards": [{"wantedAuthNo": p, "card_id": c, **asdict(v)} for (p, c), v in sorted(g.cards.items())],
        "blanks": [{"wantedAuthNo": p, "topic": t, "status": s} for (p, t), s in sorted(g.blanks.items())],
        "overlap": [{"wantedAuthNo": p, "card_id": c, "labelers": v} for (p, c), v in sorted(g.overlap.items())],
        "judgements": [asdict(j) for j in g.judgements],
    }


def main(data_dir: Path | None = None) -> int:
    data = data_dir or _ROOT / "evals" / "data"
    try:
        postings = load_postings(data / "postings")
        g = read_gold(data / "sheet", set(postings), card_ids())
    except PostingError as e:
        print(f"공고 {e}")
        return 1
    except GoldError as e:
        for m in e.messages:
            print(m)
        return 1
    (data / "gold.json").write_text(
        json.dumps(_dump(g), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    n_overlap = len({p for p, _ in g.overlap})
    print(f"정답 {len(g.cards)}칸 · 처우 {len(g.blanks)}칸 · 판정 {len(g.judgements)}줄 · 겹친 공고 {n_overlap}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
