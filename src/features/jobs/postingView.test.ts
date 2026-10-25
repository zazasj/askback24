import { describe, expect, it } from 'vitest'
import { POSTINGS, getPosting } from '@shared/catalog'
import { DETAIL_SECTIONS, EMPTY_TEXT, listOrder, matchesQuery, rowCode, rowText, salaryChunks, salaryText } from './postingView'

const OO = getPosting('K-MOCK-0001')!
const COMMERCE = getPosting('K-MOCK-0002')!

const row = (section: string, label: string) => {
  const r = DETAIL_SECTIONS.find((s) => s.title === section)?.rows.find((x) => x.label === label)
  if (!r) throw new Error(`${section} ${label}`)
  return r
}

describe('S3 공고 상세 칸', () => {
  it('S3-02 묶음 3개: 모집요강 · 근무조건 · 기업정보', () => {
    expect(DETAIL_SECTIONS.map((s) => s.title)).toEqual(['모집요강', '근무조건', '기업정보'])
  })

  it('임금은 형태와 금액을 띄어 잇고, 우대조건은 쉼표로 잇고, 인원에는 "명"을 붙인다', () => {
    expect(rowText(OO, row('근무조건', '임금'))).toBe('연봉 3,200만 원 ~ 3,800만 원')
    expect(rowText(OO, row('모집요강', '우대조건'))).toBe('고객사 상주 가능자, 정보처리기사')
    expect(rowText(OO, row('기업정보', '근로자 수'))).toBe('46명')
  })

  it('빈 칸은 빈 문자열이고 화면은 고용24처럼 "-"로 보인다(A2-03)', () => {
    expect(rowText(OO, row('근무조건', '근무시간'))).toBe('')
    expect(rowText(COMMERCE, row('근무조건', '임금'))).toBe('')
    expect(EMPTY_TEXT).toBe('-')
  })

  it('근무시간 칸이 비어도 직무내용에 근무 시간이 적힌 공고가 있다(그래서 빈 칸을 "공고에 적혀 있지 않아요"로 쓰지 않음)', () => {
    for (const id of ['K-MOCK-0004', 'K-MOCK-0006']) {
      const p = getPosting(id)!
      expect(rowText(p, row('근무조건', '근무시간')), id).toBe('')
      expect(p.jobCont, id).toMatch(/당직|출퇴근|코어타임/)
    }
  })

  it('목록 임금: 금액이 없으면 빈 문자열', () => {
    expect(salaryText(OO)).toBe('연봉 3,200만 원 ~ 3,800만 원')
    expect(salaryText(COMMERCE)).toBe('')
  })
})

describe('S3 목록', () => {
  it('최근 등록(공고 번호가 큰 것) 먼저, 원래 배열은 그대로', () => {
    const before = POSTINGS.map((p) => p.wantedAuthNo)
    const ids = listOrder(POSTINGS).map((p) => p.wantedAuthNo)
    expect(ids).toEqual([...before].sort().reverse())
    expect(POSTINGS.map((p) => p.wantedAuthNo)).toEqual(before)
  })

  it('검색어는 회사명·채용제목·직무내용·근무지역에서 띄어쓰기 없이 찾는다', () => {
    expect(matchesQuery(OO, '')).toBe(true)
    expect(matchesQuery(OO, 'OO 소프트')).toBe(true)
    expect(matchesQuery(OO, '백엔드')).toBe(true)
    expect(matchesQuery(COMMERCE, 'aws')).toBe(true)
    expect(matchesQuery(OO, '커머스')).toBe(false)
  })
})

describe('Q-04 (DA-06) 임금 글 조각', () => {
  it('금액과 단위, "~"와 뒤 금액, 괄호 묶음은 한 조각이다', () => {
    expect(salaryChunks('연봉 3,200만 원 ~ 3,800만 원')).toEqual(['연봉', '3,200만 원', '~ 3,800만 원'])
    expect(salaryChunks('연봉 3,400만원 이상 (협의 가능)')).toEqual(['연봉', '3,400만원', '이상', '(협의 가능)'])
    expect(salaryChunks('월급 250 만 원')).toEqual(['월급', '250 만 원'])
    expect(salaryChunks('연봉 회사내규에 따름')).toEqual(['연봉', '회사내규에', '따름'])
    expect(salaryChunks('')).toEqual([])
  })

  it('목록의 모든 공고 임금 조각을 이으면 원래 글과 같다', () => {
    for (const p of POSTINGS) expect(salaryChunks(salaryText(p)).join(' ')).toBe(salaryText(p))
  })
})

describe('H1-08 S3 상세 모집직종 칸에 공통코드(직종코드)', () => {
  it('모집직종 뒤에 "(직종코드 133200)", 코드 칸이 없는 줄은 빈 문자열', () => {
    expect(rowText(OO, row('모집요강', '모집직종'))).toBe('응용 소프트웨어 개발자')
    expect(rowCode(OO, row('모집요강', '모집직종'))).toBe('(직종코드 133200)')
    expect(rowCode(OO, row('모집요강', '경력'))).toBe('')
  })
})
