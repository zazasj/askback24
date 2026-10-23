import { describe, expect, it } from 'vitest'
import { POSTINGS, getPosting } from '@shared/catalog'
import { DETAIL_SECTIONS, listOrder, matchesQuery, rowText, salaryText } from './postingView'

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

  it('공고에 없는 칸은 빈 문자열(화면이 "공고에 적혀 있지 않아요"로 보임)', () => {
    expect(rowText(OO, row('근무조건', '근무시간'))).toBe('')
    expect(rowText(COMMERCE, row('근무조건', '임금'))).toBe('')
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
