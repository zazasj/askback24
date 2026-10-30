/**
 * 고용보험 EIS 파일(사람이 받아 둔 xlsx) → data/company/eis.json (API 를 부르지 않는다)
 * 읽는 곳: .cache/company/eis-sido.xlsx(시도별), eis-nation.xlsx(전국). 첫 시트의 피벗 표.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { EIS_SIZE_BANDS, eisBaseline, rowsFromPivot, type EisRow } from './lib.ts'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const OUT = join(ROOT, 'data', 'company', 'eis.json')
const MONTHS = 12
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

async function readSheet(path: string): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  const ws = wb.worksheets[0]
  const rows: unknown[][] = []
  ws?.eachRow({ includeEmpty: true }, (row) => {
    // exceljs 의 values 는 1부터 시작한다
    rows.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === 'object' && 'result' in v ? (v as { result: unknown }).result : v)))
  })
  return rows
}

const files: Array<{ name: string; sido?: '전국' }> = [{ name: 'eis-sido.xlsx' }, { name: 'eis-nation.xlsx', sido: '전국' }]
const rows: EisRow[] = []
const unknown: string[] = []
for (const f of files) {
  const p = join(ROOT, '.cache', 'company', f.name)
  if (!existsSync(p)) {
    console.log(`없음: .cache/company/${f.name}`)
    continue
  }
  const r = rowsFromPivot(await readSheet(p), f.sido)
  rows.push(...r.rows)
  for (const n of r.unknown) if (!unknown.includes(n)) unknown.push(n)
}

if (unknown.length) {
  console.error(`대응표에 없는 이름이 있어 data/company/eis.json 을 바꾸지 않았어요: ${unknown.join(', ')}`)
  process.exit(1)
}
if (!existsSync(join(ROOT, '.cache', 'company', 'eis-sido.xlsx')) || rows.length === 0) {
  console.log('시도 EIS 파일(eis-sido.xlsx)이 없거나 비어 있어 data/company/eis.json 을 바꾸지 않았어요. 파일을 .cache/company/ 에 두고 다시 실행하세요.')
} else {
  if (!existsSync(join(ROOT, '.cache', 'company', 'eis-nation.xlsx'))) console.warn('경고: eis-nation.xlsx 가 없어 작은 칸은 전국 값으로 대신할 수 없어요')
  const yms = [...new Set(rows.map((r) => r.ym))].sort().slice(-MONTHS)
  const ymText = (ym: string): string => `${ym.slice(0, 4)}년 ${Number(ym.slice(4))}월`
  const out = {
    meta: {
      source: '고용보험 EIS 파일(업종×규모×시도, 월별)',
      fetched_on: today,
      months: MONTHS,
      period: `${ymText(yms[0] ?? '')}~${ymText(yms[yms.length - 1] ?? '')}`,
      size_bands: EIS_SIZE_BANDS,
    },
    rows: eisBaseline(rows, MONTHS),
  }
  mkdirSync(join(ROOT, 'data', 'company'), { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`→ data/company/eis.json (${out.rows.length}줄)`)
}
