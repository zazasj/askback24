import json
from pathlib import Path

import httpx
import pytest

from _agent.cards import sources
from _agent.cards.sources import CardSources, SourceError, spaceless

ROOT = Path(__file__).resolve().parents[3]
FX = Path(__file__).parent / "fixtures"
SECRET = "FAKE-SECRET-key-123"


def body(*parts: str) -> str:
    return (FX.joinpath(*parts)).read_text(encoding="utf-8")


def make(env, handler):
    calls: list[httpx.Request] = []

    def h(req: httpx.Request):
        calls.append(req)
        return handler(req)

    client = httpx.AsyncClient(transport=httpx.MockTransport(h))
    return CardSources(env, ROOT, client), calls


async def test_no_keys_uses_snapshot_and_mock():
    s = CardSources({}, ROOT, httpx.AsyncClient())
    units = await s.units("20010202")
    assert {u.name for u in units} >= {"서버프로그램 구현", "화면 구현"}
    assert all(u.subcategory == "응용SW엔지니어링" and u.subcategory_code == "20010202" for u in units)
    rec = await s.recommend("서버프로그램구현")
    assert [u.code for u in rec] == ["2001020211"]
    assert rec[0].subcategory == "응용SW엔지니어링" and rec[0].subcategory_code == "20010202"
    assert await s.duties("K000001176")
    assert await s.duties("K-other") == []
    assert s.used == {"ncs_gw": "mock", "duty": "snapshot", "job": "snapshot"}


def test_spaceless_strips_parentheses():
    assert spaceless("서버 프로그램 구현(Java)") == "서버프로그램구현"


async def test_unused_source_absent():
    s = CardSources({}, ROOT, httpx.AsyncClient())
    await s.recommend("서버프로그램구현")
    assert s.used == {"duty": "snapshot"}


async def test_unknown_subcategory_mock_empty():
    assert await CardSources({}, ROOT, httpx.AsyncClient()).units("99999999") == []


async def test_duty_query_strips_spaces():
    s, calls = make({"WORK24_KEY_DUTY": SECRET}, lambda r: httpx.Response(200, text=body("work24", "215l01.json")))
    await s.recommend("서버 프로그램  구현")
    q = calls[0].url.params
    assert q["jobCont"] == "서버프로그램구현"
    assert q["returnType"] == "JSON" and q["limit"] == "10" and q["authKey"] == SECRET
    assert calls[0].url.path.endswith("callOpenApiSvcInfo215L01.do")


async def test_real_215l01_parses_fixture():
    s, _ = make({"WORK24_KEY_DUTY": SECRET}, lambda r: httpx.Response(200, text=body("work24", "215l01.json")))
    rec = await s.recommend("가짜")
    assert [(u.code, u.name, u.subcategory, u.subcategory_code, u.level) for u in rec] == [
        ("9999000101", "가짜 구현 하나", "가짜세분류", "99990001", None),
        ("9999000102", "가짜 구현 둘", "가짜세분류", "99990001", None),
    ]
    assert s.used == {"duty": "real"}


async def test_real_212d01_parses_fixture():
    s, calls = make({"WORK24_KEY_JOB": SECRET}, lambda r: httpx.Response(200, text=body("work24", "212d01.xml")))
    assert await s.duties("K000000001") == ["가짜 직업의 개요 문장이다."]
    q = calls[0].url.params
    assert (q["target"], q["jobGb"], q["jobCd"], q["dtlGb"]) == ("JOBDTL", "1", "K000000001", "1")
    assert s.used == {"job": "real"}


@pytest.mark.parametrize(
    "env,call",
    [
        ({"WORK24_KEY_DUTY": SECRET}, lambda s: s.recommend("가짜")),
        ({"WORK24_KEY_JOB": SECRET}, lambda s: s.duties("K1")),
    ],
)
async def test_key_present_failure_raises(env, call):
    def boom(req):
        raise httpx.ConnectError(f"boom {SECRET}")

    s, _ = make(env, boom)
    with pytest.raises(SourceError) as e:
        await call(s)
    assert SECRET not in str(e.value)
    s2, _ = make(env, lambda r: httpx.Response(500, text=SECRET))
    with pytest.raises(SourceError) as e2:
        await call(s2)
    assert SECRET not in str(e2.value)


async def test_ncs_gw_unconfigured_is_mock_even_with_key():
    s, calls = make({"DATA_GO_KR_KEY": SECRET}, lambda r: httpx.Response(500))
    assert await s.units("20010202")
    assert calls == []
    assert s.used == {"ncs_gw": "mock"}


CONF = {
    "base_url": "https://example.invalid/ncs",
    "operation": "getUnits",
    "params": {"subcategory": "dutyCd"},
    "fields": {"code": "cd", "name": "nm", "level": "lv", "subcategory_code": "sc", "subcategory": "sn"},
}


