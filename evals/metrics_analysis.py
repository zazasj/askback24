"""① 공고 분석 지표. 정답표와 결과를 칸(공고 × 카드) 단위로 비교한다."""
import math
from itertools import combinations

from api._agent.checks import squash

from evals.gold import STATES, Gold

_FABRICATED = ("explicit", "vague")


def _rate(num: int, den: int) -> float | None:
    return num / den if den else None


def _kappa(pairs: list[tuple[str, str]]) -> float | None:
    n = len(pairs)
    if not n:
        return None
    po = sum(a == b for a, b in pairs) / n
    pe = sum((sum(a == s for a, _ in pairs) / n) * (sum(b == s for _, b in pairs) / n) for s in STATES)
    if pe == 1:  # 두 사람이 한 가지 상태만 썼을 때 0으로 나누지 않는다
        return 1.0 if po == 1 else 0.0
    return (po - pe) / (1 - pe)


def _human(gold: Gold) -> tuple[float | None, float | None]:
    pairs = [
        (states[a], states[b])
        for states in gold.overlap.values()
        for a, b in combinations(sorted(states), 2)
    ]
    counted = [p for p in pairs if p != ("absent", "absent")]
    return _rate(sum(a == b for a, b in counted), len(counted)), _kappa(pairs)


def _p95(values: list[float]) -> float | None:
    if not values:
        return None
    s = sorted(values)
    return s[math.ceil(0.95 * len(s)) - 1]  # 가장 가까운 순위 방식


def analysis_metrics(gold: Gold, outs: dict[str, dict | str], postings: dict[str, dict], elapsed: list[float]) -> dict:
    done = {pid: o for pid, o in outs.items() if isinstance(o, dict)}
    cards = {pid: {c["card_id"]: c for c in o["cards"]} for pid, o in done.items()}
    confusion = {g: {r: 0 for r in STATES} for g in STATES}
    fabricated = missed = 0
    non_absent = non_absent_ok = 0
    quotes = quotes_ok = field_den = field_ok = 0
    cells = [(k, v) for k, v in sorted(gold.cards.items()) if k[0] in done]
    for (pid, cid), g in cells:
        res = cards[pid].get(cid)  # 파일에 없는 카드는 absent (shared/rules.ts)
        state = res["state"] if res else "absent"
        confusion[g.state][state] += 1
        fabricated += g.state == "absent" and state in _FABRICATED
        missed += g.state == "explicit" and state == "absent"
        if g.state != "absent" or state != "absent":
            non_absent += 1
            non_absent_ok += g.state == state
        ev = res.get("evidence") if res else None
        if ev:
            quotes += 1
            quotes_ok += squash(ev["quote"]).strip() in squash(str(postings.get(pid, {}).get(ev["field"], "")))
            if g.state in ("explicit", "vague"):
                field_den += 1
                field_ok += ev["field"] == g.field
    per_state = {}
    for s in STATES:
        tp = confusion[s][s]
        per_state[s] = {
            "precision": _rate(tp, sum(confusion[g][s] for g in STATES)),
            "recall": _rate(tp, sum(confusion[s].values())),
        }
    blanks = [(k, v) for k, v in sorted(gold.blanks.items()) if k[0] in done]
    blanks_ok = 0
    for (pid, topic), status in blanks:
        got = {b["topic"]: b["status"] for b in done[pid]["blanks"]}.get(topic, "present")
        blanks_ok += got == status
    agreement, kappa = _human(gold)
    return {
        "human_agreement": agreement,
        "human_kappa": kappa,
        "accuracy_non_absent": _rate(non_absent_ok, non_absent),
        "per_state": per_state,
        "confusion": confusion,
        "fabricated": fabricated,
        "missed": missed,
        "quote_exists": _rate(quotes_ok, quotes),
        "field_match": _rate(field_ok, field_den),
        "blanks_accuracy": _rate(blanks_ok, len(blanks)),
        "latency_p95_s": _p95(elapsed),
        "failed": len(outs) - len(done),
    }
