import asyncio
import re
from datetime import date

import httpx

from _agent.company import nps
from _agent.company.resolve import CompanyRef

KEY = "FAKE-KEY-abc123%2B"
TODAY = date(2026, 10, 30)  # 달 범위는 자료에서 정해지므로 값은 상관없다
REF = CompanyRef("K-MOCK-0001", "mapped", "OO소프트(주)", "0000000000")
YMS = [f"2025{m:02d}" for m in range(10, 13)] + [f"2026{m:02d}" for m in range(1, 10)]  # 12개월


def wrap(items: str, code: str = "00", total: int = 0) -> httpx.Response:
    body = f"<items>{items}</items>" if items else "<items/>"
    xml = (
        f"<response><header><resultCode>{code}</resultCode><resultMsg>X</resultMsg></header>"
        f"<body>{body}<numOfRows>100</numOfRows><pageNo>1</pageNo><totalCount>{total}</totalCount></body></response>"
    )
    return httpx.Response(200, content=xml.encode("utf-8"), headers={"content-type": "application/xml"})


def row(seq: int, ym: str, name: str = "OO소프트(주)", emd: str = "101", biz: str = "000000****") -> str:
    return (
        f"<item><bzowrRgstNo>{biz}</bzowrRgstNo><dataCrtYm>{ym}</dataCrtYm><ldongAddrMgplDgCd>11</ldongAddrMgplDgCd>"
        f"<ldongAddrMgplSgguCd>680</ldongAddrMgplSgguCd><ldongAddrMgplSgguEmdCd>{emd}</ldongAddrMgplSgguEmdCd>"
        f"<seq>{seq}</seq><wkplJnngStcd>1</wkplJnngStcd><wkplNm>{name}</wkplNm><wkplStylDvcd>1</wkplStylDvcd></item>"
    )


def make_client(handler):
    calls: list[httpx.Request] = []

    def h(req: httpx.Request):
        calls.append(req)
        return handler(req)

    return httpx.AsyncClient(transport=httpx.MockTransport(h)), calls


def standard(basic: str | None = None, empty_seqs: set[str] = frozenset(), name: str = "OO소프트(주)", gain: int = 3, loss: int = 1):
    # 달 i의 seq는 100+i. 옛 달(앞 3개월)에만 주소가 다른 같은 이름 사업장이 있다.
    if basic is None:
        basic = "".join(row(100 + i, ym, name=name) for i, ym in enumerate(YMS))
        basic += "".join(row(900 + i, ym, name=name, emd="999") for i, ym in enumerate(YMS[:3]))

    def handler(req: httpx.Request):
        op = req.url.path.rsplit("/", 1)[-1]
        if op == "getBassInfoSearchV2":
            # 서버처럼 보낸 이름이 사업장 이름에 들어 있는 줄만 돌려준다.
            q = req.url.params["wkplNm"]
            rows = re.findall(r"<item>.*?</item>", basic)
            return wrap("".join(r for r in rows if q in re.search(r"<wkplNm>(.*?)</wkplNm>", r).group(1)))
        if op == "getDetailInfoSearchV2":
            assert req.url.params["seq"] == "111"  # 최신 달 seq
            return wrap(f"<item><jnngpCnt>42</jnngpCnt><wkplIntpCd>582019</wkplIntpCd><wkplNm>{name}</wkplNm></item>")
        seq = req.url.params["seq"]
        if seq in empty_seqs:
            return wrap("")
        return wrap(f"<item><nwAcqzrCnt>{gain}</nwAcqzrCnt><lssJnngpCnt>{loss}</lssJnngpCnt></item>")

    return handler


