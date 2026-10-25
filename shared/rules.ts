/**
 * 1차·기술 면접 질문 순서 규칙(데모 v0.2 classify()·build() 이관).
 * 질문 순서는 여기서만 정한다. 화면·서버 함수·대체 결과가 모두 이 함수를 쓴다.
 */
import type { CardDef, CardPick, Evidence, GapRule, PostingAnalysis, PostingState, Pref, QType } from './contract.js'
import { CARD_BOOK, getCard } from './catalog.js'

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

/** 경험 글을 그대로 이으면 틀린 문장이 될 때 쓰는 앞말(경험 글은 옮기지 않는다) */
export const EXPERIENCE_LEAD = '제 경험과 이어지는 일이라 여쭤요. '

export interface ExperienceAnchor {
  /** 질문 틀의 {anchor} 자리에 넣을 말 */
  text: string
  /** 경험 글을 그대로 옮겼는지(false 면 EXPERIENCE_LEAD) */
  quoted: boolean
}

/** 한글 음절의 받침 번호(0 = 받침 없음, 4 = ㄴ). 한글이 아니면 null */
function jongOf(ch: string): number | null {
  const code = ch.charCodeAt(0)
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return null
  return (code - 0xac00) % 28
}

/**
 * 경험 한 줄을 질문 앞에 붙이는 방법(A2-06). 가짜 공급자 문장과 검수 문장이 모두 이 결과를 쓴다.
 * - "…는데"·"…ㄴ데"(…봤는데·…인데): 쉼표로 잇는다 → "…봤는데, 이 팀에서는 …"
 * - "…요"·"…다"(물음표·느낌표 포함): 한 문장으로 맺고 질문은 다음 문장 → "…했습니다. 이 팀에서는 …"
 * - 그 밖("…봄"·"…함"·명사): 이으면 틀린 문장이라 경험 글을 옮기지 않는 앞말을 쓴다
 * 비어 있으면 null.
 */
export function experienceAnchor(experience?: string): ExperienceAnchor | null {
  const t = (experience ?? '').trim().replace(/[,.\s]+$/, '')
  if (!t) return null
  if (/[?!]$/.test(t)) return { text: `${t} `, quoted: true }
  const last = t.slice(-1)
  if (last === '데' && jongOf(t.slice(-2, -1)) === 4) return { text: `${t}, `, quoted: true }
  if (last === '요' || last === '다') return { text: `${t}. `, quoted: true }
  return { text: EXPERIENCE_LEAD, quoted: false }
}

/** 경험 한 줄 → 질문 앞에 붙일 말("…봤는데, "). 비어 있으면 빈 문자열 */
export function anchorText(experience?: string): string {
  return experienceAnchor(experience)?.text ?? ''
}

/**
 * 유형에 맞는 질문 틀. 충돌 예방 틀이 없는 카드는 충돌 확인 틀(비중 질문)을 쓴다.
 * 틀은 어느 공고에나 쓰이므로 공고 내용을 말하지 않는다. 공고 인용은 근거(evidence)를 아는 앞말 몫(data.test.ts가 지킴)
 */
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
  /**
   * 경험 한 줄을 이 질문에 붙였는지("경험 포함" 칩). 경험 글을 그대로 잇지 못하는 끝말이면 검수 문장은
   * 중립 앞말(EXPERIENCE_LEAD)로 경험과 이어진 질문임만 밝히고, 칩과 AI에 보내는 경험은 그대로 둔다(A2-06)
   */
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

export const EXPLORE_LIMIT = 3

/**
 * "더 알아볼 질문"(U-03, D-176): 질문 5개에 들지 못한 "모르겠어요" 카드의 탐색 질문.
 * 규칙 순서 그대로라 공고와 관련 있는 카드(탐색 4.5)가 공고에 없는 카드(탐색 예비 5.0)보다 먼저 온다.
 * 질문 5개는 바꾸지 않는다.
 */
export function pickExplore(input: PickInput, analysis: PostingAnalysis, limit = EXPLORE_LIMIT): RankedPick[] {
  const ranked = rankPicks(input, analysis)
  const top = new Set(ranked.slice(0, QUESTION_LIMIT).map((r) => r.card_id))
  return ranked.filter((r) => r.type === 'explore' && !top.has(r.card_id)).slice(0, limit)
}
