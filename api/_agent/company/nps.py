import asyncio
import logging
from dataclasses import dataclass
from datetime import date

import httpx

from ..budget import NPS_BUDGET_S, NPS_CALL_TIMEOUT_S, NPS_CONCURRENCY
from .resolve import CompanyRef

_log = logging.getLogger("askback24.ai")

BASE = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2"
# 국민연금 오픈API 활용가이드 v2.0 기준. 가이드와 다르면 이 표만 고친다.
FIELDS = {
    "search_name": "wkpl_nm",
    "search_biz": "bzowr_rgst_no",
    "seq": "seq",
    "members": "jnngpCnt",
    "industry": "wkplIntpCd",
    "gain": "nwAcqzrCnt",
    "loss": "lssJnngpCnt",
    "ym": "data_crt_ym",
}
MIN_MONTHS = 9


@dataclass(frozen=True)
class PensionFacts:
    members: int
    gain_12m: int
    loss_12m: int
    months: int
    period: str
    ind2: str | None


def _months(today: date) -> list[tuple[int, int]]:
    # 자료가 늦게 올라와 이번 달의 2달 전에서 끝낸다.
    idx = today.year * 12 + (today.month - 1) - 2
    return [divmod(idx - i, 12) for i in range(11, -1, -1)]  # (연, 월-1) 오래된 순


def _items(data: object) -> list[dict]:
    if not isinstance(data, dict):
        raise ValueError("shape")
    resp = data.get("response")
    header = resp.get("header") if isinstance(resp, dict) else None
    if not isinstance(header, dict) or str(header.get("resultCode")) != "00":
        raise ValueError("result")
    body = resp.get("body")
    items = body.get("items") if isinstance(body, dict) else None
    if not items:  # 빈 문자열이나 없음
        return []
    item = items.get("item") if isinstance(items, dict) else None
    if item is None or item == "":
        return []
    if isinstance(item, dict):
        return [item]
    if isinstance(item, list):
        return [i for i in item if isinstance(i, dict)]
    raise ValueError("shape")


def _int(v: object) -> int:
    return int(str(v).strip())


async def _call(client: httpx.AsyncClient, op: str, key: str, params: dict) -> list[dict]:
    r = await asyncio.wait_for(
        client.get(
            f"{BASE}/{op}",
            params={"serviceKey": key, "_type": "json", **params},
            timeout=NPS_CALL_TIMEOUT_S,
        ),
        NPS_CALL_TIMEOUT_S,
    )
    r.raise_for_status()
    return _items(r.json())


async def _fetch(ref: CompanyRef, key: str, client: httpx.AsyncClient, today: date) -> PensionFacts | None:
    if not ref.name or not ref.biz_no:
        return None
    prefix = ref.biz_no[:6]
    found = await _call(
        client,
        "getBassInfoSearchV2",
        key,
        {FIELDS["search_name"]: ref.name, FIELDS["search_biz"]: prefix, "numOfRows": 10, "pageNo": 1},
    )
    found = [i for i in found if str(i.get(FIELDS["search_biz"], prefix)).startswith(prefix)]
    if len(found) != 1 or FIELDS["seq"] not in found[0]:
        return None
    seq = found[0][FIELDS["seq"]]
    detail = await _call(client, "getDetailInfoSearchV2", key, {FIELDS["seq"]: seq, "numOfRows": 1, "pageNo": 1})
    if not detail:
        return None
    members = _int(detail[0][FIELDS["members"]])
    ind = detail[0].get(FIELDS["industry"])
    ind2 = str(ind).strip()[:2] if ind not in (None, "") and len(str(ind).strip()) >= 2 else None

    months = _months(today)
    sem = asyncio.Semaphore(NPS_CONCURRENCY)

    async def one(y: int, m0: int) -> dict | None:
        async with sem:
            rows = await _call(
                client,
                "getPdAcctoSttusInfoSearchV2",
                key,
                {FIELDS["seq"]: seq, FIELDS["ym"]: f"{y}{m0 + 1:02d}", "numOfRows": 1, "pageNo": 1},
            )
        return rows[0] if rows else None

    rows = await asyncio.gather(*(one(y, m0) for y, m0 in months))
    got = [r for r in rows if r is not None]
    if len(got) < MIN_MONTHS:
        return None
    (y0, m0), (y1, m1) = months[0], months[-1]
    return PensionFacts(
        members=members,
        gain_12m=sum(_int(r[FIELDS["gain"]]) for r in got),
        loss_12m=sum(_int(r[FIELDS["loss"]]) for r in got),
        months=len(got),
        period=f"{y0}년 {m0 + 1}월~{y1}년 {m1 + 1}월",
        ind2=ind2,
    )


async def fetch_pension(ref: CompanyRef, key: str, client: httpx.AsyncClient, today: date) -> PensionFacts | None:
    if ref.kind == "demo":
        return None
    try:
        return await asyncio.wait_for(_fetch(ref, key, client, today), NPS_BUDGET_S)
    except Exception as e:
        # 예외 글에 키·이름·번호가 섞일 수 있어 종류만 남긴다.
        _log.info("[ai] nps %s", "timeout" if isinstance(e, (asyncio.TimeoutError, httpx.TimeoutException)) else "failed")
        return None
