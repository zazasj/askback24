import asyncio
import json
import re
import xml.etree.ElementTree as ET
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import unquote

import httpx

from ..budget import CARD_SOURCE_CALL_TIMEOUT_S

SourceKind = Literal["real", "snapshot", "mock"]

WORK24_BASE = "https://www.work24.go.kr/cm/openApi/call/wk/"
_FIELDS_PATH = Path(__file__).with_name("ncs_gw_fields.json")


@dataclass(frozen=True)
class Unit:
    code: str
    name: str
    level: int | None
    subcategory_code: str
    subcategory: str


class SourceError(Exception):
    """키가 있는데 호출이 실패했다. 키·응답 본문이 섞이지 않게 고정 글만 쓴다."""

    def __init__(self, message: str = "", code: str = "source") -> None:
        super().__init__(message)
        self.code = code


def load_ncs_gw_fields() -> dict:
    return json.loads(_FIELDS_PATH.read_text(encoding="utf-8"))


def _ncs_gw_configured(conf: dict) -> bool:
    # 일부만 채워진 설정으로 실제 호출을 하지 않도록, 필수 칸이 모두 있을 때만 실제로 본다(아니면 모의).
    try:
        return all(
            [conf["base_url"], conf["operation"], conf["params"]["subcategory"], conf["fields"]["code"], conf["fields"]["name"]]
        )
    except (KeyError, TypeError):
        return False


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _int_or_none(v: object) -> int | None:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def _ncs_gw_rows(root: ET.Element, conf: dict) -> list[ET.Element]:
    # code가 ok면 행들, empty(없는 세분류 등)면 빈 목록, 그 밖은 실패.
    code = _text(root.find(conf["result_code_path"]))
    if code in conf.get("empty_codes", []):
        return []
    if code not in conf["ok_codes"]:
        raise ValueError("result")
    return list(root.findall(conf["item_path"]))


def spaceless(s: str) -> str:
    # scripts/fetch-work24.ts의 spaceless와 같다. 괄호 안(영문 보충 등)은 215L01 질의에서 빈 응답이 된다.
    return re.sub(r"\s+", "", re.sub(r"\([^)]*\)", "", s))


def _walk_items(v: object, out: list[dict]) -> None:
    if isinstance(v, list):
        for x in v:
            _walk_items(x, out)
    elif isinstance(v, dict):
        if "ablt_def" in v:
            out.append(v)
        else:
            for x in v.values():
                _walk_items(x, out)


