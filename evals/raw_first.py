"""1차 문장을 검사·재시도 없이 AI에 한 번만 시켜 본 날것의 규칙 위반율.
검사가 없을 때 얼마나 틀리는지 보여 주는 지표다. 질문 글은 어디에도 찍지 않는다."""
from collections import Counter

from pydantic import ValidationError

from api._agent.checks import check_first
from api._agent.graphs.first import allowed_text
from api._agent.llm import Llm, LlmError
from api._agent.prompts.first import SYSTEM, user_message
from api._agent.schemas import FirstRequest

_TIMEOUT_S = 18


async def raw_violations(llm: Llm, inputs: list[dict], card_labels: set[str]) -> dict:
    total = flagged = failed = 0
    by_rule: Counter[str] = Counter()
    for inp in inputs:
        try:
            req = FirstRequest(**inp)
            res = await llm.complete_json("fast", SYSTEM, user_message(req), _TIMEOUT_S)
        except (LlmError, ValidationError, TypeError):
            failed += 1
            continue
        qs = res.data.get("questions") if isinstance(res.data, dict) else None
        if not isinstance(qs, list):
            failed += 1
            continue
        items = {i.card_id: i for i in req.items}
        for q in qs:
            item = items.get(q.get("card_id")) if isinstance(q, dict) else None
            if item is None or not isinstance(q.get("text"), str):
                continue
            total += 1
            issues = check_first(q["text"], item.state, item.has_exp, req.posting, card_labels, resume_text=allowed_text(req, item), can_cite_resume=item.can_cite_resume)
            if issues:
                flagged += 1
                by_rule.update(set(issues))
    return {"rate": flagged / total if total else 0.0, "by_rule": dict(by_rule), "failed": failed}
