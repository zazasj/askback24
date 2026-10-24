import { describe, expect, it } from 'vitest'
import { POSTINGS, getAnalysis } from '@shared/catalog'
import type { Posting, PostingAnalysis } from '@shared/contract'
import { checkPoints, firstLooks, shortReason } from './checkpoints'
import { markKey, marksOf, segmentsFor } from './highlight'

/** 화면(PostingStep)처럼 카드 → 칠한 형광펜(열쇠·글)을 찾는다 */
function spotResolver(posting: Posting, analysis: PostingAnalysis) {
  const marks = marksOf(analysis)
  return (cardId: string) => {
    const field = analysis.cards.find((c) => c.card_id === cardId)?.evidence?.field
    if (!field) return undefined
    const seg = segmentsFor(field, String(posting[field] ?? ''), marks).find((s) => s.cardIds.includes(cardId))
    return seg ? { key: markKey(field, seg), quote: seg.text } : undefined
  }
}

describe('AI 분석 요약 — 먼저 볼 두 곳(F-04)', () => {
  it('(주)OO소프트: 모호한 업무 "기타 업무 지원" → 근무 방식 "고객사 상주 가능자" 순서, 이유에는 인용을 되풀이하지 않는다', () => {
    const posting = POSTINGS.find((p) => p.wantedAuthNo === 'K-MOCK-0001')
    const analysis = getAnalysis('K-MOCK-0001')
    if (!posting || !analysis) throw new Error('K-MOCK-0001 없음')
    const looks = firstLooks(checkPoints(analysis), spotResolver(posting, analysis))
    expect(looks.map((l) => l.quote)).toEqual(['기타 업무 지원', '고객사 상주 가능자'])
    expect(looks.map((l) => l.reason)).toEqual(['범위가 모호해 기존 시스템 유지보수가 포함될 수 있어요', '고객사 상주 개발 · 우대조건에 적혀 있어요'])
  })

  it('모든 공고: 최대 2곳, 형광펜이 서로 다르고 인용이 원문에 있으며, 이유는 비어 있지 않고 인용 따옴표를 남기지 않는다', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      if (!analysis) continue
      const resolve = spotResolver(posting, analysis)
      const looks = firstLooks(checkPoints(analysis), resolve)
      const where = posting.wantedAuthNo
      const marked = new Set(checkPoints(analysis).flatMap((p) => (p.hasMark && p.cardId ? [resolve(p.cardId)?.key ?? ''] : [])).filter(Boolean))
      expect(looks.length, where).toBe(Math.min(2, marked.size))
      expect(new Set(looks.map((l) => l.key)).size, where).toBe(looks.length)
      const text = Object.values(posting).filter((v) => typeof v === 'string').join('\n')
      for (const l of looks) {
        expect(text.includes(l.quote), `${where} ${l.quote}`).toBe(true)
        expect(l.reason.length, `${where} ${l.reason}`).toBeGreaterThanOrEqual(4)
        expect(l.reason, where).not.toContain(`'${l.quote}'`)
        expect(l.reason, where).not.toMatch(/^\s|\s$|\s{2}/)
      }
    }
  })
})

describe('shortReason', () => {
  it('인용 + 조사로 시작하면 그 부분을 빼고, 카드 이름이 이미 있으면 붙이지 않는다', () => {
    expect(shortReason('기존 시스템 유지보수', "'기타 업무 지원'은 범위가 모호해 기존 시스템 유지보수가 포함될 수 있어요", '기타 업무 지원')).toBe(
      '범위가 모호해 기존 시스템 유지보수가 포함될 수 있어요',
    )
  })

  it('문장 가운데 인용은 조사를 앞말에 붙여 남기고, 카드 이름을 앞에 붙인다', () => {
    expect(shortReason('SQL 작성·쿼리 개선', "자격요건 'SQL 기본 문법을 이해하시는 분'에서 쿼리 작성 업무를 유추했어요", 'SQL 기본 문법을 이해하시는 분')).toBe(
      'SQL 작성·쿼리 개선 · 자격요건에서 쿼리 작성 업무를 유추했어요',
    )
    expect(shortReason('장애 대응·온콜', "직무내용에 '24시간 서비스 모니터링(당직 순번제)'이 적혀 있어요", '24시간 서비스 모니터링(당직 순번제)')).toBe(
      '장애 대응·온콜 · 직무내용에 적혀 있어요',
    )
  })

  it('설명에 인용이 없으면 그대로 둔다', () => {
    expect(shortReason('요구사항 협의', '고객사에 상주하면 고객과 요구사항을 직접 협의할 수 있어요(우대조건에서 유추)', '고객사 상주 가능자')).toBe(
      '요구사항 협의 · 고객사에 상주하면 고객과 요구사항을 직접 협의할 수 있어요(우대조건에서 유추)',
    )
  })
})
