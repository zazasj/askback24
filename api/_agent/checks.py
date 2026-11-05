"""질문 문장 검사. shared/validate.ts 와 같은 규칙을 글자 그대로 옮겼다(예시 파일 shared/fixtures/validate-cases.json 으로 맞춤).
근거 대조(evidence_not_in_posting)는 TS 에만 둔다 — 근거는 TS 가 요청에 넣은 값이다."""
import json
import re
from pathlib import Path

from .terms import unknown_in

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
EXPERIENCE_CLAIM = re.compile(r"(?<![가-힣])(?:제가|저는|저도|제)\s*[^.?!]{0,30}?(?:경험|해\s*봤|해봤|해\s*본\s*적|맡아\s*(?:봤|본))")
INTERVIEWER_QUOTE = re.compile(r"아까|하셨는데|말씀하신")
JUDGE_BASIS_MAX = 160
HEARD_QUOTE_MIN = 6
JUDGE_STATES = ("confirmed", "mismatch", "still_unknown")
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


def _common_issues(t: str, posting: dict, card_labels: set[str]) -> list[str]:
    # TS commonIssues 와 같은 순서(근거 대조 evidence_not_in_posting 만 TS 전용)
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
    return issues


def unknown_terms(text: str, posting: dict, resume_text: str = "") -> list[str]:
    """질문의 기술·분야 낱말 중 공고 모든 칸(과 이력서)에 없는 것(함의 허용, 실행 중 제외 낱말 뺌). TS unknownTerms 와 같은 규칙."""
    return unknown_in(text, allowed_source(posting, resume_text), runtime=True)


def allowed_source(posting: dict, resume_text: str = "") -> str:
    """unknown_term 허용 글: 공고 글자 칸 전부 + 지원자 글. 지표(evals)도 같은 조합을 쓴다."""
    return "\n".join([*(v for v in posting.values() if isinstance(v, str)), resume_text])


def check_first(text: str, state: str, has_exp: bool, posting: dict, card_labels: set[str], *, resume_text: str = "", can_cite_resume: bool = False) -> list[str]:
    t = text.strip()
    issues = _common_issues(t, posting, card_labels)
    if issues == ["empty"]:
        return issues
    if state == "absent" and PRESUPPOSE.search(t):
        issues.append("absent_presupposition")
    if not has_exp and not can_cite_resume and EXPERIENCE_CLAIM.search(t):
        issues.append("experience_claim")
    # 지어낸 기술·분야 낱말은 마지막에 붙인다(TS 와 같은 순서)
    if unknown_terms(t, posting, resume_text):
        issues.append("unknown_term")
    return issues


def check_final(text: str, state: str | None, posting: dict, card_labels: set[str]) -> list[str]:
    """TS checkFinalQuestion 과 같은 순서. 들은 답 대조는 요청에 들은 답이 없어 TS 가 마지막에 본다."""
    t = text.strip()
    issues = _common_issues(t, posting, card_labels)
    if issues == ["empty"]:
        return issues
    if state == "absent" and PRESUPPOSE.search(t):
        issues.append("absent_presupposition")
    if INTERVIEWER_QUOTE.search(t):
        issues.append("interviewer_quote")
    return issues


def check_judgement(basis: str, state: str, heard: list[str], clarity: str | None = None) -> list[str]:
    """TS judgementIssues(shared/generate.ts)와 같은 순서."""
    b = squash(basis).strip()
    issues: list[str] = []
    if state not in JUDGE_STATES:
        issues.append("bad_state")
    if b == "":
        issues.append("basis_empty")
    if len(b) > JUDGE_BASIS_MAX:
        issues.append("basis_too_long")
    if any(len(h.strip()) >= HEARD_QUOTE_MIN and h.strip() in b for h in heard):
        issues.append("basis_heard")
    if any(p.search(b) for p in FORBIDDEN):
        issues.append("forbidden_word")
    # "모호했어요"는 단순 규칙·명세 모두 아직 모름이다. AI가 확인됨·기대와 다름으로 단정하면 받지 않는다(D-410).
    if clarity == "vague" and state != "still_unknown":
        issues.append("vague_decided")
    return issues


