/**
 * 공고 형광펜. 원문을 조각으로 나눠 v-for 로 그린다(v-html 금지).
 * 근거 quote 는 원문 필드 값의 글자 그대로 일부라서, 원문에 없는 인용은 칠하지 않고 버린다.
 */
import type { EvidenceField, PostingAnalysis } from '@shared/contract'

export interface MarkRef {
  field: EvidenceField
  quote: string
  cardId: string
}

export interface Segment {
  text: string
  /** 원문 안 시작 위치. 형광펜 열쇠로 쓴다 */
  start: number
  /** 비어 있으면 형광펜 없는 글. 같은 인용을 근거로 쓴 카드가 여럿이면 모두 단다 */
  cardIds: string[]
}

/** 분석 카드의 근거 → 형광펜 목록 */
export function marksOf(analysis: PostingAnalysis | undefined): MarkRef[] {
  return (analysis?.cards ?? []).flatMap((c) =>
    c.evidence && c.evidence.quote ? [{ field: c.evidence.field, quote: c.evidence.quote, cardId: c.card_id }] : [],
  )
}

export function splitByQuotes(text: string, marks: ReadonlyArray<{ quote: string; cardId: string }>): Segment[] {
  const byQuote = new Map<string, string[]>()
  for (const m of marks) {
    if (!m.quote) continue
    const ids = byQuote.get(m.quote) ?? []
    if (!ids.includes(m.cardId)) ids.push(m.cardId)
    byQuote.set(m.quote, ids)
  }
  const hits = [...byQuote]
    .map(([quote, cardIds]) => ({ quote, cardIds, at: text.indexOf(quote) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at || b.quote.length - a.quote.length)

  const out: Segment[] = []
  let pos = 0
  for (const h of hits) {
    if (h.at < pos) continue // 겹치면 앞의 것만
    if (h.at > pos) out.push({ text: text.slice(pos, h.at), start: pos, cardIds: [] })
    out.push({ text: h.quote, start: h.at, cardIds: h.cardIds })
    pos = h.at + h.quote.length
  }
  if (pos < text.length) out.push({ text: text.slice(pos), start: pos, cardIds: [] })
  return out
}

/** 한 필드의 형광펜 조각. 그 필드를 가리키는 인용만 쓴다 */
export function segmentsFor(field: EvidenceField, text: string, marks: readonly MarkRef[]): Segment[] {
  return splitByQuotes(
    text,
    marks.filter((m) => m.field === field),
  )
}

export const markKey = (field: string, seg: Segment): string => `${field}:${seg.start}`
