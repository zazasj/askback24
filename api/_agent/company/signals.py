import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from ..schemas import SignalKind
from .data import CompanyData, Source

_TEMPLATES = Path(__file__).resolve().parents[3] / "data/company/signal-templates.json"
MIN_MEMBERS = 10
MIN_EIS_INSURED = 1000


@dataclass
class SignalFact:
    kind: SignalKind
    text: str
    source: Source
    source_name: str
    caveat: str | None
    ask_hint: str | None
    template_ask: str | None


@lru_cache(maxsize=1)
def _templates() -> dict:
    return json.loads(_TEMPLATES.read_text(encoding="utf-8"))


def _fill(s: str, **kw: object) -> str:
    for k, v in kw.items():
        s = s.replace("{" + k + "}", str(v))
    return s


def _fact(kind: SignalKind, text: str, source: Source, caveat: str | None, ask: bool = True) -> SignalFact:
    t = _templates()[kind]
    return SignalFact(kind, text, source, t["source_name"], caveat,
                      t.get("ask_hint") if ask else None, t.get("template_ask") if ask else None)


def _size_label(posting: dict, bands: list) -> str | None:
    try:
        n = int(str(posting.get("totPsncnt")).strip())
    except ValueError:
        return None
    for b in bands:
        if isinstance(b, dict) and isinstance(b.get("min"), int) and n >= b["min"] \
                and (b.get("max") is None or n <= b["max"]):
            return b.get("label")
    return None


def _eis_row(posting: dict, data: CompanyData) -> tuple[dict, bool] | None:
    ind2 = data.pension.ind2 if data.pension and data.pension.ind2 else data.ind2
    if not ind2 or not data.eis:
        return None
    size = _size_label(posting, data.eis["size_bands"])
    if not size:
        return None

    def find(sido: str | None) -> dict | None:
        for r in data.eis["rows"]:
            if isinstance(r, dict) and r.get("ind2") == ind2 and r.get("size") == size and r.get("sido") == sido:
                return r
        return None

    local = find(data.sido) if data.sido else None
    if local and isinstance(local.get("insured"), (int, float)) and local["insured"] >= MIN_EIS_INSURED:
        return local, False
    nation = find("전국")
    return (nation, True) if nation else None


def build_signal_facts(posting: dict, data: CompanyData) -> list[SignalFact]:
    tpl = _templates()
    out: list[SignalFact] = []

    rp = data.reposting
    if rp and rp["months"] <= 6 and rp["count"] >= 3:
        t = tpl["reposting"]
        out.append(_fact("reposting", _fill(t["text"], months=rp["months"], count=rp["count"]),
                         "모의", t["caveat"]))

    p = data.pension
    if p and data.pension_source and p.members >= MIN_MEMBERS and p.loss_12m > p.gain_12m:
        t = tpl["pension_flow"]
        mapped = data.pension_source == "실제" and data.mapped
        cav = t["caveat_mapped"] if mapped else t["caveat"]
        out.append(_fact("pension_flow", t["text"], data.pension_source, _fill(cav, period=p.period)))

    found = _eis_row(posting, data)
    if found:
        row, nation = found
        t = tpl["industry_baseline"]
        text = _fill(t["text_nation"] if nation else t["text"],
                     rate=f"{float(row['loss_rate']) * 100:.1f}", net=int(row["net"]))
        out.append(_fact("industry_baseline", text, "실제", t["caveat"]))

    t = tpl["small_giant"]
    for g in data.giants:
        mapped = data.giants_source == "실제"
        out.append(_fact("small_giant", _fill(t["text"], name=g["name"], year=g["year"]),
                         data.giants_source or "모의", t["caveat_mapped"] if mapped else t["caveat"], ask=False))

    if data.wage_arrears and data.wage_arrears.get("listed") is True:
        t = tpl["wage_arrears"]
        out.append(_fact("wage_arrears", t["text"], "모의", t["caveat"]))
    return out
