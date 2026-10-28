import { describe, expect, it } from 'vitest'
import { EIS_SIZE_BANDS, eisBaseline, giantRowsFromJson, eisRowsFromCsv, pickSmallGiants, similarityWarnings, type EisRow } from './lib.ts'

const mk = (ym: string, over: Partial<EisRow> = {}): EisRow => ({ ym, ind: '58211', size: '5~29인', sido: '서울', insured: 100, gain: 5, loss: 10, ...over })
const months = (): string[] => Array.from({ length: 12 }, (_, i) => `2025${String(i + 1).padStart(2, '0')}`)

describe('eisBaseline', () => {
  it('12개월 평균을 내고 13개월째(가장 오래된 달)는 버린다', () => {
    const ym = [...months(), '202601'] // 202501..202512, 202601 → 13개
    const rows = ym.map((m, i) => mk(m, { loss: i === 0 ? 100 : 10, gain: 5 }))
    const [r] = eisBaseline(rows, 12)
    expect(r).toEqual({ ind2: '58', size: '5~29인', sido: '서울', loss_rate: 0.1, net: -5, insured: 100 })
  })
  it('업종은 앞 2자리로 묶고 전국 행은 따로 둔다', () => {
    const rows = [mk('202509', { ind: '58211' }), mk('202509', { ind: '58222', loss: 20 }), mk('202509', { sido: '전국' })]
    const out = eisBaseline(rows)
    expect(out).toHaveLength(2)
    expect(out.find((r) => r.sido === '서울')?.loss_rate).toBe(0.15)
    expect(out.find((r) => r.sido === '전국')?.loss_rate).toBe(0.1)
  })
  it('피보험자 0 인 달은 상실률에서 뺀다', () => {
    const [r] = eisBaseline([mk('202508', { insured: 0, loss: 3 }), mk('202509')])
    expect(r?.loss_rate).toBe(0.1)
  })
})

describe('eisRowsFromCsv', () => {
  it('머리 줄을 건너뛰고 전국 파일은 시도를 전국으로 한다', () => {
    const csv = '기준년월,업종코드,업종명,규모,시도,피보험자수,취득자수,상실자수\n202509,58211,소프트웨어,5~29인,,"1,000",20,30\n'
    expect(eisRowsFromCsv(csv, '전국')).toEqual([{ ym: '202509', ind: '58211', size: '5~29인', sido: '전국', insured: 1000, gain: 20, loss: 30 }])
  })
})

describe('size bands', () => {
  it('구간이 이어진다', () => {
    expect(EIS_SIZE_BANDS.map((b) => b.label)).toEqual(['1~4인', '5~29인', '30~99인', '100~299인', '300인 이상'])
  })
})

describe('pickSmallGiants', () => {
  const map = { 'K-MOCK-0001': { name: '(주)테스트실제', bizNo: '0000000000' }, 'K-MOCK-0002': { name: '(주)다른실제', bizNo: '1111111111' } }
  const giants = [{ busiNo: '0000000000', sgBrandNm: '강소기업', selYear: '2024' }, { busiNo: '9999999999', sgBrandNm: '강소기업', selYear: '2023' }]
  const youth = [{ 사업자번호: '0000000000', 인증명: '청년친화강소기업', 연도: '2025' }]
  it('번호가 맞는 공고만 나오고 이름·번호가 결과에 없다', () => {
    const out = pickSmallGiants(map, giants, youth)
    expect(Object.keys(out)).toEqual(['K-MOCK-0001'])
    expect(out['K-MOCK-0001']).toEqual([{ name: '강소기업', year: 2024 }, { name: '청년친화강소기업', year: 2025 }])
    const json = JSON.stringify(out)
    expect(json).not.toContain('테스트실제')
    expect(json).not.toContain('0000000000')
  })
})

describe('연도 없는 인증·JSON 원본', () => {
  it('연도가 없는 인증은 뺀다', () => {
    const map = { 'K-MOCK-0001': { name: '(주)테스트실제', bizNo: '0000000000' } }
    expect(pickSmallGiants(map, [{ busiNo: '0000000000', sgBrandNm: '강소기업' }], [])).toEqual({})
  })
  it('JSON 응답에서 회사 줄을 읽는다', () => {
    const rows = giantRowsFromJson('{"a":{"list":[{"busiNo":"1","sgBrandNm":"x","selYear":2024},{"busiNo":"2"}]}}')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.selYear).toBe('2024')
  })
})

describe('similarityWarnings', () => {
  const posting = { indTpNm: '응용 소프트웨어 개발 및 공급업', totPsncnt: '46', regionCd: '11000' }
  it('시도가 다르면 경고 1개', () => {
    expect(similarityWarnings(posting, { superIndTpNm: '응용 소프트웨어 개발 및 공급업', totPsncnt: '40', regionCd: '26000' })).toHaveLength(1)
  })
  it('같거나 칸이 없으면 경고 없음', () => {
    expect(similarityWarnings(posting, { busiNo: '1' })).toEqual([])
  })
})
