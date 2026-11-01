import os
from pathlib import Path

import httpx
import pytest

from _agent.cards.sources import CardSources, _ncs_gw_configured, load_ncs_gw_fields

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.skipif(not os.environ.get("WORK24_KEY_DUTY"), reason="WORK24_KEY_DUTY 없음")
async def test_live_215l01():
    async with httpx.AsyncClient() as c:
        s = CardSources(dict(os.environ), ROOT, c)
        rec = await s.recommend("서버프로그램구현")
    assert rec and s.used["duty"] == "real"


@pytest.mark.skipif(not os.environ.get("WORK24_KEY_JOB"), reason="WORK24_KEY_JOB 없음")
async def test_live_212d01():
    async with httpx.AsyncClient() as c:
        s = CardSources(dict(os.environ), ROOT, c)
        assert await s.duties("K000001176")
    assert s.used["job"] == "real"


@pytest.mark.skipif(
    not os.environ.get("DATA_GO_KR_KEY") or not _ncs_gw_configured(load_ncs_gw_fields()),
    reason="DATA_GO_KR_KEY 없음 또는 ncs_gw_fields.json 미완성",
)
async def test_live_ncs_gw_units():
    async with httpx.AsyncClient() as c:
        s = CardSources(dict(os.environ), ROOT, c)
        assert await s.units("20010202")
    assert s.used["ncs_gw"] == "real"
