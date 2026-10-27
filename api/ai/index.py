import sys
from pathlib import Path

# Vercel은 함수 파일 기준으로 실행하므로 `_agent`가 있는 api/를 경로에 더한다.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from _agent.app import create_app  # noqa: E402

app = create_app()
