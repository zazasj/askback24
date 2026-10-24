/**
 * 화면 · 서버 함수(api/) · AI 담당이 같이 보는 JSON 형식.
 * 우리 쪽 키는 snake_case, 공고 필드는 고용24 채용정보 API 상세 명세 이름 그대로(D-011, 10-25 회의에서 확정 예정).
 */

// ── 선택·상태·유형 ──────────────────────────────────────────────
/** 기대돼요 · 걱정돼요 · 모르겠어요 */
export type Pref = 'want' | 'avoid' | 'unsure'
/** 공고가 이 업무를 어떻게 다루는지(면접 전) */
export type PostingState = 'explicit' | 'inferred' | 'vague' | 'absent'
/** 1차·기술 면접 질문 유형: 충돌 확인 · 기회 확인 · 깊이 확인 · 충돌 예방 · 탐색 */
export type QType = 'conflict' | 'opportunity' | 'depth' | 'prevent' | 'explore'
/** 최종 면접·처우 질문 유형: 다시 확인 · 신호 확인 · 범위 확인 · 처우 확인 · 기회 확인 */
export type FinalQType = 'recheck' | 'signal' | 'scope' | 'offer' | 'opportunity'
/** 준비할 면접: 1차·기술 / 최종·처우 */
export type Mode = 'first' | 'final'
/** 1차 면접을 다녀온 뒤 카드 상태: 확인됨 · 기대와 다름 · 아직 모름 · 회사가 먼저 물은 것 */
export type ReviewState = 'confirmed' | 'mismatch' | 'still_unknown' | 'company_signal'

// ── 공고 (고용24 채용정보 API 상세 필드명) ───────────────────────
/** 근거 인용이 올 수 있는 공고 필드 */
export type EvidenceField =
  | 'jobCont'
  | 'pfCond'
  | 'etcPfCond'
  | 'empTpNm'
  | 'salTpNm'
  | 'sal'
  | 'workdayWorkhrCont'
  | 'etcWelfare'

/** 공고 원문 속 근거. quote는 반드시 그 필드 값의 일부(글자 그대로) */
export interface Evidence {
  field: EvidenceField
  quote: string
}

/** data/postings.json 한 건. 빈 문자열 = 공고에 적혀 있지 않음 */
export interface Posting {
  wantedAuthNo: string
  /** 우리 쪽 표시: 형원 데이터가 오면 바꿀 임시 공고 */
  draft: boolean
  corpNm: string
  indTpNm: string
  totPsncnt: string
  busiSize: string
  busiCont: string
  wantedTitle: string
  jobsNm: string
  /** 직종코드 — 고용24 공통코드(21L01 dtlGb=2) 실제 코드(data/real/common-codes.json) */
  jobsCd: string
  jobCont: string
  empTpNm: string
  collectPsncnt: string
  salTpNm: string
  sal: string
  enterTpNm: string
  eduNm: string
  pfCond: string
  etcPfCond: string
  selMthd: string
  workRegion: string
  /** 지역코드 — 고용24 공통코드(21L01 dtlGb=1) 실제 코드. 시연 공고는 구·시가 가려져 있어 시·도 코드 */
  regionCd: string
  workdayWorkhrCont: string
  fourIns: string
  retirepay: string
  etcWelfare: string
  receiptCloseDt: string
}

// ── 공고 분석 (data/analysis/<wantedAuthNo>.json) ──────────────
export interface AnalysisCard {
  card_id: string
  state: PostingState
  evidence?: Evidence
  /** 화면 설명 말풍선·근거 문장 */
  reason: string
}

export type BlankTopic = 'sal' | 'workHours' | 'probation' | 'onsite'

/** 처우 질문 재료: 공고에서 빠졌거나 모호한 근로조건 */
export interface OfferBlank {
  topic: BlankTopic
  status: 'missing' | 'vague' | 'check'
  /** 근로조건 이름("근로시간"). 공고 상태 글자("공고에 없음" 등)는 화면이 status로 붙인다(한 곳에서 정함) */
  label: string
  basis: string
  evidence?: Evidence
  /** 검수 처우 질문 틀 */
  question: string
}

export interface PostingAnalysis {
  wantedAuthNo: string
  cards: AnalysisCard[]
  blanks: OfferBlank[]
}

/** data/signals.json: 회사 신호. 회사를 평가하지 않고 "면접에서 확인할 근거"로만 쓴다 */
export interface CompanySignal {
  text: string
  source: '실제' | '모의'
  source_name: string
}

// ── 업무 카드 (data/cards.backend.json) ────────────────────────
export interface CardDef {
  id: string
  kind: 'task' | 'context'
  /** true = 처음 12개, false = "5개 더 보기" */
  core: boolean
  label: string
  plain: string
  examples: string[]
  ncs: Array<{ subcategory: string; unit: string }>
  basis?: string
  job_dictionary?: string
  mapping_confidence: string
  posting_signals: { explicit: string[]; implicit: string[] }
  /** 질문 틀. {anchor} 자리에 경험 한 줄이 붙는다 */
  questions: Partial<Record<QType, string>> & Record<'conflict' | 'opportunity' | 'depth' | 'explore', string>
  interpretation: { mismatch_if_want: string; mismatch_if_avoid: string; good_if: string }
}

export interface GapRule {
  preference: Pref
  posting: PostingState[]
  type: QType
  priority: number
  label: string
  /** 경험이 붙으면 쓰는 우선순위(깊이 확인만) */
  with_experience_priority?: number
}

