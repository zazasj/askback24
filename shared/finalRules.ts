/**
 * 최종 면접·처우 질문 규칙(추가 개발 노트 4·6·7절, D-013). 데이터는 data/final.backend.json.
 * 1차 면접 정리 → 카드 상태 판정(단순 규칙, 공급자가 다듬음) → 순서 → 표현 단계(완충).
 * 질문 순서는 여기서만 정한다. 서버 함수·가짜 응답 모드·대체 결과가 모두 이 함수를 쓴다.
 */
import type {
  AnalysisCard,
  BlankTopic,
  CardDef,
  CardPick,
  Clarity,
  Evidence,
  FinalPref,
  FinalQType,
  InterviewReview,
  Mood,
  NotAskedReason,
  PostingAnalysis,
  PostingState,
  ReviewState,
  ReviewSummary,
} from './contract.js'
import { FINAL_BOOK, getCard } from './catalog.js'
import { ABSENT_REASON, classify, questionTemplate } from './rules.js'

export type Origin = 'asked' | 'not_asked' | 'received'
export type Tone = 'basic' | 'cushion' | 'direct'

/** 카드 하나의 판정. 화면에 보내는 CardState 보다 자세하다(어디서 나왔는지 · 정렬 순서) */
export interface Judged {
  card_id: string
  state: ReviewState
  basis: string
  source: 'ai' | 'rule'
  origin: Origin
  /** 1차 질문 순번(q1 → 1). 우선순위가 같으면 앞 질문이 위 */
  order: number
  clarity?: Clarity
  reason?: NotAskedReason
}

