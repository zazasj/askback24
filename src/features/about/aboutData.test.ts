import { describe, expect, it } from 'vitest'
import { CARDS, POSTINGS } from '@shared/catalog'
import { NCS_CARDS, SMALL_GIANTS } from '@/realData'
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

describe('DATA-06 출처 표의 고용24 오픈API 줄', () => {
  const rows = sourceRows()
  const text = (r: (typeof rows)[number]) => `${r.data} ${r.origin} ${r.note}`

  it('직무정보·직업정보·공통코드·강소기업 = "실제"(고용24 오픈API, 받은 날짜)', () => {
    for (const name of ['직무정보', '직업정보', '공통코드', '강소기업']) {
      const row = rows.find((r) => r.origin.includes(name) && r.source === '실제')
      expect(row, name).toBeDefined()
      expect(row?.origin, name).toMatch(/^고용24 오픈API /)
      expect(row?.fetched, name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('채용정보는 "모의"이고 이유(개인회원)를 적는다. "실제" 줄에는 채용정보가 없다', () => {
    const jobs = rows.filter((r) => text(r).includes('채용정보'))
    expect(jobs.length).toBeGreaterThan(0)
    expect(jobs.every((r) => r.source === '모의')).toBe(true)
    expect(jobs.some((r) => r.note.includes('개인회원'))).toBe(true)
  })

  it('강소기업 통계 줄에 전체 수와 정보통신업 수, 회사 신호의 강소기업 여부는 "모의"(DATA-04)', () => {
    const stats = rows.find((r) => r.data === '강소기업 통계')
    expect(stats?.note.replace(/,/g, '')).toContain(String(SMALL_GIANTS.total))
    expect(stats?.note.replace(/,/g, '')).toContain(String(SMALL_GIANTS.ict.count))
    // 정보통신업 수는 겹침 뺀 건수로 셌으니 전국 수도 같은 기준으로 먼저 쓰고 응답 total 과의 차이를 밝힌다(A1-05)
    expect(stats?.note.replace(/(\d),(?=\d{3})/g, '$1')).toMatch(
      new RegExp(`^전국 ${SMALL_GIANTS.counted}건\\(응답 ${SMALL_GIANTS.total}건 중 겹친 ${SMALL_GIANTS.total - SMALL_GIANTS.counted}건 뺌, 회사 ${SMALL_GIANTS.counted_companies}곳`),
    )
    const signal = rows.filter((r) => r.data === '회사 신호' && r.origin.includes('강소기업'))
    expect(signal.length).toBeGreaterThan(0)
    expect(signal.every((r) => r.source === '모의' && r.fetched === '')).toBe(true)
  })

  it('국민연금은 "실제", 임금체불은 "모의" 그대로', () => {
    expect(rows.filter((r) => text(r).includes('국민연금')).every((r) => r.source === '실제')).toBe(true)
    expect(rows.filter((r) => text(r).includes('임금체불')).every((r) => r.source === '모의')).toBe(true)
  })

  it('임금체불 줄은 명단이 일부 사업주만 공개한다는 것과 "명단에 없음 ≠ 체불 없음"을 밝힌다(A2-04)', () => {
    const unpaid = rows.find((r) => r.origin === '임금체불 사업주 명단')
    expect(unpaid?.source).toBe('모의')
    expect(unpaid?.note).toContain('일부 사업주만 공개해요')
    expect(unpaid?.note).toContain('명단에 없다고 체불이 없다는 뜻은 아니에요')
  })

  it('NCS 줄은 파일 경로 없이 방법(팀이 고른 능력단위명으로 찾음)과 파일에서 센 개수를 쓴다(A2-12)', () => {
    const ncs = rows.find((r) => r.data === '업무 카드 NCS 표시')
    const total = NCS_CARDS.cards.length
    const matched = NCS_CARDS.cards.filter((c) => c.matched).length
    expect(ncs?.note).not.toMatch(/data\/|\.json/)
    expect(ncs?.note).toContain('팀이 고른 능력단위명')
    expect(ncs?.note).toContain(`NCS 카드 ${total}개`)
    expect(ncs?.note).toContain(`${matched}개는 응답 값을 그대로`)
    expect(ncs?.note).toContain(`나머지 ${total - matched}개`)
  })
})