async def test_v2_happy_path():
    client, calls = make_client(standard())
    facts = await nps.fetch_pension(REF, KEY, client, TODAY)
    assert facts == nps.PensionFacts(members=42, gain_12m=36, loss_12m=12, months=12, period="2025년 10월~2026년 9월", ind2="58")
    assert len(calls) == 14
    q = calls[0].url.params
    assert q["wkplNm"] == "OO소프트" and q["bzowrRgstNo"] == "000000" and q["numOfRows"] == "100"
    assert all("_type" not in c.url.params and c.url.params["serviceKey"] == "FAKE-KEY-abc123+" for c in calls)
    monthly = sorted(c.url.params["seq"] for c in calls if c.url.path.endswith("Sttus" + "InfoSearchV2"))
    assert monthly == sorted(str(100 + i) for i in range(12))


async def test_ambiguous_workplace_none():
    basic = row(1, "202609") + row(2, "202609", emd="999")
    client, calls = make_client(standard(basic=basic))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    assert len(calls) == 1


async def test_duplicate_row_same_month_none():
    basic = row(1, "202609") + row(2, "202608") + row(3, "202608")
    client, _ = make_client(standard(basic=basic))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None


async def test_name_normalized():
    ref = CompanyRef("K-MOCK-0001", "mapped", "(주)OO소프트", "0000000000")
    basic = "".join(row(100 + i, ym, name="OO소프트 주식회사") for i, ym in enumerate(YMS))
    client, _ = make_client(standard(basic=basic))
    facts = await nps.fetch_pension(ref, KEY, client, TODAY)
    assert facts is not None and facts.months == 12


async def test_total_beyond_received_none():
    basic = "".join(row(100 + i, ym) for i, ym in enumerate(YMS))
    handler = standard(basic=basic)

    def h(req: httpx.Request):
        if req.url.path.endswith("getBassInfoSearchV2"):
            return wrap(basic, total=101)
        return handler(req)

    client, calls = make_client(h)
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    assert len(calls) == 1


async def test_malformed_ym_ignored():
    basic = "".join(row(100 + i, ym) for i, ym in enumerate(YMS)) + row(7, "ABCDEF") + row(8, "")
    client, _ = make_client(standard(basic=basic))
    facts = await nps.fetch_pension(REF, KEY, client, TODAY)
    assert facts is not None and facts.months == 12 and facts.period.endswith("2026년 9월")


async def test_other_name_or_biz_filtered():
    basic = "".join(row(100 + i, ym) for i, ym in enumerate(YMS)) + row(5, "202610", name="다른회사(주)") + row(6, "202610", biz="999999****")
    client, _ = make_client(standard(basic=basic))
    facts = await nps.fetch_pension(REF, KEY, client, TODAY)
    assert facts is not None and facts.period.endswith("2026년 9월")


async def test_period_from_used_months():
    client, _ = make_client(standard(empty_seqs={"100", "101", "102"}))
    facts = await nps.fetch_pension(REF, KEY, client, TODAY)
    assert facts is not None and facts.months == 9 and facts.period == "2026년 1월~2026년 9월"
    client, _ = make_client(standard(empty_seqs={"100", "101", "102", "103"}))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None


async def test_empty_search_none():
    client, calls = make_client(standard(basic=""))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    assert len(calls) == 1


async def test_result_code_error_none(ai_log):
    client, calls = make_client(lambda r: wrap("", code="30"))
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    assert len(calls) == 1
    assert "[ai] nps failed" in ai_log.text


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


async def test_demo_ref_makes_no_call():
    client, calls = make_client(standard())
    assert await nps.fetch_pension(CompanyRef("K-MOCK-0002", "demo"), KEY, client, TODAY) is None
    assert calls == []


async def test_key_not_in_errors(ai_log):
    def boom(req: httpx.Request):
        raise httpx.ConnectError(f"fail {req.url}")

    client, _ = make_client(boom)
    assert await nps.fetch_pension(REF, KEY, client, TODAY) is None
    text = ai_log.text
    assert "[ai] nps failed" in text
    for secret in (KEY, "FAKE-KEY", "OO소프트", "0000000000", "000000"):
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
