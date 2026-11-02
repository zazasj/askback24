"""글에 나온 기술·분야 낱말의 id 를 목록 순서대로 돌려준다.

TS(shared/terms.ts)와 같은 규칙이고 shared/fixtures/terms-cases.json 이 둘을 묶는다.
forms 의 항목은 글자이거나, text 에 exclude_after(뒤따르면 안 되는 글)·case_sensitive 를 더한 객체다.
낱말에는 implied_by(이 낱말이 있으면 허용)·runtime: false(실행 중 검사에서 뺌, 지표에는 남김)를 붙일 수 있다.
"""
import json
import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_LATIN = re.compile(r"[A-Za-z]")
# 띄어쓰기는 있어도 없어도 같게, `.`·`-` 는 있어도 없어도 같게 본다(Node.js = NodeJS = node js)
_SEP = r"[.\-]?"
_GAP = r"\s*"
# 여러 낱말 형태의 낱말 사이에서는 `-` 도 띄어쓰기처럼 본다(Spring-Boot = Spring Boot)
_WORD_GAP = r"\s*-?\s*"


def _word(w: str) -> str:
    return _GAP.join(_SEP if ch in ".-" else re.escape(ch) for ch in w)


def _body(text: str) -> str:
    return _WORD_GAP.join(_word(w) for w in text.split())


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


_TERMS = json.loads((_ROOT / "data" / "tech-terms.json").read_text(encoding="utf-8"))["terms"]
_COMPILED = [(t["id"], [_form_pattern(f) for f in t["forms"]]) for t in _TERMS]
_IMPLIED_BY = {t["id"]: list(t.get("implied_by", [])) for t in _TERMS}
# 실행 중 검사에서 빼는 낱말(TS NON_RUNTIME 과 같음)
NON_RUNTIME = frozenset(t["id"] for t in _TERMS if t.get("runtime") is False)


def terms_in(text: str) -> list[str]:
    return [tid for tid, patterns in _COMPILED if any(p.search(text) for p in patterns)]


def unknown_in(text: str, allowed: str, *, runtime: bool = False) -> list[str]:
    """글(질문)의 낱말 중 허용 글에 없고 함의(implied_by)로도 허용되지 않는 것. TS unknownIn 과 같은 규칙."""
    known = set(terms_in(allowed))
    return [
        t for t in terms_in(text)
        if t not in known and not any(k in known for k in _IMPLIED_BY.get(t, [])) and not (runtime and t in NON_RUNTIME)
    ]
