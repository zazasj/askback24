"""평가 실행 폴더·메타·지표 기록. 결과는 review/evals/ 에만 쓴다(git 밖)."""
import hashlib
import importlib
import json
import re
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

_LABEL = re.compile(r"^[a-z0-9-]{1,20}$")
_PROMPT_MODULES = ("first", "final", "judge", "analysis", "signal_ask")


@dataclass
class RunMeta:
    label: str
    commit: str
    created_at: str
    models: dict[str, str]
    prompt_hashes: dict[str, str]
    gold_hash: str | None


def new_run(root: Path, label: str, now: datetime, commit: str) -> Path:
    if not _LABEL.fullmatch(label):
        raise ValueError(f"label은 소문자·숫자·-로 1~20자여야 합니다: {label!r}")
    run = root / "review" / "evals" / f"{now:%Y%m%d-%H%M}-{commit[:7]}-{label}"
    run.mkdir(parents=True, exist_ok=True)
    return run


def write_meta(run: Path, meta: RunMeta) -> None:
    (run / "meta.json").write_text(
        json.dumps(asdict(meta), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def prompt_hashes() -> dict[str, str]:
    out = {
        name: _sha(importlib.import_module(f"api._agent.prompts.{name}").SYSTEM)
        for name in _PROMPT_MODULES
    }
    try:
        judges = importlib.import_module("evals.judges")
    except ModuleNotFoundError as e:
        # 판정 모듈이 아직 없을 때만 빼고, 그 안의 다른 import 오류는 그대로 올린다.
        if e.name != "evals.judges":
            raise
        return out
    systems = judges.SYSTEMS
    out["evals_judges"] = _sha(
        systems if isinstance(systems, str) else "\n".join(systems[k] for k in sorted(systems))
    )
    return out


def write_metrics(run: Path, name: str, metrics: dict) -> None:
    (run / f"{name}.metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def git_commit(root: Path) -> str:
    try:
        r = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return "unknown"
    sha = r.stdout.strip()
    return sha if r.returncode == 0 and sha else "unknown"
