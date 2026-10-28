from dataclasses import dataclass

from .sources import Unit

# 수준이 높으면 신입 카드에 어울리지 않을 수 있어 표시만 하고 검수자가 판단한다.
HIGH_LEVEL_MIN = 6


@dataclass
class Candidate:
    ablt_unit: str
    unit: str
    subcategory: str
    level: int | None
    high_level: bool
    recommended: bool
    used_in: str | None = None


def build_candidates(units: list[Unit], recommended: list[Unit]) -> list[Candidate]:
    out: list[Candidate] = []
    seen: set[str] = set()
    rec_codes = {r.code for r in recommended}
    # 세분류 목록 먼저, 215L01 추천에만 있는 것은 뒤에 보강한다.
    for u in [*units, *recommended]:
        if u.code in seen:
            continue
        seen.add(u.code)
        out.append(
            Candidate(
                ablt_unit=u.code,
                unit=u.name,
                subcategory=u.subcategory,
                level=u.level,
                high_level=u.level is not None and u.level >= HIGH_LEVEL_MIN,
                recommended=u.code in rec_codes,
            )
        )
    return out
