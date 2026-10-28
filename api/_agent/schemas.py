"""shared/providers/types.ts 의 DraftItem·FirstDraftInput·Draft 와 같은 이름·필수 여부."""
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class Evidence(BaseModel):
    field: str
    quote: str


class DraftItem(BaseModel):
    rank: int
    card_id: str
    card_label: str
    pref: str
    state: str
    type: str
    evidence: Evidence | None = None
    template: str
    template_text: str
    has_exp: bool


class FirstRequest(BaseModel):
    mode: Literal["first"]
    posting: dict[str, Any]
    experience: str
    items: list[DraftItem] = Field(min_length=1, max_length=5)


class Draft(BaseModel):
    card_id: str
    text: str
    evidence: Evidence | None = None


class FirstResponse(BaseModel):
    questions: list[Draft]
    model: str


class JudgeItem(BaseModel):
    card_id: str
    card_label: str
    pref: Literal["want", "avoid", "unsure", "none"]
    heard: str
    clarity: Literal["clear", "vague"] | None = None
    watch_out: str
    good_sign: str


class JudgeRequest(BaseModel):
    mode: Literal["final"]
    posting: dict[str, Any]
    items: list[JudgeItem] = Field(min_length=1, max_length=17)  # data/cards.backend.json 카드 수. 카드가 늘면 같이 고친다


class Judgement(BaseModel):
    card_id: str
    state: Literal["confirmed", "mismatch", "still_unknown"]
    basis: str


class JudgeResponse(BaseModel):
    judgements: list[Judgement]
    model: str


class FinalDraftItem(BaseModel):
    """shared/providers/types.ts FinalDraftItem. 들은 답(heard)은 필드가 없어 와도 무시된다."""

    rank: int
    key: str
    card_id: str | None = None
    topic: Literal["sal", "workHours", "probation", "onsite"] | None = None
    label: str
    type: Literal["recheck", "signal", "scope", "offer", "opportunity"]
    origin: Literal["asked", "not_asked", "received", "offer"]
    state: str | None = None
    review_state: str | None = None
    evidence: Evidence | None = None
    tone: Literal["basic", "cushion", "direct"]
    cushion: str
    template: str
    template_text: str


class FinalRequest(BaseModel):
    mode: Literal["final"]
    posting: dict[str, Any]
    items: list[FinalDraftItem] = Field(min_length=1, max_length=8)  # data/final.backend.json limits.total. 바뀌면 같이 고친다


class FinalDraft(BaseModel):
    key: str
    text: str
    evidence: Evidence | None = None


class FinalResponse(BaseModel):
    questions: list[FinalDraft]
    model: str


SignalKind = Literal["reposting", "pension_flow", "industry_baseline", "small_giant", "wage_arrears"]


class OfferBlank(BaseModel):
    """shared/contract.ts 의 OfferBlank 과 같은 모양."""
    topic: Literal["sal", "workHours", "probation", "onsite"]
    status: Literal["missing", "vague", "check"]
    label: str
    basis: str
    question: str
    evidence: Evidence | None = None


GRAPH_VERSION = "analysis-1"


class AnalysisRequest(BaseModel):
    posting: dict[str, Any]
    job: str = Field(pattern=r"^[a-z]+$")


class AnalysisCard(BaseModel):
    card_id: str
    state: Literal["explicit", "inferred", "vague", "absent"]
    evidence: Evidence | None = None
    reason: str
    needs_review: bool = False


class Signal(BaseModel):
    kind: SignalKind
    text: str
    source: Literal["실제", "모의"]
    source_name: str
    ask: str | None = None
    ask_source: Literal["ai", "template"] | None = None
    caveat: str | None = None


class OutOfDictionary(BaseModel):
    field: str
    quote: str
    note: str


class AnalysisBody(BaseModel):
    wantedAuthNo: str
    cards: list[AnalysisCard]
    blanks: list[OfferBlank]


class AnalysisMeta(BaseModel):
    graph_version: str
    model: str
    created_at: str


class AnalysisResponse(BaseModel):
    analysis: AnalysisBody
    signals: list[Signal]
    out_of_dictionary: list[OutOfDictionary]
    meta: AnalysisMeta


# ── ⓪ 업무 카드 초안(명세 4번) ──
CARDS_GRAPH_VERSION = "cards-1"


class CardDraftRequest(BaseModel):
    job: str = Field(pattern=r"^[a-z]+$")
    job_label: str = Field(min_length=1, max_length=40)
    ncs_subcategories: list[str] = Field(min_length=1, max_length=5)
    job_dictionary_code: str | None = None
    max_cards: int = Field(default=15, ge=1, le=30)

    @field_validator("ncs_subcategories")
    @classmethod
    def _codes(cls, v: list[str]) -> list[str]:
        if any(not re.fullmatch(r"\d{8}", c) for c in v):
            raise ValueError("ncs_subcategories")
        return v


class CandidateOut(BaseModel):
    ablt_unit: str
    unit: str
    subcategory: str
    level: int | None
    high_level: bool
    used_in: str | None


class CardNcs(BaseModel):
    subcategory: str
    unit: str
    ablt_unit: str


class CardSignals(BaseModel):
    explicit: list[str]
    implicit: list[str]


class CardInterpretation(BaseModel):
    mismatch_if_want: str
    mismatch_if_avoid: str
    good_if: str


class CardDraft(BaseModel):
    id: str
    kind: Literal["task"]
    core: bool
    label: str
    plain: str
    examples: list[str]
    ncs: list[CardNcs]
    job_dictionary: str | None
    mapping_confidence: Literal["draft"]
    posting_signals: CardSignals
    questions: dict[str, str]
    example_question: str | None
    interpretation: CardInterpretation


class CardIssue(BaseModel):
    card_id: str | None
    rule: str


class CardDraftMeta(BaseModel):
    graph_version: Literal["cards-1"]
    model: str
    created_at: str
    sources: dict[str, Literal["실제", "실제 스냅숏", "모의"]]


class CardDraftResponse(BaseModel):
    candidates: list[CandidateOut]
    cards: list[CardDraft]
    issues: list[CardIssue]
    meta: CardDraftMeta
