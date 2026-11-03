"""③-2 최종 면접·처우 질문 문장: 공통 틀(rewrite_loop) 위의 얇은 명세. 설계 확정 9-3."""
import time
from collections.abc import Callable
from pathlib import Path

from ..budget import FINAL_BUDGET_S
from ..checks import check_final, check_final_tone, load_cushions
from ..leads import thin_passed
from ..llm import Llm
from ..prompts.final import SYSTEM, user_message
from ..schemas import FinalDraft, FinalDraftItem, FinalRequest, FinalResponse
from .rewrite_loop import LoopAgent, LoopSpec


def _cushion_missing(item: FinalDraftItem, text: str) -> bool:
    # TS 는 이 검사를 하지 않는다(명세가 AI에게 맡긴 규칙). 공백은 틀이 모으는 방식과 같게 접어 비교한다.
    cushion = " ".join(item.cushion.split())
    return item.tone == "cushion" and cushion != "" and not " ".join(text.split()).startswith(cushion)


class FinalAgent:
    def __init__(
        self, llm: Llm, labels: set[str], clock: Callable[[], float] = time.monotonic, cushions: tuple[str, ...] | None = None
    ) -> None:
        book = load_cushions(Path(__file__).resolve().parents[3]) if cushions is None else cushions

        def check(req: FinalRequest, i: FinalDraftItem, text: str) -> list[str]:
            issues = check_final(text, i.state, req.posting, labels)
            if _cushion_missing(i, text):
                issues.append("cushion_missing")
            return issues + check_final_tone(text, i.tone, i.cushion, book)

        spec = LoopSpec(
            name="final",
            role="fast",
            budget_s=FINAL_BUDGET_S,
            system=SYSTEM,
            key_field="key",
            key_of=lambda i: i.key,
            check=check,
            user_message=user_message,
        )
        self.loop = LoopAgent(spec, llm, clock)

    async def run(self, req: FinalRequest, budget_s: float | None = None) -> FinalResponse:
        passed, _, _, model = await self.loop.run(req, budget_s)
        passed = thin_passed("final", [i.key for i in req.items], passed)
        questions = [FinalDraft(key=i.key, text=passed[i.key].strip()) for i in req.items if i.key in passed]
        return FinalResponse(questions=questions, model=model)
