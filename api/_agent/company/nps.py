import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import date
from urllib.parse import unquote
from xml.etree import ElementTree as ET

import httpx

from ..budget import NPS_BUDGET_S, NPS_CALL_TIMEOUT_S, NPS_CONCURRENCY
from .resolve import CompanyRef

_log = logging.getLogger("askback24.ai")

BASE = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2"
# 국민연금 오픈API V2 실제 응답(XML) 기준. 가이드와 다르면 이 표만 고친다.
FIELDS = {
    "search_name": "wkplNm",
    "search_biz": "bzowrRgstNo",
    "seq": "seq",
    "name": "wkplNm",
    "biz": "bzowrRgstNo",
    "place": ("ldongAddrMgplDgCd", "ldongAddrMgplSgguCd", "ldongAddrMgplSgguEmdCd"),
    "members": "jnngpCnt",
    "industry": "wkplIntpCd",
    "gain": "nwAcqzrCnt",
    "loss": "lssJnngpCnt",
    "ym": "dataCrtYm",
}
MIN_MONTHS = 9
_NOISE = re.compile(r"\(주\)|㈜|주식회사|\s+")


@dataclass(frozen=True)
class PensionFacts:
    members: int
    gain_12m: int
    loss_12m: int
    months: int
    period: str
    ind2: str | None


def _norm(name: object) -> str:
    return _NOISE.sub("", str(name or ""))


def _items(content: bytes) -> list[dict[str, str]]:
    root = ET.fromstring(content)
    if (root.findtext("header/resultCode") or "").strip() != "00":
        raise ValueError("result")
    return [{c.tag: (c.text or "").strip() for c in it} for it in root.findall("body/items/item")]


def _int(v: object) -> int:
    return int(str(v).strip())


async def _call(client: httpx.AsyncClient, op: str, key: str, params: dict) -> list[dict[str, str]]:
    r = await asyncio.wait_for(
        client.get(f"{BASE}/{op}", params={"serviceKey": key, **params}, timeout=NPS_CALL_TIMEOUT_S),
        NPS_CALL_TIMEOUT_S,
    )
    r.raise_for_status()
    return _items(r.content)


def _digits6(v: object) -> str:
    # 사업자번호는 가려서 오므로 숫자 앞 6자리만 견준다.
    return re.sub(r"\D", "", str(v or ""))[:6]


async def _fetch(ref: CompanyRef, key: str, client: httpx.AsyncClient, today: date) -> PensionFacts | None:
    # today는 호출부 계약으로만 남긴다. 달 범위는 자료의 dataCrtYm에서 정한다.
    if not ref.name or not ref.biz_no:
        return None
    prefix = ref.biz_no[:6]
    found = await _call(
        client,
        "getBassInfoSearchV2",
        key,
        {FIELDS["search_name"]: ref.name, FIELDS["search_biz"]: prefix, "numOfRows": 100, "pageNo": 1},
    )
    want = _norm(ref.name)
    rows = [
        i
        for i in found
        if _norm(i.get(FIELDS["name"])) == want and _digits6(i.get(FIELDS["biz"])) == prefix and i.get(FIELDS["ym"]) and i.get(FIELDS["seq"])
    ]
    if not rows:
        return None

    def wk(i: dict) -> tuple:
        return (_norm(i[FIELDS["name"]]), *(i.get(f, "") for f in FIELDS["place"]))

    latest = max(i[FIELDS["ym"]] for i in rows)
    if len({wk(i) for i in rows if i[FIELDS["ym"]] == latest}) != 1:
        return None
    target = wk(next(i for i in rows if i[FIELDS["ym"]] == latest))
    mine = [i for i in rows if wk(i) == target]
    by_ym: dict[str, dict] = {}
    for i in mine:
        if i[FIELDS["ym"]] in by_ym:  # 같은 달 줄이 둘이면 어느 쪽인지 알 수 없다
            return None
        by_ym[i[FIELDS["ym"]]] = i
    yms = sorted(by_ym)[-12:]

    detail = await _call(client, "getDetailInfoSearchV2", key, {FIELDS["seq"]: by_ym[latest][FIELDS["seq"]]})
    if not detail:
        return None
    members = _int(detail[0][FIELDS["members"]])
    ind = detail[0].get(FIELDS["industry"], "").strip()
    ind2 = ind[:2] if len(ind) >= 2 else None

    sem = asyncio.Semaphore(NPS_CONCURRENCY)

    async def one(ym: str) -> dict | None:
        async with sem:
            got = await _call(client, "getPdAcctoSttusInfoSearchV2", key, {FIELDS["seq"]: by_ym[ym][FIELDS["seq"]]})
        return got[0] if got else None

    res = await asyncio.gather(*(one(ym) for ym in yms))
    used = [(ym, r) for ym, r in zip(yms, res) if r is not None]
    if len(used) < MIN_MONTHS:
        return None
    first, last = used[0][0], used[-1][0]
    return PensionFacts(
        members=members,
        gain_12m=sum(_int(r[FIELDS["gain"]]) for _, r in used),
        loss_12m=sum(_int(r[FIELDS["loss"]]) for _, r in used),
        months=len(used),
        period=f"{first[:4]}년 {int(first[4:])}월~{last[:4]}년 {int(last[4:])}월",
        ind2=ind2,
    )


async def fetch_pension(ref: CompanyRef, key: str, client: httpx.AsyncClient, today: date) -> PensionFacts | None:
    if ref.kind == "demo":
        return None
    # data.go.kr의 Encoding 키(%2B 등)를 그대로 넘기면 httpx가 다시 인코딩하므로 한 번 풀어 둔다.
    key = unquote(key)
    try:
        return await asyncio.wait_for(_fetch(ref, key, client, today), NPS_BUDGET_S)
    except Exception as e:
        # 예외 글에 키·이름·번호가 섞일 수 있어 종류만 남긴다.
        _log.info("[ai] nps %s", "timeout" if isinstance(e, (asyncio.TimeoutError, httpx.TimeoutException)) else "failed")
        return None