const questionOrder = (questionId: string, fallback: number): number => {
  const n = Number(/(\d+)$/.exec(questionId)?.[1])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * 단순 규칙: 구체적 → 확인됨(걱정돼요 카드는 아직 모름), 모호·고르지 않음 → 아직 모름, 못 물음 → 아직 모름
 * ("회사가 먼저 설명해 줬어요" → 확인됨), 회사가 물어본 업무 → 회사가 먼저 물은 것.
 * 내 질문에서 이미 다룬 카드는 그 판정을 따른다(직접 들은 답이 더 분명함).
 * 걱정한 업무는 답이 구체적이어도 걱정이 맞다는 답일 수 있어 규칙만으로 "확인됨"으로 빼지 않는다(H1-06).
 */
export function ruleJudgements(review: InterviewReview, picks: readonly CardPick[] = []): Judged[] {
  const B = FINAL_BOOK.basis
  const out: Judged[] = []
  const seen = new Set<string>()
  const add = (j: Judged) => {
    if (seen.has(j.card_id) || !getCard(j.card_id)) return
    seen.add(j.card_id)
    out.push(j)
  }
  review.asked.forEach((a, i) => {
    const clear = a.clarity === 'clear'
    const worried = clear && finalPrefOf(picks, a.card_id) === 'avoid'
    const j: Judged = {
      card_id: a.card_id,
      state: clear && !worried ? 'confirmed' : 'still_unknown',
      basis: worried ? B.asked_clear_avoid : clear ? B.asked_clear : a.clarity === 'vague' ? B.asked_vague : B.asked_unmarked,
      source: 'rule',
      origin: 'asked',
      order: questionOrder(a.question_id, 50 + i),
    }
    if (a.clarity) j.clarity = a.clarity
    add(j)
  })
  review.not_asked.forEach((n, i) => {
    const j: Judged = {
      card_id: n.card_id,
      state: n.reason === 'explained' ? 'confirmed' : 'still_unknown',
      basis: B.not_asked[n.reason ?? 'unmarked'],
      source: 'rule',
      origin: 'not_asked',
      order: questionOrder(n.question_id, 50 + i),
    }
    if (n.reason) j.reason = n.reason
    add(j)
  })
  review.received.forEach((r, i) => {
    add({ card_id: r.card_id, state: 'company_signal', basis: B.received, source: 'rule', origin: 'received', order: 100 + i })
  })
  return out.sort((a, b) => a.order - b.order)
}

export function summarize(judged: readonly Judged[]): ReviewSummary {
  const s: ReviewSummary = { confirmed: 0, mismatch: 0, still_unknown: 0, company_signal: 0 }
  for (const j of judged) s[j.state]++
  return s
}

export function finalPrefOf(picks: readonly CardPick[], cardId: string): FinalPref {
  return picks.find((p) => p.card_id === cardId)?.pref ?? 'none'
}

export interface FinalClassified {
  type: Exclude<FinalQType, 'offer'>
  priority: number
}

/** 카드 상태 × 내 선호 → 최종 질문 유형과 우선순위. 확인됨은 규칙이 없어 null(내보내지 않음) */
export function classifyFinal(state: ReviewState, pref: FinalPref, rules = FINAL_BOOK.final_rules): FinalClassified | null {
  for (const r of rules) {
    if (r.state === state && r.preference.includes(pref)) return { type: r.type, priority: r.priority }
  }
  return null
}

export function finalTypeLabel(type: FinalQType): string {
  return FINAL_BOOK.type_labels[type]
}

const fill = (template: string, label: string) => template.replace(/\{label\}/g, () => label)
const fillQuote = (template: string, quote: string) => template.replace(/\{quote\}/g, () => quote)
const stripAnchor = (template: string) => template.replace('{anchor}', '').trim()

/**
 * 다시 확인 질문의 앞말. 물어본 질문은 "지난 면접에 이어 … 조금 더 구체적으로"(근거가 있으면 공고 인용),
 * 못 물은 질문은 근거가 있을 때만 공고 인용. 1차 면접관의 말은 옮기지 않는다.
 */
function recheckLead(card: CardDef, origin: Origin, evidence?: Evidence): string {
  const L = FINAL_BOOK.templates.recheck_lead
  if (origin === 'asked') return evidence ? fillQuote(L.asked_evidence, evidence.quote) : fill(L.asked, card.label)
  return evidence ? fillQuote(L.not_asked_evidence, evidence.quote) : ''
}

/**
 * 카드 질문의 검수 문장(완충 문장 앞).
 * 다시 확인: 1차 질문을 이어 받는다 — 앞말(recheckLead) + 1차에 가져간 것과 같은 유형의 질문 틀(공고마다 덮어쓴 틀 포함).
 * 질문 틀은 공고 내용을 말하지 않으므로(D-075) 차이 확인 틀도 그대로 쓴다. 미리 확인 틀("…경우도 있나요?")로 바꾸면
 * 공고에 적힌 것을 처음부터 다시 묻는 말이 된다(DA-02). 1차에서 물었는데 답이 모호했으면 같은 틀을 되풀이하지 않고
 * 구체적인 예를 묻는다(H1-13). 신호 확인은 공고를 전제하지 않는 미리 확인(없으면 차이 확인) 틀.
 */
export function finalCardTemplate(
  card: CardDef,
  type: Exclude<FinalQType, 'offer'>,
  pref: FinalPref,
  postingState: PostingState,
  origin: Origin,
  evidence?: Evidence,
  found?: Pick<AnalysisCard, 'state' | 'questions'>,
  clarity?: Clarity,
): string {
  const T = FINAL_BOOK.templates
  switch (type) {
    case 'recheck': {
      const firstType = classify(pref === 'none' ? 'unsure' : pref, postingState, false)?.type ?? 'explore'
      const base =
        origin === 'asked' && clarity === 'vague'
          ? (card.example_question ?? fill(T.recheck_example, card.label))
          : stripAnchor(questionTemplate(card, firstType, found))
      const lead = recheckLead(card, origin, evidence)
      return lead ? `${lead} ${base}` : base
    }
    case 'scope':
      return fill(T.scope[pref === 'avoid' ? 'avoid' : 'want'], card.label)
    case 'signal':
      return `${fill(T.signal_lead, card.label)} ${stripAnchor(questionTemplate(card, 'prevent'))}`
    case 'opportunity':
      return stripAnchor(card.questions.opportunity)
  }
}

export interface FinalRanked {
  rank: number
  /** 카드 ID 또는 "offer:<topic>" */
  key: string
  card_id?: string
  topic?: BlankTopic
  /** 카드 이름 또는 근로조건 이름("근로시간 · 공고 누락") */
  label: string
  type: FinalQType
  priority: number
  origin: Origin | 'offer'
  /** 카드 질문만: 공고 상태 · 면접 뒤 상태 · 내 선호 */
  posting_state?: PostingState
  review_state?: ReviewState
  pref?: FinalPref
  evidence?: Evidence
  basis: string
  watch_out: string
  good_sign: string
  /** 표현 단계: 기본 · 완충 · 직접 */
  tone: Tone
  /** 완충 문장(없으면 빈 문자열) */
  cushion: string
  /** 완충 문장을 뺀 검수 문장 */
  template: string
  /** 완충 문장 + 검수 문장 */
  template_text: string
}

type Candidate = Omit<FinalRanked, 'rank' | 'tone' | 'cushion' | 'template_text'> & { order: number; reason?: NotAskedReason }

const byPriority = (a: Candidate, b: Candidate) => a.priority - b.priority || a.order - b.order

function cardCandidates(picks: readonly CardPick[], judged: readonly Judged[], analysis: PostingAnalysis): Candidate[] {
  const out: Candidate[] = []
  for (const j of judged) {
    const card = getCard(j.card_id)
    if (!card) continue
    const pref = finalPrefOf(picks, j.card_id)
    const hit = classifyFinal(j.state, pref)
    if (!hit) continue
    const found = analysis.cards.find((c) => c.card_id === j.card_id)
    const postingState: PostingState = found?.state ?? 'absent'
    const c: Candidate = {
      key: card.id,
      card_id: card.id,
      label: card.label,
      type: hit.type,
      priority: hit.priority,
      origin: j.origin,
      posting_state: postingState,
      review_state: j.state,
      pref,
      basis: `${j.basis} · ${found?.reason ?? ABSENT_REASON}`,
      watch_out: pref === 'want' ? card.interpretation.mismatch_if_want : card.interpretation.mismatch_if_avoid,
      good_sign: card.interpretation.good_if,
      template: finalCardTemplate(card, hit.type, pref, postingState, j.origin, found?.evidence, found, j.clarity),
      order: j.order,
    }
    if (found?.evidence) c.evidence = found.evidence
    if (j.reason) c.reason = j.reason
    out.push(c)
  }
  return out.sort(byPriority)
}

/** 처우 질문 재료: 공고에 없음 → 모호 → 확인 필요 순서 */
function offerCandidates(analysis: PostingAnalysis): Candidate[] {
  const order = FINAL_BOOK.offer_status_order
  return analysis.blanks
    .map((b, i) => ({ b, i }))
    .sort((x, y) => order.indexOf(x.b.status) - order.indexOf(y.b.status) || x.i - y.i)
    .map(({ b, i }) => {
      const topic = FINAL_BOOK.offer_topics[b.topic]
      const c: Candidate = {
        key: `offer:${b.topic}`,
        topic: b.topic,
        label: b.label,
        type: 'offer',
        priority: FINAL_BOOK.offer_priority,
        origin: 'offer',
        basis: b.basis,
        watch_out: topic.watch_out,
        good_sign: topic.good_sign,
        template: b.question,
        order: 100 + i,
      }
      if (b.evidence) c.evidence = b.evidence
      return c
    })
}

export interface FinalRankInput {
  picks: readonly CardPick[]
  judged: readonly Judged[]
  mood: Mood
  analysis: PostingAnalysis
}

/** 한 결과에 붙이는 완충 문장 수 한도. 같은 완충 문장을 두 번 쓰지 않는다(A2-08, D-061의 되풀이 방지) */
export const CUSHION_LIMIT = 2

/**
 * 최종 질문 목록(순서·유형·검수 문장·표현 단계). 카드 질문 5개 이하 + 처우 질문 3개 이하 = 8개 이하.
 * 완충 문장: 분위기 "압박이 있었어요"면 첫 질문과 첫 처우 질문, 그리고 "분위기가 아니었어요"로 못 물은 질문.
 * 위에서부터 CUSHION_LIMIT 개(완충 문장 종류 수까지)만 붙이고, 그 뒤 질문은 기본(보통 앞말) 단계다.
 * 분위기 "편했어요"면 직접(앞말 없이 바로 묻기). 단 첫 처우 질문은 업무 이야기에서 근무 조건으로 넘어가는 자리라
 * 짧은 앞말 하나를 둔다(H2-10 ②).
 */
export function rankFinal(input: FinalRankInput): FinalRanked[] {
  const { limits, cushions } = FINAL_BOOK
  const cards = cardCandidates(input.picks, input.judged, input.analysis).slice(0, limits.cards)
  const offers = offerCandidates(input.analysis).slice(0, limits.offers)
  const all = [...cards, ...offers].sort(byPriority).slice(0, limits.total)
  const cushionLimit = Math.min(CUSHION_LIMIT, cushions.length)

  let used = 0
  let offerSeen = false
  return all.map((c, i) => {
    let wants = c.reason === 'bad_mood'
    const firstOffer = c.origin === 'offer' && !offerSeen
    if (input.mood === 'pressured' && (i === 0 || firstOffer)) wants = true
    if (c.origin === 'offer') offerSeen = true
    const cushioned = wants && used < cushionLimit
    const cushion = cushioned ? (cushions[used++] ?? '') : ''
    // 완충을 바랐지만 한도를 넘은 질문은 "편했어요"여도 직접이 아니라 기본 앞말로 묻는다
    const tone: Tone = cushioned ? 'cushion' : wants || firstOffer || input.mood !== 'relaxed' ? 'basic' : 'direct'
    const ranked: FinalRanked = {
      rank: i + 1,
      key: c.key,
      label: c.label,
      type: c.type,
      priority: c.priority,
      origin: c.origin,
      basis: c.basis,
      watch_out: c.watch_out,
      good_sign: c.good_sign,
      tone,
      cushion,
      template: c.template,
      template_text: `${cushion}${c.template}`,
    }
    if (c.card_id) ranked.card_id = c.card_id
    if (c.topic) ranked.topic = c.topic
    if (c.posting_state) ranked.posting_state = c.posting_state
    if (c.review_state) ranked.review_state = c.review_state
    if (c.pref) ranked.pref = c.pref
    if (c.evidence) ranked.evidence = c.evidence
    return ranked
  })
}