# 허락을 구하는 말. 완충 문장("…여쭤도 될까요?") 뒤에 다시 쓰면 한 질문에 허락을 두 번 구한다(D-411).
PERMISSION = re.compile(r"(?:여쭤|여쭈어|물어)\s*(?:봐|보아)?도\s*(?:될까요|되나요|되겠습니까|괜찮을까요)")


def load_cushions(root: Path) -> tuple[str, ...]:
    """data/final.backend.json 완충 문장(앞뒤 공백 뺌)."""
    book = json.loads((root / "data" / "final.backend.json").read_text(encoding="utf-8"))
    return tuple(c.strip() for c in book.get("cushions", []) if isinstance(c, str) and c.strip())


def check_final_tone(text: str, tone: str, cushion: str, cushions: tuple[str, ...]) -> list[str]:
    """완충 문장은 tone cushion 문항의 맨 앞에 한 번만, 허락 구하는 말은 한 문항에 한 번만. Python 에만 있다(TS 는 AI 몫으로 둠)."""
    t = squash(text).strip()
    own = squash(cushion).strip()
    rest = t[len(own):] if tone == "cushion" and own and t.startswith(own) else t
    issues: list[str] = []
    if any(c in rest for c in (squash(c) for c in cushions)):
        issues.append("cushion_leak")
    if len(PERMISSION.findall(t)) >= 2:
        issues.append("permission_twice")
    return issues

# 마음을 나타내는 말(궁금·기대되·걱정되·알고 싶)로 물으면 면접관의 마음을 묻는 꼴이 된다("…궁금한가요?", D-425).
FEELING_QUESTION = re.compile(r"(?<![가-힣])(?:궁금|기대되|걱정되|알고\s*싶)[가-힣]*\?")
# "…궁금합니다." 뒤에 짧은 물음(24자 안)이 또 붙으면 같은 것을 두 번 묻는다("…궁금합니다. 어느 쪽인가요?").
ASK_TWICE = re.compile(r"궁금(?:합니다\.|해요\.|한데요,?)\s*[^.?!]{1,24}\?\s*$")


def check_ending(text: str) -> list[str]:
    """끝맺음 검사(①·② 문장 공통). Python 에만 있다(TS 는 AI 몫으로 둠, cushion_leak 과 같은 방식)."""
    t = squash(text).strip()
    issues: list[str] = []
    if FEELING_QUESTION.search(t):
        issues.append("feeling_question")
    if ASK_TWICE.search(t):
        issues.append("ask_twice")
    return issues


# 신호 질문은 회사를 평가하는 말도 막는다. 공용 FORBIDDEN(TS와 같은 목록)은 건드리지 않는다.
SIGNAL_FORBIDDEN = [
    re.compile(r"퇴사(?:가|율이?|자가?)\s*(?:많|높|잦)|이직률|사람이\s*(?:많이\s*)?(?:나가|그만)|자주\s*(?:그만|퇴사)"),
    re.compile(r"체불(?:이|을|한)?\s*(?:있|하)|임금을?\s*안\s*주|문제\s*(?:있는|많은)\s*회사"),
]


def check_signal_ask(ask: str) -> list[str]:
    """신호 질문 검사. Python에만 있다(TS는 실행 중에 신호 질문을 검사하지 않음). 숫자는 질문에 쓰지 않는다."""
    t = squash(ask).strip()
    if t == "":
        return ["empty"]
    issues: list[str] = []
    if len(t) < TEXT_MIN:
        issues.append("too_short")
    if len(t) > TEXT_MAX:
        issues.append("too_long")
    if re.search(r"\d", t):
        issues.append("has_number")
    if not t.endswith("?"):  # TS 데이터 시험 H1-04 가 신호 질문이 ?로 끝나기를 요구한다
        issues.append("no_question_mark")
    if any(p.search(t) for p in FORBIDDEN + SIGNAL_FORBIDDEN):
        issues.append("forbidden_word")
    return issues