export interface CardBook {
  meta: Record<string, unknown>
  preference_options: Record<Pref, string>
  posting_states: Record<PostingState, string>
  type_labels: Record<QType, string>
  gap_rules: GapRule[]
  cards: CardDef[]
}

// ── 최종 면접 규칙 (data/final.backend.json) ───────────────────
/** none = 고르지 않은 카드(회사가 먼저 물은 카드) */
export type FinalPref = Pref | 'none'

export interface FinalRule {
  state: Exclude<ReviewState, 'confirmed'>
  preference: FinalPref[]
  type: Exclude<FinalQType, 'offer'>
  priority: number
}

export interface FinalBook {
  meta: Record<string, unknown>
  type_labels: Record<FinalQType, string>
  state_labels: Record<ReviewState, string>
  final_rules: FinalRule[]
  offer_priority: number
  offer_status_order: Array<OfferBlank['status']>
  limits: { total: number; cards: number; offers: number }
  basis: {
    asked_clear: string
    asked_vague: string
    asked_unmarked: string
    not_asked: Record<NotAskedReason | 'unmarked', string>
    received: string
    mismatch: string
    good_sign: string
  }
  templates: {
    recheck_vague_tail: string
    scope: { avoid: string; want: string }
    signal_lead: string
  }
  /** 완충 문장(분위기 "압박이 있었어요"·못 물은 이유 "분위기가 아니었어요") */
  cushions: string[]
  offer_topics: Record<BlankTopic, { watch_out: string; good_sign: string }>
}

/** data/review.example.json: 시연 도구 "1차 면접 다녀온 것으로 채우기" + 가짜 응답 모드 판정 고정값 */
export interface ReviewExample {
  label: string
  asked: Array<{ card_id: string; heard: string; clarity: Clarity; state?: 'confirmed' | 'mismatch' | 'still_unknown' }>
  not_asked: Array<{ card_id: string; reason: NotAskedReason }>
  received: string[]
  mood: Mood
  /** 예시에 없는 카드 질문은 이 이유로 못 물은 것으로 채운다 */
  other_reason: NotAskedReason
}

// ── 질문 요청·응답 (POST /api/questions) ───────────────────────
export interface CardPick {
  card_id: string
  pref: Pref
  /** 경험 한 줄을 이 카드 질문에 붙일지 */
  has_exp: boolean
}

export type NotAskedReason = 'no_time' | 'bad_mood' | 'forgot' | 'no_chance' | 'explained'
export type Mood = 'relaxed' | 'normal' | 'pressured'
export type Clarity = 'clear' | 'vague'

/**
 * 1차 면접 정리(최소판). 들은 답은 서버에서 저장·기록하지 않는다.
 * clarity·reason 을 고르지 않았으면 빼고 보낸다(→ 아직 모름). 정리하지 않은 질문은 not_asked(이유 없음)로 보낸다.
 */
export interface InterviewReview {
  asked: Array<{ question_id: string; card_id: string; heard: string; clarity?: Clarity }>
  not_asked: Array<{ question_id: string; card_id: string; reason?: NotAskedReason }>
  /** 회사가 물어본 업무(카드 체크) */
  received: Array<{ card_id: string }>
  impression: { mood: Mood }
}

export interface FirstQuestionsRequest {
  mode: 'first'
  wantedAuthNo: string
  picks: CardPick[]
  /** 100자 이내. 서버는 저장·기록하지 않는다 */
  experience?: string
}

export interface FinalQuestionsRequest {
  mode: 'final'
  wantedAuthNo: string
  picks: CardPick[]
  review: InterviewReview
}

export type QuestionsRequest = FirstQuestionsRequest | FinalQuestionsRequest

export interface Question {
  rank: number
  card_id: string
  type: QType
  text: string
  /** 없으면 "공고에 근거 없음 · 직접 확인" */
  evidence?: Evidence
  /** 왜 이 질문인지(분석 reason). 최종 질문의 basis 와 같은 자리 */
  basis: string
  /** 주의할 답 */
  watch_out: string
  /** 좋은 신호 */
  good_sign: string
  /** 경험 한 줄이 붙은 질문 */
  has_exp: boolean
  /** template = 검사 탈락·지연·오류로 검수 문장을 쓴 질문 */
  source: 'ai' | 'template'
}

export interface CardState {
  card_id: string
  state: ReviewState
  /** 판정 근거. 비어 있으면 화면에 내보내지 않는다. 들은 답을 그대로 옮기지 않는다 */
  basis: string
  /** ai = 공급자가 들은 답을 읽고 판정 · rule = 단순 규칙(구체적 → 확인됨, 모호·못 물음 → 아직 모름) */
  source: 'ai' | 'rule'
  /** 최종 질문으로 이어 갔는지(확인됨이거나 개수 한도로 빠지면 false) */
  carry: boolean
}

export interface FinalQuestion {
  rank: number
  /** 처우 질문은 card_id 대신 topic */
  card_id?: string
  topic?: BlankTopic
  type: FinalQType
  priority: number
  text: string
  basis: string
  evidence?: Evidence
  watch_out: string
  good_sign: string
  source: 'ai' | 'template'
}

export interface ReviewSummary {
  confirmed: number
  mismatch: number
  still_unknown: number
  company_signal: number
}

export interface FirstQuestionsResponse {
  mode: 'first'
  questions: Question[]
  elapsed_ms: number
}

export interface FinalQuestionsResponse {
  mode: 'final'
  card_states: CardState[]
  final_questions: FinalQuestion[]
  summary: ReviewSummary
  elapsed_ms: number
}

export type QuestionsResponse = FirstQuestionsResponse | FinalQuestionsResponse
