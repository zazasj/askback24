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

// ── 질문 요청·응답 (POST /api/questions) ───────────────────────
export interface CardPick {
  card_id: string
  pref: Pref
  /** 경험 한 줄을 이 카드 질문에 붙일지 */
  has_exp: boolean
}

export type NotAskedReason = 'no_time' | 'bad_mood' | 'forgot' | 'no_chance' | 'explained'
export type Mood = 'relaxed' | 'normal' | 'pressured'

/** 1차 면접 정리(최소판). 들은 답은 서버에서 저장·기록하지 않는다 */
export interface InterviewReview {
  asked: Array<{ question_id: string; card_id: string; heard: string; clarity: 'clear' | 'vague' }>
  not_asked: Array<{ question_id: string; card_id: string; reason: NotAskedReason }>
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
  /** 판정 근거. 비어 있으면 화면에 내보내지 않는다 */
  basis: string
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
