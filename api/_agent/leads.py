"""한 결과 안에서 같은 앞말이 세 번째부터 나오면 그 앞말 문장만 잘라 낸다(#13).
다시 쓰기를 부르지 않아 시간이 들지 않고, 질문은 남으므로 검수 문장으로 바뀌지 않는다."""
import logging
import re

from .checks import TEXT_MIN

log = logging.getLogger("askback24.ai")

LEAD_REPEAT_MAX = 2
# 질문 앞의 "…다." 한 문장. 그 뒤에 질문(?)이 이어질 때만 앞말로 본다.
_LEAD = re.compile(r"^(.*?다\.)\s+(.+)$")
# 인용과 거기 붙은 조사·"부분과"는 지워서, 인용만 다른 앞말을 같은 앞말로 본다.
_QUOTED = re.compile(r"['‘][^'‘’\n]*['’]\S*(?:\s+부분\S*)?")


def lead_key(lead: str) -> str:
    return " ".join(_QUOTED.sub("Q", lead).split())


def split_lead(text: str) -> tuple[str, str] | None:
    m = _LEAD.match(text.strip())
    if not m:
        return None
    lead, rest = m.group(1), m.group(2).strip()
    # 완충 문장("…될까요?")으로 시작했거나, 자르면 질문이 없어지거나 너무 짧아지면 앞말로 보지 않는다
    if "?" in lead or "?" not in rest or len(rest) < TEXT_MIN:
        return None
    return lead, rest


def thin_repeated_leads(texts: list[tuple[str, str]]) -> dict[str, str]:
    """(키, 문장)을 순서대로 보고, 같은 앞말이 LEAD_REPEAT_MAX 번 나온 뒤의 문항은 앞말을 뺀 문장으로 바꾼다."""
    seen: dict[str, int] = {}
    out: dict[str, str] = {}
    for key, text in texts:
        out[key] = text
        parts = split_lead(text)
        if parts is None:
            continue
        k = lead_key(parts[0])
        seen[k] = seen.get(k, 0) + 1
        if seen[k] > LEAD_REPEAT_MAX:
            out[key] = parts[1]
    return out


def thin_passed(name: str, keys: list[str], passed: dict[str, str]) -> dict[str, str]:
    """통과한 문장(요청 순서)에 thin_repeated_leads 를 걸고, 자른 문항 키만 로그에 남긴다(문장은 남기지 않음)."""
    out = thin_repeated_leads([(k, passed[k]) for k in keys if k in passed])
    cut = [k for k in out if out[k] != passed[k]]
    if cut:
        log.info("[ai] %s lead_cut=%s", name, ",".join(cut))
    return out
