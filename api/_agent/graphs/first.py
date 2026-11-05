"""② 1차 질문: 공통 틀(rewrite_loop) 위의 얇은 명세. 설계 확정 9-1."""
import time
from collections.abc import Callable

from ..budget import FIRST_BUDGET_S
from ..checks import check_ending, check_first
from ..leads import thin_passed
from ..llm import Llm
from ..prompts.first import SYSTEM, user_message
from ..schemas import Draft, DraftItem, FirstRequest, FirstResponse, resume_text
from .rewrite_loop import LoopAgent, LoopSpec


def allowed_text(req: FirstRequest, item: DraftItem) -> str:
    """unknown_term 이 허용하는 지원자 글. TS generate.ts 와 같은 조합."""
    parts = [req.experience if item.has_exp else "", resume_text(req.resume) if req.resume and item.can_cite_resume else ""]
    return "\n".join(p for p in parts if p)


class FirstAgent:
    def __init__(self, llm: Llm, labels: set[str], clock: Callable[[], float] = time.monotonic) -> None:
        spec = LoopSpec(
            name="first",
            role="fast",
            budget_s=FIRST_BUDGET_S,
            system=SYSTEM,
            key_field="card_id",
            key_of=lambda i: i.card_id,
            check=lambda req, i, text: check_first(
                text, i.state, i.has_exp, req.posting, labels,
                # 경험 한 줄·이력서를 살려 쓴 문항은 지원자 자신의 낱말이라 지어낸 낱말이 아니다(둘은 더한다)
                resume_text=allowed_text(req, i),
                can_cite_resume=i.can_cite_resume,
            )
            + check_ending(text),
            user_message=user_message,
        )
        self.loop = LoopAgent(spec, llm, clock)

    async def run(self, req: FirstRequest, budget_s: float | None = None) -> FirstResponse:
        passed, _, _, model = await self.loop.run(req, budget_s)
        passed = thin_passed("first", [i.card_id for i in req.items], passed)
        questions = [Draft(card_id=i.card_id, text=passed[i.card_id].strip()) for i in req.items if i.card_id in passed]
        return FirstResponse(questions=questions, model=model)


async def run_first(
    req: FirstRequest, llm: Llm, labels: set[str], clock: Callable[[], float] = time.monotonic
) -> FirstResponse:
    return await FirstAgent(llm, labels, clock).run(req)
