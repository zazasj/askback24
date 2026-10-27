import sys
from pathlib import Path

# pytest를 레포 루트에서 돌려도 `_agent`를 Vercel과 같은 이름으로 불러오게 api/를 경로에 둔다.
API_DIR = str(Path(__file__).resolve().parents[2])
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)
