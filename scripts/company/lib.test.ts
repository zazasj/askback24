import { describe, expect, it } from 'vitest'
import { EIS_SIZE_BANDS, eisBaseline, giantRowsFromJson, pickSmallGiants, rowsFromPivot, similarityWarnings, sizeLabel, type EisRow } from './lib.ts'

const mk = (ym: string, over: Partial<EisRow> = {}): EisRow => ({ ym, ind2: '58', size: '5인 - 9인', sido: '11', insured: 100, gain: 5, loss: 10, ...over })
const months = (): string[] => Array.from({ length: 12 }, (_, i) => `2025${String(i + 1).padStart(2, '0')}`)

describe('eisBaseline', () => {
  it('12개월 평균을 내고 13개월째(가장 오래된 달)는 버린다', () => {
    const ym = [...months(), '202601'] // 202501..202512, 202601 → 13개
    const rows = ym.map((m, i) => mk(m, { loss: i === 0 ? 100 : 10, gain: 5 }))
    const [r] = eisBaseline(rows, 12)
    expect(r).toEqual({ ind2: '58', size: '5인 - 9인', sido: '11', loss_rate: 0.1, net: -5, insured: 100 })
  })
  it('업종은 앞 2자리로 묶고 전국 행은 따로 둔다', () => {
    const rows = [mk('202509'), mk('202509', { loss: 20 }), mk('202509', { sido: '전국' })]
    const out = eisBaseline(rows)
    expect(out).toHaveLength(2)
    expect(out.find((r) => r.sido === '11')?.loss_rate).toBe(0.15)
    expect(out.find((r) => r.sido === '전국')?.loss_rate).toBe(0.1)
  })
  it('피보험자 0 인 달은 상실률에서 뺀다', () => {
    const [r] = eisBaseline([mk('202508', { insured: 0, loss: 3 }), mk('202509')])
    expect(r?.loss_rate).toBe(0.1)
  })
})

const HEAD = ['마감년월', '산업_중분류', '규모', '(사업장)시도', '피보험자수(전체)', '취득자수(월)', '상실자수(월)']
const PIVOT: unknown[][] = [
  ['출처', '고용행정통계'],
  HEAD,
  ['총계', '총계', '총계', '총계', 999, 9, 9],
  ['2025년10월', '11차_출판업 전체', null, null, 150, 6, 4],
  [null, '11차_출판업', '5인미만 전체', null, 150, 6, 4],
  [null, null, '5인미만', '서울특별시', 100, 5, 3],
  [null, null, null, '부산광역시', 50, 1, 1],
  [null, '11차_정보서비스업 전체', null, null, 70, 2, 2],
  [null, '11차_정보서비스업', '5인미만 전체', null, 70, 2, 2],
  [null, null, '5인미만', '서울특별시', 70, 2, 2],
]

describe('rowsFromPivot', () => {
  it('fill-down resets lower dims', () => {
    const { rows, unknown } = rowsFromPivot(PIVOT)
    expect(unknown).toEqual([])
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual({ ym: '202510', ind2: '58', size: '5인미만', sido: '26', insured: 50, gain: 1, loss: 1 })
    expect(rows[2]).toEqual({ ym: '202510', ind2: '63', size: '5인미만', sido: '11', insured: 70, gain: 2, loss: 2 })
  })
  it('reads nation file without sido column', () => {
    const { rows } = rowsFromPivot(
      [
        ['마감년월', '산업_중분류', '규모', '피보험자수(전체)', '취득자수(월)', '상실자수(월)'],
        ['2025년10월', '11차_출판업 전체', null, 150, 6, 4],
        [null, '11차_출판업', '5인 - 9인', 150, 6, 4],
      ],
      '전국',
    )
    expect(rows).toEqual([{ ym: '202510', ind2: '58', size: '5인 - 9인', sido: '전국', insured: 150, gain: 6, loss: 4 }])
  })
  it('skips 총계 and 전체 rows', () => {
    expect(rowsFromPivot(PIVOT).rows.every((r) => r.insured !== 999 && r.insured !== 150)).toBe(true)
  })
  it('unknown names', () => {
    const { rows, unknown } = rowsFromPivot([
      HEAD,
      ['2025년10월', '11차_없는업종', '5인미만', '없는도', 1, 1, 1],
      [null, '11차_출판업', '5인미만', '서울특별시', 1, 1, 1],
    ])
    expect(unknown).toEqual(['11차_없는업종', '없는도'])
    expect(rows).toHaveLength(1)
  })
  it('trims names', () => {
    expect(rowsFromPivot([HEAD, ['2025년10월', '11차_출판업', '5인미만', '강원특별자치도 ', 1, 1, 1]]).rows[0]?.sido).toBe('51')
  })
})

describe('size bands', () => {
  it('EIS_SIZE_BANDS has the 11 file labels', () => {
    expect(EIS_SIZE_BANDS.map((b) => b.label)).toEqual(['5인미만', '5인 - 9인', '10인 - 29인', '30인 - 49인', '50인 - 69인', '70인 - 99인', '100인 - 149인', '150인 - 299인', '300인 - 499인', '500인 - 999인', '1000이상'])
    expect(EIS_SIZE_BANDS.map((b) => [b.min, b.max])).toEqual([[1, 4], [5, 9], [10, 29], [30, 49], [50, 69], [70, 99], [100, 149], [150, 299], [300, 499], [500, 999], [1000, null]])
    expect(sizeLabel(46)).toBe('30인 - 49인')
    expect(sizeLabel(1000)).toBe('1000이상')
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
