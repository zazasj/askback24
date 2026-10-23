/**
 * 1차·기술 면접 질문 순서 규칙(데모 v0.2 classify()·build() 이관).
 * 질문 순서는 여기서만 정한다. 화면·서버 함수·대체 결과가 모두 이 함수를 쓴다.
 */
import type { CardDef, CardPick, Evidence, GapRule, PostingAnalysis, PostingState, Pref, QType } from './contract'
import { CARD_BOOK, getCard } from './catalog'

export const QUESTION_LIMIT = 5
export const ABSENT_REASON = '공고에 근거가 없어 직접 확인이 필요해요'

export interface Classified {
  type: QType
  priority: number
}

/** 내 선호 × 공고 상태 → 질문 유형과 우선순위(작을수록 위). 해당 규칙이 없으면 null */
export function classify(
  pref: Pref,
  state: PostingState,
  hasAnchor: boolean,
  rules: readonly GapRule[] = CARD_BOOK.gap_rules,
): Classified | null {
  for (const r of rules) {
    if (r.preference !== pref || !r.posting.includes(state)) continue
    const priority = hasAnchor && r.with_experience_priority !== undefined ? r.with_experience_priority : r.priority
    return { type: r.type, priority }
  }
  return null
}

/** 경험 한 줄 → 질문 앞에 붙일 말("…봤는데, "). 비어 있으면 빈 문자열 */
export function anchorText(experience?: string): string {
  const t = (experience ?? '').trim().replace(/[,.\s]+$/, '')
  return t ? `${t}, ` : ''
}

/** 유형에 맞는 질문 틀. 충돌 예방 틀이 없는 카드는 충돌 확인 틀(공고 전제 없는 비중 질문)을 쓴다 */
export function questionTemplate(card: CardDef, type: QType): string {
  return card.questions[type] ?? card.questions.conflict
}

export function typeLabel(type: QType): string {
  return CARD_BOOK.type_labels[type]
}

export interface RankedPick {
  card_id: string
  pref: Pref
  state: PostingState
  type: QType
  priority: number
  /** picks 안 순서. 우선순위가 같으면 먼저 고른 것이 위 */
  order: number
  evidence?: Evidence
  reason: string
  /** 경험 한 줄이 실제로 문장에 붙었는지("경험 포함" 칩) */
  has_exp: boolean
  /** 검수 문장(질문 틀 + 경험) */
  template_text: string
  watch_out: string
  good_sign: string
}

export interface PickInput {
  picks: readonly CardPick[]
  experience?: string
}

/** 고른 카드 전부를 규칙 순서대로 정렬한다(잘라내기 전). */
export function rankPicks(input: PickInput, analysis: PostingAnalysis): RankedPick[] {
  const anchor = anchorText(input.experience)
  const out: RankedPick[] = []
  input.picks.forEach((pick, order) => {
    const card = getCard(pick.card_id)
    if (!card) return
    const found = analysis.cards.find((c) => c.card_id === pick.card_id)
    const state: PostingState = found?.state ?? 'absent'
    const cardAnchor = pick.pref === 'want' && pick.has_exp ? anchor : ''
    const hit = classify(pick.pref, state, cardAnchor !== '')
    if (!hit) return
    const template = questionTemplate(card, hit.type)
    const ranked: RankedPick = {
      card_id: card.id,
      pref: pick.pref,
      state,
      type: hit.type,
      priority: hit.priority,
      order,
      reason: found?.reason ?? ABSENT_REASON,
      has_exp: cardAnchor !== '' && template.includes('{anchor}'),
      template_text: template.replace('{anchor}', cardAnchor),
      watch_out: pick.pref === 'want' ? card.interpretation.mismatch_if_want : card.interpretation.mismatch_if_avoid,
      good_sign: card.interpretation.good_if,
    }
    if (found?.evidence) ranked.evidence = found.evidence
    out.push(ranked)
  })
  return out.sort((a, b) => a.priority - b.priority || a.order - b.order)
}

/** 1차·기술 면접에 가져갈 질문 5개(데모 v0.2 build()와 같은 결과). */
export function pickTop5(input: PickInput, analysis: PostingAnalysis, limit = QUESTION_LIMIT): RankedPick[] {
  return rankPicks(input, analysis).slice(0, limit)
}
