/**
 * 회사 자료 스크립트의 순수 함수(네트워크·파일 없음). 단위 시험(lib.test.ts)이 같이 쓴다.
 * Node 가 타입만 지우고 바로 돌리므로 enum·namespace 는 쓰지 않는다.
 */

import { findAll, leafRecord, parseXml, type XmlNode } from '../work24/lib.ts'

export interface EisRow {
  ym: string
  ind: string
  size: string
  sido: string
  insured: number
  gain: number
  loss: number
}

export interface EisBaselineRow {
  ind2: string
  size: string
  sido: string
  loss_rate: number
  net: number
  insured: number
}

/** EIS 규모 구간의 단일 출처. 실제 파일을 받는 4.5단계에서 라벨을 파일 값으로 바꾼다(파이썬은 meta.size_bands 를 읽는다) */
export const EIS_SIZE_BANDS: ReadonlyArray<{ min: number; max: number | null; label: string }> = [
  { min: 1, max: 4, label: '1~4인' },
  { min: 5, max: 29, label: '5~29인' },
  { min: 30, max: 99, label: '30~99인' },
  { min: 100, max: 299, label: '100~299인' },
  { min: 300, max: null, label: '300인 이상' },
]

export function sizeLabel(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null
  return EIS_SIZE_BANDS.find((b) => n >= b.min && (b.max === null || n <= b.max))?.label ?? null
}

/** 따옴표를 쓰는 간단한 CSV(한 줄 = 한 행). BOM 은 뗀다 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (c === '"') q = false
        else cur += c
      } else if (c === '"') q = true
      else if (c === ',') {
        cells.push(cur.trim())
        cur = ''
      } else cur += c
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

const num = (s: string | undefined): number => Number((s ?? '').replace(/,/g, '')) || 0

/** 열 순서: 기준년월,업종코드,업종명,규모,시도,피보험자수,취득자수,상실자수. 머리 줄은 건너뛴다. nationLabel 은 시도 칸이 없는 전국 파일용 */
export function eisRowsFromCsv(text: string, sidoOverride?: string): EisRow[] {
  return parseCsv(text)
    .filter((c) => /^\d{4}-?\d{2}$/.test(c[0] ?? ''))
    .map((c) => ({
      ym: (c[0] ?? '').replace('-', ''),
      ind: c[1] ?? '',
      size: c[3] ?? '',
      sido: sidoOverride ?? (c[4] || '전국'),
      insured: num(c[5]),
      gain: num(c[6]),
      loss: num(c[7]),
    }))
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

export function eisBaseline(rows: EisRow[], months = 12): EisBaselineRow[] {
  // 입력에 있는 기준년월 중 최근 months 개
  const keep = new Set([...new Set(rows.map((r) => r.ym))].sort().slice(-months))
  const groups = new Map<string, EisRow[]>()
  for (const r of rows) {
    if (!keep.has(r.ym)) continue
    const k = JSON.stringify([r.ind.slice(0, 2), r.size, r.sido])
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const out: EisBaselineRow[] = []
  for (const [k, list] of groups) {
    const [ind2, size, sido] = JSON.parse(k) as [string, string, string]
    const rates = list.filter((r) => r.insured > 0).map((r) => r.loss / r.insured)
    out.push({
      ind2,
      size,
      sido,
      loss_rate: rates.length ? Math.round(mean(rates) * 1000) / 1000 : 0,
      net: Math.round(mean(list.map((r) => r.gain - r.loss))),
      insured: Math.round(mean(list.map((r) => r.insured))),
    })
  }
  return out.sort((a, b) => (a.ind2 + a.size + a.sido).localeCompare(b.ind2 + b.size + b.sido))
}

/** 216L01 한 줄(칸 이름은 원본 그대로) */
export type GiantRow = Record<string, string>

export const digits = (s: string | undefined): string => (s ?? '').replace(/\D/g, '')
const bizNoOf = (r: GiantRow): string => digits(r.busiNo ?? r.bizNo ?? r['사업자번호'])
const brandOf = (r: GiantRow): string => (r.sgBrandNm ?? r['인증명'] ?? r['인증'] ?? '').trim()
const yearOf = (r: GiantRow): number => Number(digits(r.selYear ?? r['연도'] ?? r['선정연도']).slice(0, 4)) || 0

/** 결과에는 인증 이름·연도만 담는다(회사명·번호·주소 없음) */
export function pickSmallGiants(
  map: Record<string, { name: string; bizNo: string }>,
  giants: GiantRow[],
  youth: GiantRow[],
): Record<string, { name: string; year: number }[]> {
  const out: Record<string, { name: string; year: number }[]> = {}
  for (const [no, c] of Object.entries(map)) {
    const biz = digits(c.bizNo)
    if (biz.length !== 10) continue
    const certs: { name: string; year: number }[] = []
    for (const r of [...giants, ...youth]) {
      const name = brandOf(r)
      if (bizNoOf(r) !== biz || !name) continue
      if (!certs.some((x) => x.name === name && x.year === yearOf(r))) certs.push({ name, year: yearOf(r) })
    }
    if (certs.length) out[no] = certs
  }
  return out
}

export interface PostingLike {
  indTpNm?: string
  totPsncnt?: string
  regionCd?: string
}

const squash = (s: string | undefined): string => (s ?? '').replace(/\s+/g, '')

/** 시연 공고와 매핑된 실제 회사 행이 얼마나 닮았는지. 있는 칸만 비교하고 콘솔에만 찍는다 */
export function similarityWarnings(posting: PostingLike, giant: GiantRow): string[] {
  const out: string[] = []
  const gInd = giant.superIndTpNm ?? giant.indTpNm
  if (gInd && posting.indTpNm && squash(gInd) !== squash(posting.indTpNm)) out.push(`업종이 달라요(공고 ${posting.indTpNm} / 회사 ${gInd})`)
  const gCnt = giant.totPsncnt ?? giant.workerCnt
  if (gCnt && posting.totPsncnt) {
    const a = sizeLabel(num(posting.totPsncnt))
    const b = sizeLabel(num(gCnt))
    if (a && b && a !== b) out.push(`규모 구간이 달라요(공고 ${a} / 회사 ${b})`)
  }
  const gReg = giant.regionCd ?? giant.region
  if (gReg && posting.regionCd && squash(gReg) !== squash(posting.regionCd)) out.push(`지역이 달라요(공고 ${posting.regionCd} / 회사 ${gReg})`)
  return out
}

/** 216L01 원본 XML 한 쪽에서 회사 줄 목록(fetch-work24 와 같은 방식: 잎 노드가 여럿인 반복 노드) */
export function giantRowsFromXml(xml: string): GiantRow[] {
  const root = parseXml(xml)
  const list = findAll(root, 'smallGiantsList')[0] ?? root
  const groups = new Map<string, XmlNode[]>()
  const walk = (n: XmlNode): void => {
    for (const c of n.children) {
      if (c.children.length >= 3 && !c.children.some((x) => x.children.length > 0)) groups.set(c.name, [...(groups.get(c.name) ?? []), c])
      walk(c)
    }
  }
  walk(list)
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? []
  return best.map((n) => Object.fromEntries(Object.entries(leafRecord(n)).map(([k, v]) => [k, v.trim()])))
}

/** 청년친화강소기업 명단 CSV: 머리 줄 이름으로 칸을 찾는다(사업자번호·인증명·연도) */
export function youthRowsFromCsv(text: string): GiantRow[] {
  const [head, ...body] = parseCsv(text)
  if (!head) return []
  return body.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ''])))
}
