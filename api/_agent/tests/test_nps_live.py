import os
from datetime import date

import httpx
import pytest

from _agent.company.nps import fetch_pension
from _agent.company.resolve import CompanyRef

_need = ("DATA_GO_KR_KEY", "NPS_LIVE_NAME", "NPS_LIVE_BIZ6")


@pytest.mark.skipif(not all(os.environ.get(k) for k in _need), reason="NPS 키·NPS_LIVE_NAME·NPS_LIVE_BIZ6 없음")
async def test_live_nps_fetch():
    ref = CompanyRef("LIVE", "mapped", os.environ["NPS_LIVE_NAME"], os.environ["NPS_LIVE_BIZ6"] + "0000")
    async with httpx.AsyncClient() as c:
        facts = await fetch_pension(ref, os.environ["DATA_GO_KR_KEY"], c, date.today())
    assert facts is None or facts.months >= 9
