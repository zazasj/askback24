/**
 * 공고 형광펜. 원문을 조각으로 나눠 v-for 로 그린다(v-html 금지).
 * 근거 quote 는 원문 필드 값의 글자 그대로 일부라서, 원문에 없는 인용은 칠하지 않고 버린다.
 */
import type { EvidenceField, Posting, PostingAnalysis } from '@shared/contract'
import { checkPoints, firstLooks } from './checkpoints'

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

/**
 * ① 형광펜 인용을 ① 표의 문서 순서로(같은 글은 한 번). ① 로딩이 이 공고 분석의 근거로 보여 준다(LD-01).
 * fields 는 ① 표 필드 순서(postingRows.ts POSTING_FIELD_ORDER)
 */
export function quotesInOrder(
  posting: Posting,
  analysis: PostingAnalysis | undefined,
  fields: ReadonlyArray<keyof Posting>,
  max = Infinity,
): string[] {
  const out: string[] = []
  for (const s of spotsInOrder(posting, analysis, fields)) {
    if (out.length >= max) break
    if (!out.includes(s.quote)) out.push(s.quote)
  }
  return out
}

/** ① 표 문서 순서의 형광펜 조각(① 화면의 spots 와 같은 순서·같은 카드) */
function spotsInOrder(
  posting: Posting,
  analysis: PostingAnalysis | undefined,
  fields: ReadonlyArray<keyof Posting>,
): Array<{ quote: string; cardIds: string[] }> {
  const marks = marksOf(analysis)
  return fields.flatMap((field) => {
    const text = String(posting[field] ?? '').trim()
    if (!text) return []
    return splitByQuotes(
      text,
      marks.filter((m) => m.field === field),
    )
      .filter((seg) => seg.cardIds.length)
      .map((seg) => ({ quote: seg.text, cardIds: seg.cardIds }))
  })
}

/**
 * ① 로딩의 근거 인용(LD-01, 최대 max개). 고르기는 "AI 분석 요약"의 먼저 볼 곳 인용이 먼저, 남는 자리는 문서 순서.
 * 보여 주는 순서는 문서 순서 그대로(PLAN-3 T4). 로딩 바로 다음 화면이 먼저 보라는 곳이 로딩에 빠지지 않게(A3-r1-16, D-245 보완)
 */
export function loadingQuotes(
  posting: Posting,
  analysis: PostingAnalysis | undefined,
  fields: ReadonlyArray<keyof Posting>,
  max = 4,
): string[] {
  const spots = spotsInOrder(posting, analysis, fields)
  const all = [...new Set(spots.map((s) => s.quote))]
  const spotOf = (cardId: string) => {
    const s = spots.find((x) => x.cardIds.includes(cardId))
    return s ? { key: s.quote, quote: s.quote } : undefined
  }
  const picked = new Set<string>()
  for (const look of firstLooks(checkPoints(analysis), spotOf)) if (picked.size < max) picked.add(look.quote)
  for (const q of all) {
    if (picked.size >= max) break
    picked.add(q)
  }
  return all.filter((q) => picked.has(q))
}
