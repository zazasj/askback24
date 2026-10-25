/**
 * DATA-01~05: 고용24 오픈API에서 받아 둔 data/real/*.json 과 화면 표시가 맞는지.
 * 파일만 읽는다(고용24를 부르지 않는다).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CARDS, POSTINGS } from '@shared/catalog'
import codesJson from '@data/real/common-codes.json'
import { JOB_INFO, NCS_CARDS, SMALL_GIANTS, fetchedOn, ncsLine } from './realData'

type CodeBook = { fetched_on: string; region: { codes: Array<{ code: string; name: string }> }; jobs: { codes: Array<{ code: string; name: string }> } }
const CODES = codesJson as unknown as CodeBook
const REAL_DIR = fileURLToPath(new URL('../data/real/', import.meta.url))

describe('DATA-01 업무 카드 NCS(직무정보 215L01)', () => {
  const ncsCards = CARDS.filter((c) => c.ncs.length > 0)

  it('NCS 가 붙은 카드 15개마다 한 줄씩, 받은 날짜가 있다', () => {
    expect(ncsCards).toHaveLength(15)
    expect(NCS_CARDS.cards.map((e) => e.card_id)).toEqual(ncsCards.map((c) => c.id))
    expect(NCS_CARDS.fetched_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(NCS_CARDS.matched_count).toBe(NCS_CARDS.cards.filter((e) => e.matched).length)
  })

  it('찾은 카드는 능력단위명·정의·코드·lod 주소가 있고, 이름은 팀이 붙인 능력단위 중 하나와 같다', () => {
    const matched = NCS_CARDS.cards.filter((e) => e.matched)
    expect(matched.length).toBeGreaterThan(0)
    const key = (s: string) => s.replace(/\([^)]*\)/g, '').replace(/\s+/g, '')
    for (const e of matched) {
      expect(e.unit.ablt_def.length, e.card_id).toBeGreaterThanOrEqual(15)
      expect(e.unit.ablt_unit, e.card_id).toMatch(/^\d{10}$/)
      expect(e.unit.centerURL, e.card_id).toMatch(/^http:\/\/lod\.work\.go\.kr\//)
      const card = CARDS.find((c) => c.id === e.card_id)
      expect(card?.ncs.map((n) => key(n.unit))).toContain(key(e.unit.centerLabel))
    }
  })

  it('② 카드의 NCS 줄: 찾은 카드는 "NCS · 응답 이름", 못 찾은 카드는 "NCS 참고 · 팀이 고른 값"(H2-11 ④), NCS 없는 카드는 근무 방식 카드', () => {
    for (const c of CARDS) {
      const e = NCS_CARDS.cards.find((x) => x.card_id === c.id)
      if (!e) expect(ncsLine(c), c.id).toBe('근무 방식·환경 카드')
      else if (e.matched) expect(ncsLine(c), c.id).toBe(`NCS · ${e.unit.centerLabel}`)
      else expect(ncsLine(c), c.id).toBe(`NCS 참고 · ${e.existing.map((n) => n.unit).join(', ')}`)
    }
  })
})

describe('DATA-02 응용소프트웨어개발자 직무 개요(직업정보 212D01, H1-10)', () => {
  it('짧은 개요는 받은 개요의 앞부분 그대로다', () => {
    expect(JOB_INFO.jobCd).toBe('K000001176')
    expect(JOB_INFO.summary_short.length).toBeGreaterThanOrEqual(10)
    expect(JOB_INFO.summary.replace(/\s+/g, ' ').startsWith(JOB_INFO.summary_short)).toBe(true)
  })
})

describe('DATA-03 모의 공고의 지역·직종 코드(공통코드 21L01)', () => {
  const regions = new Map(CODES.region.codes.map((c) => [c.code, c.name]))
  const jobs = new Map(CODES.jobs.codes.map((c) => [c.code, c.name]))

  it('공고 7건의 지역코드·직종코드가 받은 공통코드에 있고 이름이 공고 글과 맞는다', () => {
    expect(regions.size).toBeGreaterThanOrEqual(50)
    expect(POSTINGS).toHaveLength(7)
    for (const p of POSTINGS) {
      expect(regions.has(p.regionCd), `${p.wantedAuthNo} 지역 ${p.regionCd}`).toBe(true)
      expect(p.workRegion.startsWith(regions.get(p.regionCd) ?? '∅'), `${p.wantedAuthNo} ${p.workRegion}`).toBe(true)
      expect(jobs.get(p.jobsCd), `${p.wantedAuthNo} 직종 ${p.jobsCd}`).toBe(p.jobsNm)
    }
  })
})

describe('DATA-04 강소기업 통계(216L01)', () => {
  it('전체 수·정보통신업 수·인증 종류별 수', () => {
    expect(SMALL_GIANTS.total).toBeGreaterThan(1000)
    expect(SMALL_GIANTS.ict.count).toBeGreaterThan(0)
    expect(SMALL_GIANTS.ict.count).toBeLessThan(SMALL_GIANTS.total)
    expect(SMALL_GIANTS.by_brand.length).toBeGreaterThanOrEqual(2)
    expect(fetchedOn('giants')).toBe(SMALL_GIANTS.fetched_on)
  })
})

describe('DATA-05 data/real 에는 회사별 값이 없다', () => {
  it('회사명·사업자번호 칸과 사업자번호 모양이 없다', () => {
    const KEY = /^(?:co|corp|cmpny|company|ent|entrps|biz|bizpl|bsns|firm)_?(?:nm|name)$|^(?:busi|biz|bz)_?no$|사업자|회사명|기업명|상호/i
    for (const f of readdirSync(REAL_DIR)) {
      const text = readFileSync(`${REAL_DIR}${f}`, 'utf8')
      expect(text, f).not.toMatch(/\d{3}-\d{2}-\d{5}/)
      const keys = [...text.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1] ?? '')
      expect(keys.filter((k) => KEY.test(k)), f).toEqual([])
    }
  })
})
