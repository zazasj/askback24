import os

import pytest

from _agent.llm import llm_from_env


@pytest.mark.skipif(not os.environ.get("ENNOIA_API_KEY"), reason="ENNOIA_API_KEY 없음")
async def test_live_ennoia_returns_dict():
    r = await llm_from_env(os.environ).complete_json("fast", "JSON만 답한다.", '{"ok": true} 를 그대로 돌려줘.', timeout_s=18)
    assert isinstance(r.data, dict)
