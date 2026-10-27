"""shared/providers/types.ts 의 DraftItem·FirstDraftInput·Draft 와 같은 이름·필수 여부."""
from typing import Any, Literal

from pydantic import BaseModel, Field


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
    items: list[JudgeItem] = Field(min_length=1, max_length=17)


class Judgement(BaseModel):
    card_id: str
    state: Literal["confirmed", "mismatch", "still_unknown"]
    basis: str


class JudgeResponse(BaseModel):
    judgements: list[Judgement]
    model: str
