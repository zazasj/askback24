/**
 * 시연 공고 ↔ 실제 강소기업 매핑 → data/company/small-giants.demo.json (API 를 부르지 않는다)
 * 읽는 곳: .cache/work24/216L01 원본, .cache/company/youth-friendly.csv(없으면 건너뜀), 환경변수 REAL_COMPANY_MAP
 * 결과에는 인증 이름·연도만 쓴다(회사명·사업자번호·주소는 쓰지 않는다).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digits, giantRowsFromXml, pickSmallGiants, similarityWarnings, youthRowsFromCsv, type GiantRow } from './lib.ts'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const OUT = join(ROOT, 'data', 'company', 'small-giants.demo.json')

function save(data: unknown): void {
  mkdirSync(join(ROOT, 'data', 'company'), { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)
}

let map: Record<string, { name: string; bizNo: string }> = {}
try {
  const raw = (process.env.REAL_COMPANY_MAP ?? '').trim()
  if (raw) map = JSON.parse(raw) as typeof map
} catch {
  // 값은 로그에 찍지 않는다
  console.log('REAL_COMPANY_MAP 을 JSON 으로 읽지 못했어요')
}
if (Object.keys(map).length === 0) {
  save({})
  console.log('매핑 없음 — small-giants.demo.json 에 {} 를 썼어요')
} else {
  const dir = join(ROOT, '.cache', 'work24', '216L01')
  const giants: GiantRow[] = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.xml')).flatMap((f) => giantRowsFromXml(readFileSync(join(dir, f), 'utf8')))
    : []
  if (giants.length === 0) console.warn('경고: .cache/work24/216L01 원본이 없어요(npm run fetch:work24 로 먼저 받으세요)')
  const yPath = join(ROOT, '.cache', 'company', 'youth-friendly.csv')
  let youth: GiantRow[] = []
  if (existsSync(yPath)) youth = youthRowsFromCsv(readFileSync(yPath, 'utf8'))
  else console.warn('경고: .cache/company/youth-friendly.csv 가 없어 216L01 만 써요')

  const picked = pickSmallGiants(map, giants, youth)
  save(picked)
  console.log(`→ data/company/small-giants.demo.json (공고 ${Object.keys(picked).length}/${Object.keys(map).length}건 맞음)`)

  // 닮음 점검: 화면에만 찍는다(파일에는 쓰지 않는다)
  const postings = JSON.parse(readFileSync(join(ROOT, 'data', 'postings.json'), 'utf8')) as Array<{ wantedAuthNo: string; indTpNm?: string; totPsncnt?: string; regionCd?: string }>
  for (const [no, c] of Object.entries(map)) {
    const posting = postings.find((p) => p.wantedAuthNo === no)
    const row = giants.find((r) => digits(r.busiNo ?? r.bizNo) === digits(c.bizNo))
    if (!posting || !row) {
      if (!row) console.log(`${no}: 원본에서 못 찾음`)
      continue
    }
    for (const w of similarityWarnings(posting, row)) console.log(`${no}: ${w}`)
  }
}
