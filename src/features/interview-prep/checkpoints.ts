/**
 * ① "AI가 찾은 확인할 점" 목록과 카드의 공고 표시. 분석 JSON 만 읽고 새 판단은 하지 않는다.
 * 회사를 평가하는 말 대신 "공고에 어떻게 적혀 있는지"만 짧게 붙인다.
 */
import { getCard } from '@shared/catalog'
import type { PostingAnalysis, PostingState } from '@shared/contract'

/** 카드·확인할 점에 다는 공고 상태 표시. 공고에 없는 카드는 표시하지 않는다 */
export const POSTING_TAGS: Record<PostingState, string | null> = {
  explicit: '공고에 있음',
  inferred: '공고에서 유추',
  vague: '모호한 표현',
  absent: null,
}

const BLANK_TAGS = { missing: '공고에 없음', vague: '모호한 표현' } as const

export interface CheckPoint {
  key: string
  tag: string
  /** 카드 이름 또는 근로조건 이름 */
  title: string
  detail: string
  /** 공고 형광펜으로 갈 수 있는 카드 */
  cardId?: string
  hasMark: boolean
}

/**
 * 순서: 모호한 업무 → 근무 방식·환경 → 공고에 없거나 모호한 근로조건 → 유추한 업무 → 적혀 있는 업무.
 * 근로조건 중 "확인 필요"(적혀 있지만 물어볼 것)는 최종 면접 처우 질문 재료라 여기서는 뺀다.
 */
export function checkPoints(analysis: PostingAnalysis | undefined): CheckPoint[] {
  if (!analysis) return []
  const ranked: Array<{ w: number; i: number; p: CheckPoint }> = []

  analysis.cards.forEach((c, i) => {
    const card = getCard(c.card_id)
    const tag = POSTING_TAGS[c.state]
    if (!card || !tag) return
    const w = c.state === 'vague' ? 0 : card.kind === 'context' ? 1 : c.state === 'inferred' ? 4 : 5
    ranked.push({
      w,
      i,
      p: { key: `card:${c.card_id}`, tag, title: card.label, detail: c.reason, cardId: c.card_id, hasMark: !!c.evidence },
    })
  })

  analysis.blanks.forEach((b, i) => {
    if (b.status === 'check') return
    ranked.push({
      w: b.status === 'missing' ? 2 : 3,
      i,
      p: { key: `blank:${b.topic}`, tag: BLANK_TAGS[b.status], title: b.label.split(' · ')[0] ?? b.label, detail: b.basis, hasMark: false },
    })
  })

  return ranked.sort((a, b) => a.w - b.w || a.i - b.i).map((r) => r.p)
}
