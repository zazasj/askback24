import os
from pathlib import Path

import pytest

from _agent.cards.sources import CardSources

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.skipif(not os.environ.get("WORK24_KEY_DUTY"), reason="WORK24_KEY_DUTY 없음")
async def test_live_215l01():
    s = CardSources(dict(os.environ), ROOT)
    rec = await s.recommend("서버프로그램구현")
    assert rec and s.used["duty"] == "real"


@pytest.mark.skipif(not os.environ.get("WORK24_KEY_JOB"), reason="WORK24_KEY_JOB 없음")
async def test_live_212d01():
    s = CardSources(dict(os.environ), ROOT)
    assert await s.duties("K000001176")
    assert s.used["job"] == "real"


@pytest.mark.skipif(not os.environ.get("WORK24_KEY_COMMONCODE"), reason="WORK24_KEY_COMMONCODE 없음")
async def test_live_21l01():
    s = CardSources(dict(os.environ), ROOT)
    assert await s.job_code("응용소프트웨어개발자") is not None
    assert s.used["codes"] == "real"
