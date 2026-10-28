import json
import logging
import re
from dataclasses import dataclass
from typing import Literal, Mapping

_log = logging.getLogger("askback24.ai")


@dataclass(frozen=True)
class CompanyRef:
    wanted_auth_no: str
    kind: Literal["mapped", "biz_no", "demo"]
    name: str | None = None
    biz_no: str | None = None

    # 로그나 예외에 실수로 찍혀도 이름·번호가 새지 않게 가린다.
    def __repr__(self) -> str:
        return f"CompanyRef(kind={self.kind!r}, …)"


def _digits10(v: object) -> str | None:
    if not isinstance(v, str):
        return None
    d = re.sub(r"\D", "", v)
    return d if len(d) == 10 else None


def load_company_map(env: Mapping[str, str]) -> dict[str, tuple[str, str]]:
    raw = env.get("REAL_COMPANY_MAP")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except ValueError:
        data = None
    if not isinstance(data, dict):
        _log.info("[ai] company map invalid")
        return {}
    out: dict[str, tuple[str, str]] = {}
    for key, v in data.items():
        if not isinstance(v, dict):
            continue
        name, biz = v.get("name"), _digits10(v.get("bizNo"))
        if isinstance(name, str) and name.strip() and biz:
            out[str(key)] = (name.strip(), biz)
    return out


def resolve_company(posting: dict, env: Mapping[str, str]) -> CompanyRef:
    no = str(posting.get("wantedAuthNo", ""))
    mapped = load_company_map(env).get(no)
    if mapped:
        return CompanyRef(no, "mapped", mapped[0], mapped[1])
    biz = _digits10(posting.get("bizNo"))
    if biz:
        return CompanyRef(no, "biz_no", None, biz)
    return CompanyRef(no, "demo", None, None)
