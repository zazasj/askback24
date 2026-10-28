import asyncio
import json
from datetime import date
from pathlib import Path

import httpx

from _agent.company import nps
from _agent.company.resolve import CompanyRef

FX = Path(__file__).parent / "fixtures" / "nps"
KEY = "FAKE-KEY-abc123%2B"
TODAY = date(2026, 4, 15)  # 2달 전 = 2026-02, 12개월 = 2025-03 ~ 2026-02
REF = CompanyRef("K-MOCK-0001", "mapped", "(주)테스트실제", "0000000000")


def fx(name: str) -> dict:
    return json.loads((FX / name).read_text(encoding="utf-8"))


def make_client(handler):
    calls: list[httpx.Request] = []

    def h(req: httpx.Request):
        calls.append(req)
        return handler(req)

    return httpx.AsyncClient(transport=httpx.MockTransport(h)), calls


def standard(missing_months: set[str] = frozenset(), basic=None):
    def handler(req: httpx.Request):
        op = req.url.path.rsplit("/", 1)[-1]
        if op == "getBassInfoSearchV2":
            return httpx.Response(200, json=basic or fx("basic.json"))
        if op == "getDetailInfoSearchV2":
            return httpx.Response(200, json=fx("detail.json"))
        ym = req.url.params["data_crt_ym"]
        if ym in missing_months:
            return httpx.Response(200, json={"response": {"header": {"resultCode": "00"}, "body": {"items": "", "totalCount": 0}}})
        return httpx.Response(200, json=fx("monthly.json"))

    return handler


async def test_fetch_pension_sums_12_months():
    client, calls = make_client(standard())
    facts = await nps.fetch_pension(REF, KEY, client, TODAY)
    assert facts == nps.PensionFacts(members=42, gain_12m=36, loss_12m=12, months=12, period="2025년 3월~2026년 2월", ind2="58")
    assert len(calls) == 14
    assert all(c.url.params["serviceKey"] == "FAKE-KEY-abc123+" and c.url.params["_type"] == "json" for c in calls)


async def test_search_not_exactly_one_drops():
    empty = {"response": {"header": {"resultCode": "00"}, "body": {"items": "", "totalCount": 0}}}
    item = fx("basic.json")["response"]["body"]["items"]["item"][0]
    two = {"response": {"header": {"resultCode": "00"}, "body": {"items": {"item": [item, {**item, "seq": 1002}]}, "totalCount": 2}}}
    for basic in (empty, two):
        client, calls = make_client(standard(basic=basic))
        assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
        assert len(calls) == 1


async def test_nps_timeout_drops_source(monkeypatch):
    monkeypatch.setattr(nps, "NPS_BUDGET_S", 0.3)

    async def hang(req: httpx.Request):
        if req.url.path.endswith("getPdAcctoSttusInfoSearchV2"):
            await asyncio.sleep(10)
        return standard()(req)

    client, _ = make_client(hang)
    loop = asyncio.get_running_loop()
    t0 = loop.time()
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    assert loop.time() - t0 < 2


async def test_too_few_months_drops():
    client, _ = make_client(standard(missing_months={"202503", "202504", "202505", "202506"}))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    client, _ = make_client(standard(missing_months={"202503", "202504", "202505"}))
    facts = await nps.fetch_pension(REF, KEY, client, TODAY)
    assert facts is not None and facts.months == 9


async def test_demo_ref_makes_no_call():
    client, calls = make_client(standard())
    assert await nps.fetch_pension(CompanyRef("K-MOCK-0002", "demo"), KEY, client, TODAY) is None
    assert calls == []


async def test_query_uses_biz_prefix_6():
    client, calls = make_client(standard())
    await nps.fetch_pension(REF, KEY, client, TODAY)
    q = calls[0].url.params
    assert q["bzowr_rgst_no"] == "000000" and q["wkpl_nm"] == "(주)테스트실제"


async def test_item_shapes_and_bad_result_code():
    item = fx("basic.json")["response"]["body"]["items"]["item"][0]
    single = {"response": {"header": {"resultCode": "00"}, "body": {"items": {"item": item}, "totalCount": 1}}}
    client, _ = make_client(standard(basic=single))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is not None
    bad = {"response": {"header": {"resultCode": "30", "resultMsg": "SERVICE KEY ERROR"}}}
    client, calls = make_client(lambda r: httpx.Response(200, json=bad))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    assert len(calls) == 1


async def test_key_not_in_errors(ai_log):
    def boom(req: httpx.Request):
        raise httpx.ConnectError(f"fail {req.url}")

    client, _ = make_client(boom)
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    text = ai_log.text
    assert "[ai] nps failed" in text
    for secret in (KEY, "FAKE-KEY", "테스트실제", "0000000000", "000000"):
        assert secret not in text


async def test_encoding_and_decoding_key_send_same_service_key():
    sent = []
    for k in ("abc%2Bdef", "abc+def"):
        client, calls = make_client(standard())
        await nps.fetch_pension(REF, k, client, TODAY)
        q = calls[0].url.query.decode()
        assert "serviceKey=abc%2Bdef" in q and "%252B" not in q
        sent.append(q.split("serviceKey=")[1].split("&")[0])
    assert sent[0] == sent[1]


async def test_search_filters_to_single_prefix_match():
    item = fx("basic.json")["response"]["body"]["items"]["item"][0]
    other = {**item, "seq": 1002, "bzowr_rgst_no": "999999"}
    nobiz = {"seq": 1003, "wkpl_nm": "x"}
    resp = {"response": {"header": {"resultCode": "00"}, "body": {"items": {"item": [item, other, nobiz]}, "totalCount": 3}}}
    client, _ = make_client(standard(basic=resp))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is not None
