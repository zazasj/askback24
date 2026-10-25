/**
 * 고용24 오픈API 4종(직무정보·직업정보·공통코드·강소기업)을 미리 받아 data/real/*.json 을 만든다.
 * 화면·시험·빌드는 API를 부르지 않고 이 파일들만 읽는다(PLAN-2 N2, DATA-01~07).
 *
 *   npm run fetch:work24                 받아 둔 원본(.cache/work24)이 있으면 다시 부르지 않는다
 *   npm run fetch:work24 -- --only=ncs   일부만(ncs·job·codes·giants)
 *
 * 지키는 것: 1초에 1번 이하(1.5초 간격), 한 번 실행에 200번 이하, 오류 응답이면 그 자리에서 멈춤.
 * 키는 .env(WORK24_KEY_*)에서만 읽고, 캐시 이름·출력·data/real 에 남기지 않는다.
 * 강소기업 원본의 회사명·사업자번호는 .cache/ 에만 두고 data/real 에는 개수만 적는다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KEY_ENV,
  cacheRel,
  canonicalParams,
  countBy,
  findAll,
  isJsonReq,
  kstDate,
  leadSentences,
  leafRecord,
  ncsItems,
  parseXml,
  pickNcs,
  redact,
  requestUrl,
  responseError,
  splitBrands,
  type Flat,
  type Req,
  type XmlNode,
} from './work24/lib.ts'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const CACHE_DIR = join(ROOT, '.cache', 'work24')
const MANIFEST = join(CACHE_DIR, '_manifest.json')
const OUT_DIR = join(ROOT, 'data', 'real')

// 한도는 1초에 1번이지만 여유를 둔다(강소기업처럼 연달아 부를 때 연결이 끊긴 적이 있음)
const MIN_GAP_MS = 1500
const RETRY_GAP_MS = 5000
const MAX_CALLS = 200
const GIANTS_MAX_PAGES = 160
// 크게 청하고 응답이 준 수(10-25 실측 100)로 나눈다. 바꾸면 첫 쪽 원본 이름이 달라져 다시 부르게 된다
const GIANTS_DISPLAY = 1000

const SECTIONS = ['ncs', 'job', 'codes', 'giants'] as const
type Section = (typeof SECTIONS)[number]

class StopError extends Error {}

// ── 받기(캐시 → 없으면 호출) ─────────────────────────────────────
type Manifest = Record<string, { svc: string; params: string; fetched_at: string }>

function readManifest(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
  } catch {
    return {}
  }
}

const manifest = readManifest()
const secrets = Object.values(KEY_ENV)
  .map((n) => process.env[n] ?? '')
  .filter((v) => v.length >= 8)
let calls = 0
let lastStart = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const log = (s: string) => console.log(redact(s, secrets))

function decodeBody(buf: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(buf)
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 200))
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/** 같은 요청(해시)의 받아 둔 원본 경로. 정확히 같은 이름이 먼저 */
function findCached(rel: string): string | null {
  if (existsSync(join(CACHE_DIR, ...rel.split('/')))) return rel
  const [svc = '', name = ''] = rel.split('/')
  const tail = name.slice(name.lastIndexOf('-'))
  const dir = join(CACHE_DIR, svc)
  if (!existsSync(dir)) return null
  const hit = readdirSync(dir).find((f) => f.endsWith(tail))
  return hit ? `${svc}/${hit}` : null
}

