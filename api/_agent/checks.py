"""질문 문장 검사. shared/validate.ts 와 같은 규칙을 글자 그대로 옮겼다(예시 파일 shared/fixtures/validate-cases.json 으로 맞춤).
근거 대조(evidence_not_in_posting)는 TS 에만 둔다 — 근거는 TS 가 요청에 넣은 값이다."""
import json
import re
from pathlib import Path

TEXT_MIN = 10
TEXT_MAX = 260

FORBIDDEN = [
    re.compile(r"(?<![가-힣])나이|연령|몇\s*살"),
    re.compile(r"결혼|기혼|미혼|배우자(?:가|의|와|분|님)|이혼"),
    re.compile(r"출신|고향|본적지"),
    re.compile(r"종교|신앙"),
    re.compile(r"임신|출산\s*계획|자녀\s*계획"),
    re.compile(r"혈액형|외모|신체\s*조건|키와\s*몸무게"),
    re.compile(r"부모님?\s*(?:직업|재산)|가족\s*관계"),
    re.compile(r"정치\s*성향|지지\s*정당"),
    re.compile(r"나쁜\s*회사|블랙\s*기업|악덕"),
    re.compile(r"퇴사자가\s*많|이직률이\s*높|사람이\s*자주\s*나가"),
]
PRESUPPOSE = re.compile(r"공고에[^.?!]*?(?:있던데|있는데)")
EXPERIENCE_CLAIM = re.compile(r"제\s*경험|해\s*봤|해봤|해\s*본\s*적|경험이\s*있")
_QUOTE = re.compile(r"['‘]([^'‘’\n]+)['’]")


def squash(s: str) -> str:
    return re.sub(r"\s+", " ", s)


def quotes_in(text: str) -> list[str]:
    return [q for q in (m.group(1).strip() for m in _QUOTE.finditer(text)) if q]


def load_card_labels(root: Path) -> set[str]:
    labels: set[str] = set()
    for f in sorted((root / "data").glob("cards.*.json")):
        for card in json.loads(f.read_text(encoding="utf-8")).get("cards", []):
            if isinstance(card.get("label"), str):
                labels.add(card["label"])
    return labels


def quotes_not_in_posting(text: str, posting: dict, card_labels: set[str]) -> list[str]:
    # 칸 사이를 줄바꿈으로 나눠 두 칸에 걸친 인용은 받지 않는다(TS A3-r2-10)
    source = "\n".join(squash(v) for v in posting.values() if isinstance(v, str))
    return [q for q in quotes_in(text) if q not in card_labels and squash(q) not in source]


def check_first(text: str, state: str, has_exp: bool, posting: dict, card_labels: set[str]) -> list[str]:
    t = text.strip()
    if not t:
        return ["empty"]
    issues: list[str] = []
    if len(t) < TEXT_MIN:
        issues.append("too_short")
    if len(t) > TEXT_MAX:
        issues.append("too_long")
    if quotes_not_in_posting(t, posting, card_labels):
        issues.append("quote_not_in_posting")
    if any(p.search(t) for p in FORBIDDEN):
        issues.append("forbidden_word")
    if state == "absent" and PRESUPPOSE.search(t):
        issues.append("absent_presupposition")
    if not has_exp and EXPERIENCE_CLAIM.search(t):
        issues.append("experience_claim")
    return issues
