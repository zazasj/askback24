/**
 * 고용보험 EIS 파일(사람이 받아 둔 CSV) → data/company/eis.json (API 를 부르지 않는다)
 * 읽는 곳: .cache/company/eis-sido.csv, eis-nation.csv
 * 열 순서: 기준년월,업종코드,업종명,규모,시도,피보험자수,취득자수,상실자수
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EIS_SIZE_BANDS, eisBaseline, eisRowsFromCsv, type EisRow } from './lib.ts'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const OUT = join(ROOT, 'data', 'company', 'eis.json')
const MONTHS = 12
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

const files: Array<{ name: string; sido?: string }> = [{ name: 'eis-sido.csv' }, { name: 'eis-nation.csv', sido: '전국' }]
const rows: EisRow[] = []
let found = 0
for (const f of files) {
  const p = join(ROOT, '.cache', 'company', f.name)
  if (!existsSync(p)) {
    console.log(`없음: .cache/company/${f.name}`)
    continue
  }
  found++
  rows.push(...eisRowsFromCsv(readFileSync(p, 'utf8'), f.sido))
}

if (found === 0 || rows.length === 0) {
  console.log('EIS 파일이 없거나 비어 있어 data/company/eis.json 을 바꾸지 않았어요. 파일을 .cache/company/ 에 두고 다시 실행하세요.')
} else {
  const out = {
    meta: {
      source: '고용보험 EIS 파일(업종×규모×시도, 월별)',
      fetched_on: today,
      months: MONTHS,
      size_bands: EIS_SIZE_BANDS,
    },
    rows: eisBaseline(rows, MONTHS),
  }
  mkdirSync(join(ROOT, 'data', 'company'), { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`→ data/company/eis.json (${out.rows.length}줄)`)
}