/** 원본 글과 받은 날짜. 캐시가 있으면 부르지 않는다 */
async function get(req: Req): Promise<{ text: string; fetchedOn: string }> {
  const rel = cacheRel(req)
  const file = join(CACHE_DIR, ...rel.split('/'))
  // 요청 값이 같으면 앞 이름(hint)이 달라도 같은 원본을 쓴다(같은 검색어를 두 카드가 쓸 때)
  const sameReq = findCached(rel)
  if (sameReq) {
    const at = manifest[sameReq]?.fetched_at ?? statSync(join(CACHE_DIR, ...sameReq.split('/'))).mtime.toISOString()
    return { text: readFileSync(join(CACHE_DIR, ...sameReq.split('/')), 'utf8'), fetchedOn: kstDate(new Date(at)) }
  }
  const keyName = KEY_ENV[req.svc]
  const key = process.env[keyName] ?? ''
  if (!key) throw new StopError(`${keyName} 가 .env 에 없어 ${req.svc}(${req.hint})를 부를 수 없음`)
  let text = ''
  let status = 0
  // 연결이 끊긴 것(응답 없음)만 5초 쉬고 한 번 더. 오류 응답은 다시 부르지 않는다
  for (let attempt = 1; ; attempt++) {
    if (calls >= MAX_CALLS) throw new StopError(`한 번 실행 한도 ${MAX_CALLS}번에 닿아 멈춤`)
    const wait = lastStart + (attempt > 1 ? RETRY_GAP_MS : MIN_GAP_MS) - Date.now()
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()
    calls++
    try {
      const res = await fetch(requestUrl(req, key), { signal: AbortSignal.timeout(30_000) })
      status = res.status
      text = decodeBody(await res.arrayBuffer(), res.headers.get('content-type') ?? '')
      break
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause
      const why = `${(e as Error).message}${cause ? ` (${cause.code ?? cause.message ?? ''})` : ''}`
      if (attempt >= 2) throw new StopError(`${req.svc}(${req.hint}) 호출 실패: ${why}`)
      log(`  [${calls}] ${req.svc} ${req.hint} 연결 실패, 다시 한 번: ${why}`)
    }
  }
  const err = status >= 400 ? `HTTP ${status}` : responseError(text, isJsonReq(req))
  if (err) throw new StopError(`${req.svc}(${req.hint}) 오류 응답: ${err.slice(0, 300)}`)

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
  const now = new Date()
  manifest[rel] = { svc: req.svc, params: canonicalParams(req.params), fetched_at: now.toISOString() }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  log(`  [${calls}] ${req.svc} ${req.hint} 받음 (${text.length}자)`)
  return { text, fetchedOn: kstDate(now) }
}

const latest = (dates: string[]): string => [...dates].sort().at(-1) ?? kstDate(new Date())