async def test_ncs_gw_configured_parses_fixture(monkeypatch):
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: CONF)
    s, calls = make({"DATA_GO_KR_KEY": "a%2Bb"}, lambda r: httpx.Response(200, text=body("ncs_gw", "list.xml")))
    units = await s.units("S1")
    assert [(u.code, u.name, u.level, u.subcategory_code, u.subcategory) for u in units] == [
        ("X01", "가짜 단위 하나", 3, "S1", "가짜세분류"),
        ("X02", "가짜 단위 둘", None, "S1", "가짜세분류"),
    ]
    assert calls[0].url.params["dutyCd"] == "S1" and calls[0].url.params["serviceKey"] == "a+b"
    assert s.used == {"ncs_gw": "real"}

    one = await make({"DATA_GO_KR_KEY": "k"}, lambda r: httpx.Response(200, text=body("ncs_gw", "one.xml")))[0].units("S1")
    assert [(u.code, u.level, u.subcategory_code) for u in one] == [("X01", 7, "S1")]
    empty = await make({"DATA_GO_KR_KEY": "k"}, lambda r: httpx.Response(200, text=body("ncs_gw", "empty.xml")))[0].units("S1")
    assert empty == []


async def test_ncs_gw_configured_failure_raises(monkeypatch):
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: CONF)
    s, _ = make({"DATA_GO_KR_KEY": SECRET}, lambda r: httpx.Response(200, text=body("ncs_gw", "error.xml")))
    with pytest.raises(SourceError) as e:
        await s.units("S1")
    assert SECRET not in str(e.value) and "KEY" not in str(e.value)


def test_mock_file_units_match_backend_book():
    mock = json.loads((ROOT / "data/mock/ncs-gw/20010202.json").read_text(encoding="utf-8"))
    book = json.loads((ROOT / "data/cards.backend.json").read_text(encoding="utf-8"))
    want = {n["unit"] for c in book["cards"] for n in c["ncs"] if n["subcategory"] == "응용SW엔지니어링"}
    names = [u["name"] for u in mock["units"]]
    assert set(names) == want and len(names) == len(set(names))


@pytest.mark.parametrize("kind", ["connect", "http500"])
async def test_ncs_gw_key_present_failure_raises(monkeypatch, kind):
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: CONF)

    def h(req):
        if kind == "connect":
            raise httpx.ConnectError(f"boom {SECRET}")
        return httpx.Response(500, text=SECRET)

    s, _ = make({"DATA_GO_KR_KEY": SECRET}, h)
    with pytest.raises(SourceError) as e:
        await s.units("S1")
    assert SECRET not in str(e.value)
    assert "ncs_gw" not in s.used


async def test_215l01_empty_body_is_no_match_but_garbage_fails():
    s, _ = make({"WORK24_KEY_DUTY": SECRET}, lambda r: httpx.Response(200, text="  \n"))
    assert await s.recommend("가짜") == []
    assert s.used == {"duty": "real"}
    s2, _ = make({"WORK24_KEY_DUTY": SECRET}, lambda r: httpx.Response(200, text="<html>x</html>"))
    with pytest.raises(SourceError):
        await s2.recommend("가짜")


async def test_only_data_go_kr_key_is_unquoted(monkeypatch):
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: CONF)
    s, calls = make({"WORK24_KEY_DUTY": "a%2Bb"}, lambda r: httpx.Response(200, text="{}"))
    await s.recommend("가짜")
    assert calls[0].url.params["authKey"] == "a%2Bb"
    s2, calls2 = make({"DATA_GO_KR_KEY": "a%2Bb"}, lambda r: httpx.Response(200, text=body("ncs_gw", "empty.xml")))
    await s2.units("S1")
    assert calls2[0].url.params["serviceKey"] == "a+b"


async def test_real_units_without_code_or_name_dropped(monkeypatch):
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: CONF)
    xml = (
        "<response><header><resultCode>00</resultCode></header><body><items>"
        "<item><cd></cd><nm>이름만</nm></item><item><cd>C1</cd><nm></nm></item><item><cd>C2</cd><nm>정상</nm></item>"
        "</items></body></response>"
    )
    s, _ = make({"DATA_GO_KR_KEY": "k"}, lambda r: httpx.Response(200, text=xml))
    assert [u.code for u in await s.units("S1")] == ["C2"]
    js = '{"items":[{"ablt_def":"x","centerLabel":"","ablt_unit":"1"},{"ablt_def":"x","centerLabel":"n","ablt_unit":""},{"ablt_def":"x","centerLabel":"n","ablt_unit":"2"}]}'
    s2, _ = make({"WORK24_KEY_DUTY": "k"}, lambda r: httpx.Response(200, text=js))
    assert [u.code for u in await s2.recommend("가짜")] == ["2"]


@pytest.mark.parametrize("hole", [("operation",), ("params", "subcategory"), ("fields", "code"), ("fields", "name")])
async def test_ncs_gw_partial_config_is_mock(monkeypatch, hole):
    import copy

    conf = copy.deepcopy(CONF)
    d = conf
    for k in hole[:-1]:
        d = d[k]
    d[hole[-1]] = None
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: conf)
    s, calls = make({"DATA_GO_KR_KEY": "k"}, lambda r: httpx.Response(500))
    assert await s.units("20010202")
    assert calls == [] and s.used == {"ncs_gw": "mock"}
