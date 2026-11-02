import { describe, expect, it } from 'vitest'
import { ANALYSES, CARDS, POSTINGS } from '@shared/catalog'
import { NCS_CARDS, SMALL_GIANTS } from '@/realData'
import { TEAM_MEASURE, analysisMade, auditNumbers, kstDate, sourceRows, wageBlankRate } from './aboutData'

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
  it('"실제"와 "모의"가 모두 있고, 회사 참고 정보 출처는 "실제" 먼저 한 번씩', () => {
    const rows = sourceRows()
    expect(rows.some((r) => r.source === '실제')).toBe(true)
    expect(rows.some((r) => r.source === '모의')).toBe(true)
    const signals = rows.filter((r) => r.data === '회사 참고 정보')
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

  it('강소기업 통계 줄에 전체 수와 정보통신업 수, 회사 참고 정보의 강소기업 여부는 "모의"(DATA-04)', () => {
    const stats = rows.find((r) => r.data === '강소기업 통계')
    expect(stats?.note.replace(/,/g, '')).toContain(String(SMALL_GIANTS.total))
    expect(stats?.note.replace(/,/g, '')).toContain(String(SMALL_GIANTS.ict.count))
    // 정보통신업 수는 겹침 뺀 건수로 셌으니 전국 수도 같은 기준으로 먼저 쓰고 응답 total 과의 차이를 밝힌다(A1-05)
    expect(stats?.note.replace(/(\d),(?=\d{3})/g, '$1')).toMatch(
      new RegExp(`^전국 ${SMALL_GIANTS.counted}건\\(응답 ${SMALL_GIANTS.total}건 중 겹친 ${SMALL_GIANTS.total - SMALL_GIANTS.counted}건 뺌, 회사 ${SMALL_GIANTS.counted_companies}곳`),
    )
    const signal = rows.filter((r) => r.data === '회사 참고 정보' && r.origin.includes('강소기업'))
    expect(signal.length).toBeGreaterThan(0)
    expect(signal.every((r) => r.source === '모의' && r.fetched === '')).toBe(true)
  })

  // 시연 회사가 가상이라 국민연금 줄은 모의다(D-344·D-370). 매핑한 회사만 실제가 된다.
  it('국민연금은 "모의", 임금체불은 "모의"', () => {
    expect(rows.filter((r) => text(r).includes('국민연금')).every((r) => r.source === '모의')).toBe(true)
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
    // 나머지(팀이 고른 값)는 따로 "모의" 줄에 센다(H1-09 ①)
    expect(rows.find((r) => r.data === '업무 카드 NCS 참고 표시')?.note).toContain(`나머지 ${total - matched}개`)
  })

  it('H1-09 NCS는 응답 값 줄 = "실제", 팀이 고른 값 줄 = "모의"로 나누고, 업무 카드 17개 줄은 "모의"', () => {
    expect(rows.find((r) => r.data === '업무 카드 NCS 표시')?.source).toBe('실제')
    const team = rows.find((r) => r.data === '업무 카드 NCS 참고 표시')
    expect(team?.source).toBe('모의')
    expect(team?.fetched).toBe('')
    expect(team?.note).toContain('NCS 참고')
    const cards = rows.find((r) => r.data === `업무 카드 ${CARDS.length}개`)
    expect(cards?.source).toBe('모의')
    expect(cards?.note).toBe('공공 자료를 참고해 팀이 나눈 업무예요.')
  })
})

// T4 · C4-04 · A4-03·A4-04: 공고 분석 7건을 만든 방법(파이프라인 초안 + 팀 검수, D-374)과 모델·날짜
describe('공고 분석을 만든 방법', () => {
  it('kstDate: UTC 시각을 한국 날짜로(밤 9시 넘으면 다음 날)', () => {
    expect(kstDate('2026-10-30T15:38:49.813128+00:00')).toBe('2026-10-31')
    expect(kstDate('2026-10-30T14:59:59+00:00')).toBe('2026-10-30')
    expect(kstDate('날짜 아님')).toBe('')
  })

  it('시연 공고 분석은 모두 파이프라인 meta(모델·만든 때)를 갖고, 모델·날짜는 그 값에서 읽는다', () => {
    expect(ANALYSES.length).toBe(POSTINGS.length)
    for (const a of ANALYSES) {
      expect(a.meta?.model, a.wantedAuthNo).toBeTruthy()
      expect(kstDate(a.meta?.created_at ?? ''), a.wantedAuthNo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    const made = analysisMade()
    expect(made.model.split(' · ').sort()).toEqual([...new Set(ANALYSES.map((a) => a.meta?.model))].sort())
    const days = [...new Set(ANALYSES.map((a) => kstDate(a.meta?.created_at ?? '')))].sort()
    expect(made.date).toBe(days.length > 1 ? `${days[0]}~${days[days.length - 1]}` : days[0])
    // UTC 날짜(2026-10-30)가 아니라 한국 날짜
    expect(made.date).not.toContain('2026-10-30')
  })

  it('A4-04 출처 표에 "공고 분석 N건" 줄: 파이프라인 초안(엔노이아 모델, 날짜) + 팀 검수, 구분 "모의", 받은 날짜 없음', () => {
    const rows = sourceRows()
    const { model, date } = analysisMade()
    const row = rows.find((r) => r.data === `공고 분석 ${ANALYSES.length}건`)
    expect(row).toBeDefined()
    expect(row?.origin).toBe(`AI 공고 분석 파이프라인 초안(엔노이아 ${model}, ${date}) + 팀 검수`)
    expect(row?.source).toBe('모의')
    expect(row?.fetched).toBe('')
    expect(row?.note).toBe('모의 공고를 AI가 분석한 초안이에요. 팀이 공고 원문에 비춰 판정·근거를 고치고 이유 문장을 다듬어 넣었어요.')
    // 채용 공고 줄 바로 뒤, 회사 참고 정보 앞
    const at = rows.indexOf(row!)
    expect(rows[at - 1]?.data).toBe('채용 공고')
    expect(rows[at + 1]?.data).toBe('회사 참고 정보')
  })
})

describe('W-08 팀 실측 칸', () => {
  it('고용24 "개발자" 공개 공고 50건 중 임금 빈칸·협의 40건 = 80%, 근무시간 빈칸 37건, 2026-10-05', () => {
    expect(TEAM_MEASURE).toEqual({ query: '개발자', postings: 50, wageBlank: 40, hoursBlank: 37, measuredOn: '2026-10-05' })
    expect(wageBlankRate()).toBe(80)
  })
})