function writeOut(name: string, data: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`)
  log(`  → data/real/${name}`)
}

function readRepoJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, ...rel.split('/')), 'utf8')) as T
}

// ── 직무정보(215L01) → ncs-cards.json ─────────────────────────────
interface CardIn {
  id: string
  label: string
  plain: string
  ncs: Array<{ subcategory: string; unit: string }>
}

const NCS_LIMIT = '10'

/**
 * 검색어: 카드에 팀이 붙여 둔 능력단위명에서 띄어쓰기를 뺀 것. 설명 문장(plain)은 띄어쓰기 때문에 15건 모두 빈 응답이었다
 * (명세 주의 문구 "공백이 포함되면 검색 결과가 제대로 나오지 않을 수 있음", 10-25 실측). 카드마다 능력단위 순서대로 2개까지 찾고
 * 처음 맞은 것을 쓴다. 같은 검색어는 원본을 같이 쓴다(BE06 = BE01). BE08 은 BE07 과 겹치지 않게 둘째 능력단위부터 찾는다.
 */
const NCS_TRIES = 2
const NCS_FIRST_UNIT: Record<string, number> = { BE08: 1 }
/**
 * 응답에 같은 이름이 있어도 뜻이 달라 팀 값을 쓰는 카드(찾지 않는다). BE09 는 응답의 "제품소프트웨어 패키징"이
 * 배포용 설치 파일을 만드는 일이라 카드(배포·서버 운영)와 뜻이 달라 카드 능력단위에서도 뺐다(REVIEW-HOLD H2-11 ①)
 */
const NCS_TEAM_ONLY: Record<string, string> = {
  BE09: "응답 2위 '제품소프트웨어 패키징'은 이름은 같지만 배포용 설치 파일을 만드는 일이라 카드(배포·서버 운영)와 뜻이 달라 쓰지 않고, 카드 능력단위에서도 뺀 팀 값을 씀(REVIEW-HOLD H2-11 ①)",
}
const spaceless = (s: string): string => s.replace(/\([^)]*\)/g, '').replace(/\s+/g, '')

function ncsQueries(c: CardIn): string[] {
  const start = NCS_FIRST_UNIT[c.id] ?? 0
  const units = [...c.ncs.slice(start), ...c.ncs.slice(0, start)].map((n) => spaceless(n.unit))
  return [...new Set(units)].slice(0, NCS_TRIES)
}

const ncsReq = (c: CardIn, query: string, i: number): Req => ({
  svc: '215L01',
  hint: i === 0 ? c.id : `${c.id}-q${i + 1}`,
  params: { returnType: 'JSON', jobCont: query, limit: NCS_LIMIT },
})

/** 응답 항목에서 이름이 되는 칸: centerLabel(능력단위명). 없으면 ablt…nm 꼴 */
function ncsNameField(items: readonly Flat[]): string | null {
  const keys = [...new Set(items.flatMap((i) => Object.keys(i)))]
  return keys.find((k) => k === 'centerLabel') ?? keys.find((k) => /ablt/i.test(k) && /(nm|name)$/i.test(k)) ?? null
}

async function sectionNcs(): Promise<void> {
  const cards = readRepoJson<{ cards: CardIn[] }>('data/cards.backend.json').cards.filter((c) => c.ncs.length > 0)
  const dates: string[] = []
  const entries = []
  let matched = 0
  for (const c of cards) {
    const teamOnly = NCS_TEAM_ONLY[c.id]
    if (teamOnly) {
      entries.push({ card_id: c.id, label: c.label, matched: false, basis: { how: teamOnly }, existing: c.ncs })
      continue
    }
    const existing = c.ncs.map((n) => n.unit)
    const tried: Array<{ query: string; response_count: number; top: string[] }> = []
    let hit: { query: string; field: string; pick: NonNullable<ReturnType<typeof pickNcs>> } | null = null
    for (const [i, query] of ncsQueries(c).entries()) {
      const { text, fetchedOn } = await get(ncsReq(c, query, i))
      dates.push(fetchedOn)
      const items = ncsItems(JSON.parse(text.replace(/^﻿/, '')) as unknown)
      const field = ncsNameField(items)
      tried.push({ query, response_count: items.length, top: field ? items.slice(0, 3).map((x) => x[field] ?? '') : [] })
      const pick = field ? pickNcs(items, existing, field) : null
      if (pick && field) {
        hit = { query, field, pick }
        break
      }
    }
    const base = { card_id: c.id, label: c.label }
    if (hit) {
      matched++
      const { query, field, pick } = hit
      entries.push({
        ...base,
        matched: true,
        query,
        basis: {
          rank: pick.rank,
          name: pick.item[field] ?? '',
          compared_with: pick.existing,
          how: pick.how === 'same' ? '기존 능력단위명과 같은 이름' : `기존 능력단위명과 가장 가까운 이름(닮은 정도 ${pick.score.toFixed(2)})`,
        },
        unit: pick.item,
      })
    } else {
      entries.push({
        ...base,
        matched: false,
        basis: {
          how: tried.every((t) => t.response_count === 0)
            ? '응답에 능력단위가 없음'
            : `응답 상위 ${NCS_LIMIT}개 안에 기존 능력단위명과 같거나 가까운 이름이 없음`,
          tried,
        },
        existing: c.ncs,
      })
    }
  }
  writeOut('ncs-cards.json', {
    source: '고용24 오픈API 직무정보(215L01, 표준직무기술서)',
    fetched_on: latest(dates),
    method: `카드에 팀이 붙여 둔 NCS 능력단위명에서 띄어쓰기를 뺀 말을 jobCont 로 넣어 상위 ${NCS_LIMIT}개를 받고(설명 문장은 띄어쓰기 때문에 빈 응답), 기존 능력단위명과 같거나 가장 가까운 것을 고름. 카드마다 능력단위 ${NCS_TRIES}개까지 차례로 찾음. unit 은 응답 값 그대로(묶음 칸 지식·기술·태도는 뺌). 못 찾으면 matched: false 이고 existing(팀이 정리한 값)을 씀`,
    matched_count: matched,
    cards: entries,
  })
}

// ── 직업정보(212D01) → job-info.json ─────────────────────────────
// 공고 직종(133200 응용 소프트웨어 개발자)에 맞춘 직업. 코드는 웹개발자(K000001106) 상세 응답의 관련 직업(relJobList)에서 확인(H1-10)
const JOB_CD = 'K000001176'

async function sectionJob(): Promise<void> {
  const req: Req = { svc: '212D01', hint: `${JOB_CD}-dtl1`, params: { returnType: 'XML', target: 'JOBDTL', jobGb: '1', jobCd: JOB_CD, dtlGb: '1' } }
  const { text, fetchedOn } = await get(req)
  const root = parseXml(text)
  const top = root.children[0]
  const flat = top ? deepLeaves(top) : {}
  // 맨 바깥 요소 이름도 jobSum 이라 잎 노드(자식 없는 것)의 글을 쓴다
  const sum = flat.jobSum ?? ''
  if (!sum) throw new Error('212D01 응답에 jobSum(직무 개요)이 없음')
  const pick = (k: string): string => flat[k] ?? ''
  writeOut('job-info.json', {
    source: '고용24 오픈API 직업정보(212D01, 직업 상세 dtlGb=1 요약)',
    fetched_on: fetchedOn,
    jobCd: pick('jobCd') || JOB_CD,
    job_name: pick('jobSmclNm'),
    classification: [pick('jobLrclNm'), pick('jobMdclNm'), pick('jobSmclNm')].filter(Boolean),
    summary: sum,
    summary_short: leadSentences(sum, 90),
    way: pick('way'),
  })
}

/** 노드 아래 잎 노드(자식 없는 것)를 { 이름: 글 } 로(같은 이름은 첫 것) */
function deepLeaves(node: XmlNode, out: Record<string, string> = {}): Record<string, string> {
  for (const c of node.children) {
    if (c.children.length === 0) {
      const v = c.text.trim()
      if (v && !(c.name in out)) out[c.name] = v
    } else deepLeaves(c, out)
  }
  return out
}

// ── 공통코드(21L01) → common-codes.json ───────────────────────────
interface Code {
  code: string
  name: string
  parent: string | null
}

/** 코드 나무를 펼친다: 자식 잎 중 …Cd·…Nm 짝이 있는 노드마다 한 줄 */
function codeRows(root: XmlNode): Code[] {
  const out: Code[] = []
  const walk = (node: XmlNode, parent: string | null): void => {
    const rec = leafRecord(node)
    const cdKey = Object.keys(rec).find((k) => /cd$/i.test(k))
    const nmKey = Object.keys(rec).find((k) => /nm$/i.test(k))
    let me = parent
    if (cdKey && nmKey && rec[cdKey]?.trim()) {
      me = rec[cdKey].trim()
      out.push({ code: me, name: (rec[nmKey] ?? '').trim(), parent })
    }
    for (const c of node.children) if (c.children.length > 0) walk(c, me)
  }
  walk(root, null)
  return out
}

async function sectionCodes(): Promise<void> {
  const parts: Array<{ key: string; dtlGb: string; label: string }> = [
    { key: 'region', dtlGb: '1', label: '지역코드' },
    { key: 'jobs', dtlGb: '2', label: '직종코드' },
  ]
  const dates: string[] = []
  const out: Record<string, unknown> = {}
  for (const p of parts) {
    const req: Req = { svc: '21L01', hint: `cmcd-dtl${p.dtlGb}`, params: { returnType: 'XML', target: 'CMCD', dtlGb: p.dtlGb } }
    const { text, fetchedOn } = await get(req)
    dates.push(fetchedOn)
    const rows = codeRows(parseXml(text))
    if (rows.length === 0) throw new Error(`21L01 dtlGb=${p.dtlGb} 응답에서 코드를 찾지 못함`)
    out[p.key] = { dtlGb: p.dtlGb, label: p.label, count: rows.length, codes: rows }
  }
  writeOut('common-codes.json', {
    source: '고용24 오픈API 공통코드(21L01, target=CMCD)',
    fetched_on: latest(dates),
    ...out,
  })
}

// ── 강소기업(216L01) → small-giants-summary.json ──────────────────
const giantsReq = (page: number, display: number): Req => ({
  svc: '216L01',
  hint: `p${String(page).padStart(3, '0')}-d${display}`,
  params: { callTp: 'L', returnType: 'XML', startPage: String(page), display: String(display) },
})

/** 목록 항목: 회사 한 곳 = 잎 노드가 여럿인 반복 노드 */
function giantItems(root: XmlNode): Flat[] {
  const list = findAll(root, 'smallGiantsList')[0] ?? root
  const groups = new Map<string, XmlNode[]>()
  for (const n of findAllNodes(list)) {
    if (n.children.length < 3 || n.children.some((c) => c.children.length > 0)) continue
    groups.set(n.name, [...(groups.get(n.name) ?? []), n])
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? []
  return best.map((n) => {
    const r = leafRecord(n)
    for (const k of Object.keys(r)) r[k] = (r[k] ?? '').trim()
    return r
  })
}

function findAllNodes(node: XmlNode, out: XmlNode[] = []): XmlNode[] {
  for (const c of node.children) {
    out.push(c)
    findAllNodes(c, out)
  }
  return out
}

function totalOf(root: XmlNode): number {
  const t = findAll(root, 'total')[0]?.text.replace(/[^\d]/g, '') ?? ''
  return t ? Number(t) : 0
}

const ICT = /정보\s*통신|출판.*영상.*정보/

async function sectionGiants(): Promise<void> {
  const first = await get(giantsReq(1, GIANTS_DISPLAY))
  const firstRoot = parseXml(first.text)
  const total = totalOf(firstRoot)
  if (total <= 0) throw new Error('216L01 첫 응답에 total 이 없음')
  const firstItems = giantItems(firstRoot)
  if (firstItems.length === 0) throw new Error('216L01 첫 응답에 목록 항목이 없음')
  // 응답이 display 를 줄였으면(최대값이 작으면) 그 수로 다시 나눈다. 같은 회사가 두 번 세지지 않게 아래에서 겹침을 뺀다
  const display = firstItems.length >= Math.min(GIANTS_DISPLAY, total) ? GIANTS_DISPLAY : firstItems.length
  const pages = Math.ceil(total / display)
  const lastPage = Math.min(pages, GIANTS_MAX_PAGES)
  const dates = [first.fetchedOn]
  const all: Flat[] = [...firstItems]
  let fetchedPages = 1
  let stopped: string | null = null
  for (let page = 2; page <= lastPage; page++) {
    try {
      const r = await get(giantsReq(page, display))
      dates.push(r.fetchedOn)
      const items = giantItems(parseXml(r.text))
      if (items.length === 0) break
      all.push(...items)
      fetchedPages = page
    } catch (e) {
      stopped = (e as Error).message
      if (e instanceof StopError) throw e
      break
    }
  }
  // 겹침 빼기: 항목 전체 글이 같으면 같은 회사
  const seen = new Set<string>()
  const unique = all.filter((r) => {
    const k = JSON.stringify(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const keys = [...new Set(unique.flatMap((r) => Object.keys(r)))]
  const industryKey = keys.find((k) => k === 'superIndTpNm') ?? keys.find((k) => /indTpNm$/i.test(k)) ?? null
  const brandKey = keys.find((k) => k === 'sgBrandNm') ?? keys.find((k) => /brand/i.test(k)) ?? null
  if (!industryKey || !brandKey) throw new Error(`216L01 항목에서 업종·인증 칸을 찾지 못함(칸: ${keys.join(', ')})`)
  const byIndustry = countBy(unique, (r) => (r[industryKey] ? [r[industryKey]] : ['(빈 칸)']))
  const ictRows = unique.filter((r) => ICT.test(r[industryKey] ?? ''))
  // 한 회사가 인증을 여럿 받으면 줄이 여럿이다. 회사 수는 사업자번호로 세고 번호는 적지 않는다
  const companyKey = keys.find((k) => k === 'busiNo') ?? null
  const companies = (rows: Flat[]): number | null => (companyKey ? new Set(rows.map((r) => r[companyKey]).filter(Boolean)).size : null)
  writeOut('small-giants-summary.json', {
    source: '고용24 오픈API 강소기업(216L01, 목록)',
    fetched_on: latest(dates),
    unit: '건 = 회사 × 인증 한 줄(한 회사가 인증을 여럿 받으면 여러 건)',
    total,
    counted: unique.length,
    counted_companies: companies(unique),
    counted_range: `${display}개씩 ${fetchedPages}쪽(전체 ${pages}쪽${fetchedPages < pages ? ` 중 앞 ${fetchedPages}쪽만` : ''}) · 겹침 뺀 ${unique.length}건${stopped ? ` · 중간에 멈춤: ${stopped}` : ''}`,
    ict: {
      label: [...new Set(ictRows.map((r) => r[industryKey] ?? ''))].join(', ') || '정보통신업',
      count: ictRows.length,
      companies: companies(ictRows),
      field: industryKey,
    },
    by_brand: countBy(unique, (r) => splitBrands(r[brandKey] ?? '')).map((x) => ({ brand: x.key, count: x.count })),
    brand_field: brandKey,
    by_industry: byIndustry.map((x) => ({ industry: x.key, count: x.count })),
    industry_field: industryKey,
    by_year: countBy(unique, (r) => (r.selYear ? [r.selYear] : [])).map((x) => ({ year: x.key, count: x.count })),
    note: '회사명·사업자번호 같은 회사별 값은 받아 둔 원본(.cache/work24, 커밋 안 함)에만 있고 이 파일에는 개수만 적음. 시연 회사는 가상이라 회사별 인증 여부는 쓰지 않음',
  })
}

// ── 출처 목록(sources.json) ───────────────────────────────────
// /about-ai 출처 표가 받은 날짜만 읽게(공통코드 파일은 커서 화면에 싣지 않는다)
const SOURCE_FILES = [
  { id: 'duty', label: '직무정보', api: '215L01', file: 'ncs-cards.json' },
  { id: 'job', label: '직업정보', api: '212D01', file: 'job-info.json' },
  { id: 'codes', label: '공통코드', api: '21L01', file: 'common-codes.json' },
  { id: 'giants', label: '강소기업', api: '216L01', file: 'small-giants-summary.json' },
] as const

function writeSources(): void {
  const files = SOURCE_FILES.flatMap((s) => {
    const p = join(OUT_DIR, s.file)
    if (!existsSync(p)) return []
    const { fetched_on } = JSON.parse(readFileSync(p, 'utf8')) as { fetched_on?: string }
    return [{ ...s, fetched_on: fetched_on ?? '' }]
  })
  if (files.length) writeOut('sources.json', { source: '고용24 오픈API(scripts/fetch-work24.ts)', files })
}

// ── 실행 ──────────────────────────────────────────────────────
async function main(): Promise<void> {
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',')
  const run = SECTIONS.filter((s) => !only || only.includes(s))
  const handlers: Record<Section, () => Promise<void>> = { ncs: sectionNcs, job: sectionJob, codes: sectionCodes, giants: sectionGiants }
  const failed: string[] = []
  for (const s of run) {
    log(`[${s}]`)
    try {
      await handlers[s]()
    } catch (e) {
      failed.push(`${s}: ${(e as Error).message}`)
      log(`  ✗ ${(e as Error).message}`)
      // 오류 응답·호출 실패·한도면 더 부르지 않고 멈춘다
      if (e instanceof StopError) break
    }
  }
  writeSources()
  log(`고용24 호출 ${calls}번(한도 ${MAX_CALLS})${failed.length ? ` · 실패 ${failed.length}건` : ''}`)
  if (failed.length) process.exitCode = 1
}

await main()
