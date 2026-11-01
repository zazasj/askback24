"""글에 나온 기술·분야 낱말의 id 를 목록 순서대로 돌려준다.

TS(shared/terms.ts)와 같은 규칙이고 shared/fixtures/terms-cases.json 이 둘을 묶는다.
forms 의 항목은 글자이거나, text 에 exclude_after(뒤따르면 안 되는 글)·case_sensitive 를 더한 객체다.
"""
import json
import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_LATIN = re.compile(r"[A-Za-z]")
# 띄어쓰기는 있어도 없어도 같게, `.`·`-` 는 있어도 없어도 같게 본다(Node.js = NodeJS = node js)
_SEP = r"[.\-]?"
_GAP = r"\s*"


def _body(text: str) -> str:
    return _GAP.join(_SEP if ch in ".-" else re.escape(ch) for ch in re.sub(r"\s+", "", text))


def _form_pattern(form: str | dict) -> re.Pattern[str]:
    f = {"text": form} if isinstance(form, str) else form
    pat = _body(f["text"])
    # 짧은 영어 낱말이 다른 영어 낱말 안에서 걸리지 않게(SM-SMS, Go-Google). 한글 낱말은 포함만 본다.
    # 뒤에 오는 숫자는 버전(Java8·Python3.11·Oracle11g)으로 보고 막지 않는다
    if _LATIN.search(f["text"]):
        pat = rf"(?<![A-Za-z0-9]){pat}(?![A-Za-z])"
    for ex in f.get("exclude_after", []):
        pat += rf"(?!{_GAP}{_body(ex)})"
    return re.compile(pat, 0 if f.get("case_sensitive") else re.IGNORECASE)


def _load() -> list[tuple[str, list[re.Pattern[str]]]]:
    terms = json.loads((_ROOT / "data" / "tech-terms.json").read_text(encoding="utf-8"))["terms"]
    return [(t["id"], [_form_pattern(f) for f in t["forms"]]) for t in terms]


_COMPILED = _load()


def terms_in(text: str) -> list[str]:
    return [tid for tid, patterns in _COMPILED if any(p.search(text) for p in patterns)]
