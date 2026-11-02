"""두 실행의 *.metrics.json 숫자 지표를 표로 견준다. 사용: python -m evals.compare <전> <후>"""
import argparse
import json
from pathlib import Path

_SUFFIX = ".metrics.json"


def _flatten(prefix: str, value, out: dict[str, float]) -> None:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)):
        out[prefix] = float(value)
    elif isinstance(value, dict):
        for k, v in value.items():
            _flatten(f"{prefix}.{k}", v, out)


def _load(run: Path) -> dict[str, float]:
    out: dict[str, float] = {}
    for f in sorted(run.glob(f"*{_SUFFIX}")):
        data = json.loads(f.read_text(encoding="utf-8"))
        _flatten(f.name[: -len(_SUFFIX)], data, out)
    return out


def compare_runs(a: Path, b: Path) -> str:
    before, after = _load(a), _load(b)
    lines = ["| 지표 | 전 | 후 | 차이 |", "| --- | --- | --- | --- |"]
    for key in sorted(before.keys() | after.keys()):
        x, y = before.get(key), after.get(key)
        cell = lambda v: "—" if v is None else f"{v:.2f}"
        diff = "—" if x is None or y is None else f"{y - x:+.2f}"
        lines.append(f"| {key} | {cell(x)} | {cell(y)} | {diff} |")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="평가 실행 두 개의 지표 비교")
    p.add_argument("a", type=Path, help="전 실행 폴더")
    p.add_argument("b", type=Path, help="후 실행 폴더")
    args = p.parse_args(argv)
    table = compare_runs(args.a, args.b)
    print(table)
    (args.b / f"compare-{args.a.name}.md").write_text(table, encoding="utf-8")


if __name__ == "__main__":
    main()