class CardSources:
    def __init__(self, env: Mapping[str, str], root: Path, client: httpx.AsyncClient):
        self._env = env
        self._root = root
        self._client = client
        self.used: dict[str, SourceKind] = {}

    def _key(self, name: str, decode: bool = False) -> str:
        k = (self._env.get(name) or "").strip()
        # data.go.kr의 Encoding 키(%2B 등)만 풀어 둔다(httpx가 다시 인코딩). 고용24 키는 그대로.
        return unquote(k) if decode else k

    async def _get(self, url: str, params: dict) -> httpx.Response:
        async def go(c: httpx.AsyncClient) -> httpx.Response:
            r = await asyncio.wait_for(
                c.get(url, params=params, timeout=CARD_SOURCE_CALL_TIMEOUT_S), CARD_SOURCE_CALL_TIMEOUT_S
            )
            r.raise_for_status()
            return r

        try:
            return await go(self._client)
        except Exception:
            # 예외 글에 키(URL)가 섞일 수 있어 버린다.
            raise SourceError("자료 출처 호출 실패") from None

    async def _work24(self, svc: str, key: str, params: dict) -> str:
        r = await self._get(f"{WORK24_BASE}callOpenApiSvcInfo{svc}.do", {"authKey": key, **params})
        return r.text.lstrip("﻿")

    # ── NCS 정보_GW ──
    async def units(self, subcategory_code: str) -> list[Unit]:
        conf = load_ncs_gw_fields()
        key = self._key("DATA_GO_KR_KEY", decode=True)
        if key and _ncs_gw_configured(conf):
            out = await self._units_real(conf, key, subcategory_code)
            self.used["ncs_gw"] = "real"
            return out
        self.used["ncs_gw"] = "mock"
        path = self._root / "data" / "mock" / "ncs-gw" / f"{subcategory_code}.json"
        if not re.fullmatch(r"[0-9A-Za-z_-]+", subcategory_code) or not path.is_file():
            return []
        d = _read_json(path)
        return [
            Unit(u["code"], u["name"], u.get("level"), subcategory_code, d.get("subcategory", ""))
            for u in d.get("units", [])
        ]

    async def _ncs_gw_call(self, conf: dict, key: str, operation: str, code: str, **override: str) -> list[ET.Element]:
        url = f"{conf['base_url'].rstrip('/')}/{operation}"
        params = {"serviceKey": key, conf["params"]["subcategory"]: code, **conf["params"].get("fixed", {}), **override}
        r = await self._get(url, params)
        try:
            return _ncs_gw_rows(ET.fromstring(r.text), conf)
        except Exception:
            raise SourceError("자료 출처 응답을 읽지 못함") from None

    async def _duty_name(self, conf: dict, key: str, code: str) -> str:
        # 이름은 표시용이라 실패해도 능력단위는 돌려준다.
        try:
            rows = await self._ncs_gw_call(conf, key, conf["name_operation"], code, numOfRows="10")
            return _text(rows[0].find(conf["fields"]["subcategory"])) if rows else ""
        except Exception:
            return ""

    async def _units_real(self, conf: dict, key: str, subcategory_code: str) -> list[Unit]:
        f = conf["fields"]
        has_name = bool(conf.get("name_operation") and f.get("subcategory"))
        rows, name = await asyncio.gather(
            self._ncs_gw_call(conf, key, conf["operation"], subcategory_code),
            self._duty_name(conf, key, subcategory_code) if has_name else asyncio.sleep(0, ""),
        )
        out = [
            Unit(
                # ablt_unit은 10자리라 `_23v6` 같은 버전 꼬리와 이름 앞 `11.` 번호를 뗀다.
                _text(i.find(f["code"])).split("_")[0],
                re.sub(r"^\d+\.\s*", "", _text(i.find(f["name"]))),
                _int_or_none(_text(i.find(f["level"]))) if f.get("level") else None,
                (_text(i.find(f["subcategory_code"])) if f.get("subcategory_code") else "") or subcategory_code,
                name if has_name else (_text(i.find(f["subcategory"])) if f.get("subcategory") else ""),
            )
            for i in rows
        ]
        return [u for u in out if u.code and u.name]

    # ── 215L01 직무정보 ──
    async def recommend(self, duty_phrase: str) -> list[Unit]:
        query = re.sub(r"\s+", "", duty_phrase)  # 띄어쓰기가 든 문장은 빈 응답
        key = self._key("WORK24_KEY_DUTY")
        if key:
            text = await self._work24("215L01", key, {"returnType": "JSON", "jobCont": query, "limit": "10"})
            try:
                items: list[dict] = []
                # 빈 응답은 맞는 것이 없다는 뜻이다(띄어쓰기가 든 말 등). 글이 있는데 JSON이 아니면 실패.
                if text.strip():
                    _walk_items(json.loads(text), items)
                out = []
                for i in items:
                    sc = str(i.get("job_sdvn_cd", ""))
                    out.append(
                        Unit(
                            str(i.get("ablt_unit", "")),
                            str(i.get("centerLabel", "")),
                            None,
                            sc.rsplit("_", 1)[-1] if "_" in sc else sc,
                            str(i.get("job_sdvn", "")),
                        )
                    )
                out = [u for u in out if u.code and u.name]
            except Exception:
                raise SourceError("자료 출처 응답을 읽지 못함") from None
            self.used["duty"] = "real"
            return out
        self.used["duty"] = "snapshot"
        d = _read_json(self._root / "data" / "real" / "ncs-cards.json")
        out, seen = [], set()
        for c in d.get("cards", []):
            u = c.get("unit")
            if not c.get("matched") or not u or c.get("query") != query:
                continue
            code = str(u.get("ablt_unit", ""))
            if code in seen:
                continue
            seen.add(code)
            sc = str(u.get("job_sdvn_cd", ""))
            out.append(Unit(code, str(u.get("centerLabel", "")), None, sc.rsplit("_", 1)[-1], str(u.get("job_sdvn", ""))))
        return out

    # ── 212D01 직업정보 ──
    async def duties(self, job_dictionary_code: str | None) -> list[str]:
        if not job_dictionary_code:
            return []
        key = self._key("WORK24_KEY_JOB")
        if key:
            text = await self._work24(
                "212D01",
                key,
                {"returnType": "XML", "target": "JOBDTL", "jobGb": "1", "jobCd": job_dictionary_code, "dtlGb": "1"},
            )
            try:
                root = ET.fromstring(text)
                # 바깥 요소 이름도 jobSum이라 잎만 본다.
                sums = [_text(e) for e in root.iter("jobSum") if len(e) == 0]
            except Exception:
                raise SourceError("자료 출처 응답을 읽지 못함") from None
            self.used["job"] = "real"
            return [s for s in sums if s][:1]
        self.used["job"] = "snapshot"
        d = _read_json(self._root / "data" / "real" / "job-info.json")
        if d.get("jobCd") == job_dictionary_code and d.get("summary"):
            return [d["summary"]]
        return []
