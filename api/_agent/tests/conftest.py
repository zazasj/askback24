import logging
import sys
from pathlib import Path

import pytest

# pytest를 레포 루트에서 돌려도 `_agent`를 Vercel과 같은 이름으로 불러오게 api/를 경로에 둔다.
API_DIR = str(Path(__file__).resolve().parents[2])
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)


@pytest.fixture
def ai_log(caplog):
    # create_app 이 askback24.ai 의 propagate 를 끄므로 caplog 핸들러를 로거에 직접 단다.
    lg = logging.getLogger("askback24.ai")
    old_level = lg.level
    lg.addHandler(caplog.handler)
    lg.setLevel(logging.INFO)
    yield caplog
    lg.removeHandler(caplog.handler)
    lg.setLevel(old_level)
