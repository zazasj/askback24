/**
 * 질문 문장을 쓰는 공급자(LLM) 형식. 순서·유형·근거는 규칙(shared/rules · shared/finalRules)이 정하고 공급자는 문장만 쓴다.
 * 최종 면접에서는 들은 답을 읽고 카드 상태를 판정하는 일(judgeReview)도 맡는다.
 * 공급자가 틀리거나 늦어도 shared/generate.ts 가 검수 문장·단순 규칙으로 대신한다.
 */
import type { BlankTopic, Clarity, Evidence, FinalPref, FinalQType, Posting, PostingState, Pref, QType, ReviewState } from '../contract.js'
import type { Origin, Tone } from '../finalRules.js'

export interface DraftItem {
  rank: number
  card_id: string
  card_label: string
  pref: Pref
  state: PostingState
  type: QType
  evidence?: Evidence
  /** 검수 틀. {anchor} 자리에 경험 한 줄이 붙는다 */
  template: string
  /** 검수 문장(틀 + 경험). 공급자가 뜻을 바꾸지 않게 기준으로 준다 */
  template_text: string
  /** 이 질문에만 경험 한 줄을 붙인다 */
  has_exp: boolean
}

export interface FirstDraftInput {
  mode: 'first'
  posting: Posting
  /** 경험을 붙일 질문이 있을 때만 채운다. 공급자는 저장·기록하지 않는다 */
  experience: string
  items: DraftItem[]
}

/** 공급자가 돌려주는 문장 하나 */
export interface Draft {
  card_id: string
  text: string
  /** 돌려줘도 모양만 보고 값은 읽지 않는다(결과 근거는 요청 근거, D-268) */
  evidence?: Evidence
}

// ── 최종 면접 ─────────────────────────────────────────────────
/** 판정할 질문 하나(물어봤고 들은 답이 있는 것만). 들은 답은 판정에만 쓰고 저장·기록하지 않는다 */
export interface JudgeItem {
  card_id: string
  card_label: string
  pref: FinalPref
  heard: string
  /** 사람이 고른 답의 모양(없으면 고르지 않음) */
  clarity?: Clarity
  /** 이 카드의 주의할 답(내 선호 기준)과 좋은 신호: 판정 기준 */
  watch_out: string
  good_sign: string
}

export interface JudgeInput {
  mode: 'final'
  posting: Posting
  items: JudgeItem[]
}

/** 공급자 판정. basis 에 들은 답을 그대로 옮기면 받지 않는다 */
export interface Judgement {
  card_id: string
  state: Extract<ReviewState, 'confirmed' | 'mismatch' | 'still_unknown'>
  basis: string
}

export interface FinalDraftItem {
  rank: number
  /** 카드 ID 또는 "offer:<topic>" */
  key: string
  card_id?: string
  topic?: BlankTopic
  label: string
  type: FinalQType
  origin: Origin | 'offer'
  /** 카드 질문만: 공고 상태 · 면접 뒤 상태 */
  state?: PostingState
  review_state?: ReviewState
  evidence?: Evidence
  /** 표현 단계: 기본(합격 전제 없음) · 완충(앞에 완충 문장) · 직접(앞말 없이 바로) */
  tone: Tone
  /** 완충 단계일 때 앞에 붙일 문장(아니면 빈 문자열) */
  cushion: string
  /** 완충 문장을 뺀 검수 문장 */
  template: string
  /** 완충 문장 + 검수 문장 */
  template_text: string
}

/** 들은 답은 넘기지 않는다(문장이 1차 면접관 말을 옮기지 않게) */
export interface FinalDraftInput {
  mode: 'final'
  posting: Posting
  items: FinalDraftItem[]
}

export interface FinalDraft {
  key: string
  text: string
  /** 돌려줘도 모양만 보고 값은 읽지 않는다(결과 근거는 요청 근거, D-268) */
  evidence?: Evidence
}

// ── AI 담당 서버 HTTP 형식(LLM_PROVIDER=remote, docs/API-SPEC.md) ──────────
/** POST {AI_ENDPOINT}/v1/first-questions 본문 = FirstDraftInput */
export interface FirstQuestionsAiResponse {
  questions: Draft[]
  /** 문제를 찾을 때 보는 모델 이름. 우리 서버는 읽지 않는다 */
  model?: string
}

/** POST {AI_ENDPOINT}/v1/final-judgements 본문 = JudgeInput */
export interface FinalJudgementsAiResponse {
  judgements: Judgement[]
  model?: string
}

/** POST {AI_ENDPOINT}/v1/final-questions 본문 = FinalDraftInput */
export interface FinalQuestionsAiResponse {
  questions: FinalDraft[]
  model?: string
}

/** 4xx·5xx 본문 */
export interface AiErrorResponse {
  error: { code: string; message: string }
}

export interface LlmProvider {
  /** 로그용 이름(mock · remote) */
  readonly name: string
  writeFirst(input: FirstDraftInput, signal: AbortSignal): Promise<Draft[]>
  /** 없으면 단순 규칙으로 판정한다 */
  judgeReview?(input: JudgeInput, signal: AbortSignal): Promise<Judgement[]>
  /** 없으면 최종 질문을 검수 문장으로 쓴다 */
  writeFinal?(input: FinalDraftInput, signal: AbortSignal): Promise<FinalDraft[]>
}
