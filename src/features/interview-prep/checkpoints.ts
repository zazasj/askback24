/**
 * ① "AI가 찾은 확인할 점" 목록과 카드의 공고 표시. 분석 JSON 만 읽고 새 판단은 하지 않는다.
 * 회사를 평가하는 말 대신 "공고에 어떻게 적혀 있는지"만 짧게 붙인다.
 */
import { getCard } from '@shared/catalog'
import type { AnalysisCard, OfferBlank, PostingAnalysis, PostingState } from '@shared/contract'

/** 카드·확인할 점에 다는 공고 상태 표시. 공고에 없는 카드는 표시하지 않는다 */
export const POSTING_TAGS: Record<PostingState, string | null> = {
  explicit: '공고에 있음',
  inferred: '공고에서 유추',
  vague: '모호한 표현',
  absent: null,
}

/** 근로조건이 공고에 어떻게 적혔는지. ① 확인할 점과 최종 ③ 처우 질문이 같은 말을 쓰게 여기서만 정한다(DR-r1-12) */
export const BLANK_TAGS: Record<OfferBlank['status'], string> = { missing: '공고에 없음', vague: '모호한 표현', check: '확인 필요' }

/**
 * 분석 카드 한 장의 공고 상태 표시. 유추했지만 근거 인용이 없으면 공고 문장에서 유추한 게 아니라
 * 공고에 적히지 않은 점이라 "공고에 없음"으로 붙인다(DR-r2-03)
 */
export function postingTag(found: Pick<AnalysisCard, 'state' | 'evidence'> | undefined): string | null {
  if (!found) return null
  if (found.state === 'inferred' && !found.evidence) return BLANK_TAGS.missing
  return POSTING_TAGS[found.state]
}

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
    const tag = postingTag(c)
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
      p: { key: `blank:${b.topic}`, tag: BLANK_TAGS[b.status], title: b.label, detail: b.basis, hasMark: false },
    })
  })

  return ranked.sort((a, b) => a.w - b.w || a.i - b.i).map((r) => r.p)
}

/** ① "AI 분석 요약"의 먼저 볼 곳 한 개 */
export interface FirstLook {
  /** 형광펜 열쇠(같은 형광펜을 가리키는 카드는 한 번만 보인다) */
  key: string
  cardId: string
  /** 화면에 칠한 형광펜 글(공고 원문 그대로) */
  quote: string
  reason: string
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 한 줄 이유: 인용은 따로 보이므로 설명에서 '인용' 부분을 뺀다("'기타 업무 지원'은 범위가 …" → "범위가 …",
 * "우대조건에 '…'가 적혀 있어요" → "우대조건에 적혀 있어요"). 설명에 카드 이름이 없으면 앞에 붙인다.
 */
export function shortReason(title: string, detail: string, quote: string): string {
  const q = `['‘]${escapeRe(quote)}['’]`
  const stripped = detail
    .replace(new RegExp(`${q}(?:은|는|이|가)\\s+`), '')
    .replace(new RegExp(`\\s*${q}`), '')
    .trim()
  const reason = stripped || detail
  return reason.includes(title) ? reason : `${title} · ${reason}`
}

/**
 * 먼저 볼 곳: 확인할 점 순서(모호한 업무 → 근무 방식·환경 → …)에서 공고 형광펜으로 갈 수 있는 앞의 n개.
 * spotOf 는 카드 → 화면에 칠한 형광펜(겹친 인용은 앞의 것만 칠해지므로 화면 기준으로 찾는다).
 */
export function firstLooks(
  points: readonly CheckPoint[],
  spotOf: (cardId: string) => { key: string; quote: string } | undefined,
  n = 2,
): FirstLook[] {
  const out: FirstLook[] = []
  for (const p of points) {
    if (out.length >= n) break
    if (!p.hasMark || !p.cardId) continue
    const spot = spotOf(p.cardId)
    if (!spot || out.some((o) => o.key === spot.key)) continue
    out.push({ key: spot.key, cardId: p.cardId, quote: spot.quote, reason: shortReason(p.title, p.detail, spot.quote) })
  }
  return out
}
