"""② 1차 질문: 공통 틀(rewrite_loop) 위의 얇은 명세. 설계 확정 9-1."""
import time
from collections.abc import Callable

from ..budget import FIRST_BUDGET_S
from ..checks import check_first
from ..llm import Llm
from ..prompts.first import SYSTEM, user_message
from ..schemas import Draft, FirstRequest, FirstResponse
from .rewrite_loop import LoopAgent, LoopSpec


class FirstAgent:
    def __init__(self, llm: Llm, labels: set[str], clock: Callable[[], float] = time.monotonic) -> None:
        spec = LoopSpec(
            name="first",
            role="fast",
            budget_s=FIRST_BUDGET_S,
            system=SYSTEM,
            key_field="card_id",
            key_of=lambda i: i.card_id,
            check=lambda req, i, text: check_first(text, i.state, i.has_exp, req.posting, labels),
            user_message=user_message,
        )
        self.loop = LoopAgent(spec, llm, clock)

    async def run(self, req: FirstRequest) -> FirstResponse:
        passed, _, _, model = await self.loop.run(req)
        questions = [Draft(card_id=i.card_id, text=passed[i.card_id].strip()) for i in req.items if i.card_id in passed]
        return FirstResponse(questions=questions, model=model)


async def run_first(
    req: FirstRequest, llm: Llm, labels: set[str], clock: Callable[[], float] = time.monotonic
) -> FirstResponse:
    return await FirstAgent(llm, labels, clock).run(req)
