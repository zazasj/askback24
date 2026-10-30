import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from .nps import PensionFacts
from .resolve import CompanyRef

Source = Literal["실제", "모의"]


@dataclass
class CompanyData:
    reposting: dict | None = None
    pension: PensionFacts | None = None
    pension_source: Source | None = None
    giants: list[dict] = field(default_factory=list)
    giants_source: Source | None = None
    eis: dict | None = None  # {"rows": [...], "size_bands": [...]}
    wage_arrears: dict | None = None
    ind2: str | None = None  # demo.json 업종 중분류(국민연금 값이 없을 때 쓴다)
    sido: str | None = None
    mapped: bool = False  # 매핑 회사면 실제 값에 "가상 회사에 붙임" 문구가 붙는다


def _load(path: Path) -> Any:
    # 파일이 없거나 깨져도 그 자료만 빠지게 한다.
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _dict(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def _int(v: Any) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def _demo_pension(p: Any, ind2: str | None) -> PensionFacts | None:
    p = _dict(p)
    m, g, l = _int(p.get("members")), _int(p.get("gain_12m")), _int(p.get("loss_12m"))
    if m is None or g is None or l is None or not isinstance(p.get("period"), str):
        return None
    return PensionFacts(m, g, l, 12, p["period"], ind2)


def _giants(v: Any) -> list[dict]:
    if not isinstance(v, list):
        return []
    return [g for g in v if isinstance(g, dict) and isinstance(g.get("name"), str) and _int(g.get("year")) is not None]


def _sido(posting: dict) -> str | None:
    # 세종은 공통코드 시도 목록에 없어 지역 코드 앞 두 자리를 그대로 쓴다(eis.json 의 sido 와 같은 값)
    s = str(posting.get("regionCd") or "")[:2]
    return s if s.isascii() and s.isdigit() and len(s) == 2 and s != "00" else None


def company_data_from_files(ref: CompanyRef, posting: dict, root: Path) -> CompanyData:
    root = Path(root)
    demo = _dict(_dict(_load(root / "data/company/demo.json")).get(ref.wanted_auth_no))
    ind2 = demo.get("ind2") if isinstance(demo.get("ind2"), str) else None
    d = CompanyData(ind2=ind2, mapped=ref.kind == "mapped", sido=_sido(posting))

    rp = _dict(demo.get("reposting"))
    if _int(rp.get("count")) is not None and _int(rp.get("months")) is not None:
        d.reposting = {"count": rp["count"], "months": rp["months"]}
    d.pension = _demo_pension(demo.get("pension"), ind2)
    if d.pension:
        d.pension_source = "모의"
    wa = demo.get("wage_arrears")
    if isinstance(wa, dict):
        d.wage_arrears = wa

    d.giants, d.giants_source = _giants(demo.get("small_giant")), "모의"
    if ref.kind == "mapped":
        real = _giants(_dict(_load(root / "data/company/small-giants.demo.json")).get(ref.wanted_auth_no))
        if real:
            d.giants, d.giants_source = real, "실제"

    e = _dict(_load(root / "data/company/eis.json"))
    bands, rows = _dict(e.get("meta")).get("size_bands"), e.get("rows")
    if isinstance(bands, list) and isinstance(rows, list) and rows:
        d.eis = {"rows": rows, "size_bands": bands}
    return d
