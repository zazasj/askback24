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


async def test_ncs_gw_unconfigured_is_mock_even_with_key(monkeypatch):
    monkeypatch.setattr(
        sources,
        "load_ncs_gw_fields",
        lambda: {"base_url": None, "operation": None, "params": {"subcategory": None}, "fields": {"code": None, "name": None}},
    )
    s, calls = make({"DATA_GO_KR_KEY": SECRET}, lambda r: httpx.Response(500))
    assert await s.units("20010202")
    assert calls == []
    assert s.used == {"ncs_gw": "mock"}


CONF = {
    "base_url": "https://example.invalid/ncs",
    "operation": "getUnits",
    "params": {"subcategory": "dutyCd", "fixed": {"numOfRows": "100", "returnType": "xml"}},
    "item_path": "data/row",
    "result_code_path": "dataInfo/code",
    "ok_codes": ["000"],
    "empty_codes": ["002"],
    "fields": {"code": "ncsClCd", "name": "compUnitName", "level": "compUnitLevel", "subcategory_code": "dutyCd", "subcategory": "dutyNm"},
}


async def test_ncs_gw_configured_parses_fixture(monkeypatch):
    monkeypatch.setattr(sources, "load_ncs_gw_fields", lambda: CONF)
    s, calls = make({"DATA_GO_KR_KEY": "a%2Bb"}, lambda r: httpx.Response(200, text=body("ncs_gw", "list.xml")))
    units = await s.units("S1")
    assert [(u.code, u.name, u.level, u.subcategory_code, u.subcategory) for u in units] == [
        ("X01", "가짜 단위 하나", 3, "S1", ""),
        ("X02", "가짜 단위 둘", None, "S1", ""),
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
        "<root><data>"
        "<row><ncsClCd></ncsClCd><compUnitName>이름만</compUnitName></row><row><ncsClCd>C1</ncsClCd><compUnitName></compUnitName></row>"
        "<row><ncsClCd>C2</ncsClCd><compUnitName>정상</compUnitName></row>"
        "</data><dataInfo><code>000</code></dataInfo></root>"
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


def _real_handler(duty_status=200, duty_text=None):
    def h(req: httpx.Request):
        if req.url.path.endswith("/ncsDutyInfo"):
            return httpx.Response(duty_status, text=duty_text if duty_text is not None else body("ncs_gw", "duty.xml"))
        return httpx.Response(200, text=body("ncs_gw", "real_units.xml"))

    return h


async def test_ncs_gw_real_shape():
    s, calls = make({"DATA_GO_KR_KEY": "a%2Bb"}, _real_handler())
    units = await s.units("20010202")
    assert units == [
        sources.Unit("2001020211", "서버프로그램 구현", 5, "20010202", "응용SW엔지니어링"),
        sources.Unit("2001020221", "애플리케이션 설계", 6, "20010202", "응용SW엔지니어링"),
    ]
    assert s.used == {"ncs_gw": "real"}
    assert sorted(c.url.path.rsplit("/", 1)[-1] for c in calls) == ["ncsCompeUnitInfo", "ncsDutyInfo"]
    for c in calls:
        assert c.url.path.startswith("/B490007/ncsInfo/")
        assert c.url.params["dutyCd"] == "20010202" and c.url.params["returnType"] == "xml"
        assert c.url.params["serviceKey"] == "a+b"


async def test_ncs_gw_empty_code_is_empty_list():
    xml = body("ncs_gw", "empty.xml")
    s, _ = make({"DATA_GO_KR_KEY": "k"}, lambda r: httpx.Response(200, text=xml))
    assert await s.units("99999999") == []
    assert s.used == {"ncs_gw": "real"}


async def test_ncs_gw_error_code_raises():
    xml = body("ncs_gw", "error.xml")
    s, _ = make({"DATA_GO_KR_KEY": SECRET}, lambda r: httpx.Response(200, text=xml))
    with pytest.raises(SourceError) as e:
        await s.units("20010202")
    assert SECRET not in str(e.value)


@pytest.mark.parametrize("kind", ["http500", "error_code", "garbage"])
async def test_ncs_gw_name_lookup_failure_keeps_units(kind):
    text = {"http500": "", "error_code": body("ncs_gw", "error.xml"), "garbage": "<html>x"}[kind]
    s, _ = make({"DATA_GO_KR_KEY": "k"}, _real_handler(500 if kind == "http500" else 200, text))
    units = await s.units("20010202")
    assert [(u.code, u.subcategory) for u in units] == [("2001020211", ""), ("2001020221", "")]
    assert s.used == {"ncs_gw": "real"}
