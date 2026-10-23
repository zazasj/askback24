import { describe, expect, it } from 'vitest'
import { CARDS, POSTINGS } from '@shared/catalog'
import { auditNumbers, sourceRows } from './aboutData'

describe('/about-ai 점검 숫자', () => {
  it('카드·공고 수와 근거 인용 수를 데이터에서 센다. 원문에 없는 근거는 0건', () => {
    const n = auditNumbers()
    expect(n.cards).toBe(CARDS.length)
    expect(n.postings).toBe(POSTINGS.length)
    expect(n.quotes).toBeGreaterThan(0)
    expect(n.quotesFound).toBe(n.quotes)
    // 카드마다 기본 틀 4종 이상
    expect(n.templates).toBeGreaterThanOrEqual(CARDS.length * 4)
  })
})

describe('S4-24 데이터 출처 표', () => {
  it('"실제"와 "모의"가 모두 있고, 회사 신호 출처는 "실제" 먼저 한 번씩', () => {
    const rows = sourceRows()
    expect(rows.some((r) => r.source === '실제')).toBe(true)
    expect(rows.some((r) => r.source === '모의')).toBe(true)
    const signals = rows.filter((r) => r.data === '회사 신호')
    expect(new Set(signals.map((r) => r.origin)).size).toBe(signals.length)
    expect(signals.map((r) => r.origin)).toContain('국민연금 사업장 가입자 현황')
    const firstMock = signals.findIndex((r) => r.source === '모의')
    expect(signals.slice(firstMock).every((r) => r.source === '모의')).toBe(true)
  })
})
