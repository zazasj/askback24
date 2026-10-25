/**
 * DATA-01~07 — 고용24 공공데이터 실제 연결. ACCEPTANCE.md 「2차 추가분 · DATA」.
 * 파일 검사는 node fs 로 data/real/·dist/·git 기록을 읽는다(데스크톱 프로젝트에서 한 번).
 * .env 의 키 값은 비교에만 쓰고 메시지·파일에 남기지 않는다(시험용 복사본에는 가짜 키를 쓴다).
 * 받아 둔 원본(.cache/work24)이 있을 때만 원본 대조를 한다. 고용24 는 어떤 경우에도 실제로 부르지 않는다
 * (fetch:work24 를 돌리는 시험은 네트워크를 가로채는 preload 로 막고 가짜 응답을 준다).
 */
import { expect, test, type Page } from '@playwright/test'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  ABOUT_TITLE,
  COMPANY,
  REPO_ROOT,
  bodyText,
  cardGroups,
  expectCurrentStep,
  goToCardsStep,
  heading,
  normalize,
  openPrep,
  rowCells,
  showAllCards,
  stepText,
  stepUrl,
  tourScreens,
} from './helpers'
import {
  CACHE_DIR,
  JOB_INFO_SOURCE,
  SOURCE_COLUMNS,
  cacheIndex,
  datesIn,
  decodeXml,
  envEntries,
  envSecretValues,
  git,
  hasCache,
  headerText,
  inCache,
  isObject,
  isSecretName,
  listFiles,
  loadPostings,
  numberLeaves,
  objectArrays,
  parseDisplayedDate,
  precedes,
  readRepoJson,
  readText,
  repoPath,
  repoRel,
  runCommand,
  str,
  stringLeaves,
  valuesByKey,
  type Json,
  type JsonObject,
} from './helpers2'

test.use({ actionTimeout: 10_000 })

const FILE_ONCE = '파일 검사는 데스크톱 프로젝트에서 한 번'
const NCS = 'data/real/ncs-cards.json'
const JOB = 'data/real/job-info.json'
const CODES = 'data/real/common-codes.json'
const GIANTS = 'data/real/small-giants-summary.json'
const CARD_ID = /^BE\d{2}$/

function expectFile(rel: string): Json {
  expect(existsSync(repoPath(rel)), `${rel} 가 있어야 한다`).toBe(true)
  return readRepoJson(rel)
}

// ── DATA-01 업무 카드 NCS ──────────────────────────────────────

function cardIdOf(o: JsonObject): string | null {
  for (const k of ['card_id', 'cardId', 'id', 'card']) {
    const v = o[k]
    if (typeof v === 'string' && CARD_ID.test(v)) return v
  }
  for (const v of Object.values(o)) if (typeof v === 'string' && CARD_ID.test(v)) return v
  return null
}

/** 카드 항목들: 모든 원소에 카드 id(BE01 꼴)가 있는 객체 배열 중 가장 긴 것 */
function ncsEntries(file: Json): JsonObject[] {
  const arrays = objectArrays(file).filter((a) => a.every((o) => cardIdOf(o) !== null))
  return arrays.sort((a, b) => b.length - a.length)[0] ?? []
}

const valueLeaves = (e: JsonObject, min: number): string[] =>
  [...new Set(stringLeaves(e).map(normalize))].filter((s) => s.length >= min && !CARD_ID.test(s))

test('DATA-01 ncs-cards.json: NCS 업무 카드 15개, 머리에 출처·받은 날짜, 카드마다 matched, 맞은 카드는 능력단위명·정의·분류', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const file = expectFile(NCS)
  const head = headerText(file)
  expect(head, '파일 머리에 출처(고용24)').toMatch(/고용24|work24/i)
  expect(head, '파일 머리에 출처(직무정보 API 215L01)').toMatch(/215L01|직무\s*정보/)
  expect(datesIn(head).length, '파일 머리에 받은 날짜(YYYY-MM-DD)').toBeGreaterThan(0)

  const entries = ncsEntries(file)
  const ids = entries.map((e) => cardIdOf(e))
  expect(entries.length, `카드 항목 수(카드 id: ${ids.join(', ')})`).toBe(15)
  expect(new Set(ids).size, '카드 id가 서로 달라야 한다').toBe(15)
  for (const e of entries) expect(typeof e.matched, `${cardIdOf(e)}: matched 가 true/false 로 있어야 한다`).toBe('boolean')

  const matched = entries.filter((e) => e.matched === true)
  expect(matched.length, '응답에서 능력단위를 찾은(matched: true) 카드가 있어야 한다').toBeGreaterThan(0)
  for (const e of matched) {
    const id = cardIdOf(e)
    const leaves = valueLeaves(e, 2)
    expect(leaves.length, `${id}: 능력단위명·정의 등 값`).toBeGreaterThanOrEqual(2)
    expect(leaves.some((s) => s.length >= 15), `${id}: 능력단위 정의(문장)`).toBe(true)
    expect(JSON.stringify(e), `${id}: 분류(코드 또는 lod URL)`).toMatch(/lod|\d{6,}/i)
  }
  test.info().annotations.push({ type: 'matched', description: `${matched.length}/15 (false: ${entries.filter((e) => e.matched === false).map((e) => cardIdOf(e)).join(', ') || '없음'})` })
})

test('DATA-01 맞은 카드의 능력단위 값이 받아 둔 직무정보 원본(.cache/work24)과 글자 그대로 같다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  test.skip(!hasCache(), '받아 둔 원본(.cache/work24)이 없어 원본 대조를 건너뜀(npm run fetch:work24 뒤에 돈다)')
  test.setTimeout(180_000)
  const index = cacheIndex()
  for (const e of ncsEntries(expectFile(NCS)).filter((x) => x.matched === true)) {
    const id = cardIdOf(e)
    const found = valueLeaves(e, 4).filter((s) => inCache(index, s))
    expect(found.length, `${id}: 원본과 글자 그대로 같은 값(능력단위명·정의 등) 2개 이상`).toBeGreaterThanOrEqual(2)
    expect(found.some((s) => s.length >= 15), `${id}: 정의 문장이 원본에 그대로 있어야 한다`).toBe(true)
  }
})

/** ② 카드마다 이름(radiogroup 이름)과 카드 상자 안 "NCS" 줄의 값(없으면 null) */
async function cardNcsTexts(page: Page): Promise<Array<{ name: string; ncs: string | null }>> {
  return cardGroups(page).evaluateAll((groups) =>
    groups.map((g) => {
      const label =
        g.getAttribute('aria-label') ??
        (g.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
      let box: Element = g
      while (box.parentElement && box.parentElement.querySelectorAll('[role="radiogroup"]').length === 1) box = box.parentElement
      const lines = (box as HTMLElement).innerText
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      const i = lines.findIndex((l) => /\bNCS\b/.test(l))
      if (i < 0) return { name: label.replace(/\s+/g, ' ').trim(), ncs: null }
      let v = (lines[i] ?? '').replace(/\bNCS\b/, '').replace(/^[\s:：·|\-–]+/, '').trim()
      if (!v) v = lines[i + 1] ?? ''
      return { name: label.replace(/\s+/g, ' ').trim(), ncs: v }
    }),
  )
}

test('DATA-01 ② 카드의 "NCS" 표시가 ncs-cards.json 값이다(NCS 카드 15개)', async ({ page }) => {
  const entries = ncsEntries(expectFile(NCS))
  expect(entries.length).toBe(15)
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await showAllCards(page)
  await expect(cardGroups(page)).toHaveCount(17)
  const shown = (await cardNcsTexts(page)).filter((c) => c.ncs !== null)
  expect(shown.length, `"NCS" 표시가 있는 카드: ${shown.map((c) => c.name).join(', ')}`).toBe(entries.length)
  for (const c of shown) {
    const own = entries.find((e) => stringLeaves(e).map(normalize).includes(c.name))
    const leaves = (own ? [own] : entries).flatMap((e) => valueLeaves(e, 4)).filter((s) => s !== c.name)
    expect(leaves.some((s) => (c.ncs ?? '').includes(s)), `카드 "${c.name}"의 NCS 표시 "${c.ncs}"가 ncs-cards.json 값이어야 한다`).toBe(true)
  }
})

// ── DATA-02 직업정보 ───────────────────────────────────────────

/** 직무 개요 후보 문장(20자 이상 값을 문장으로 나눈 것, 10자 이상) */
function summarySentences(file: Json): string[] {
  const long = stringLeaves(file)
    .map(normalize)
    .filter((s) => s.length >= 20 && /[가-힣]/.test(s) && !/^https?:/.test(s))
  return [...new Set(long.flatMap((s) => s.split(/(?<=[.!?。])\s+/)).map(normalize).filter((s) => s.length >= 10))]
}

test('DATA-02 job-info.json: 직업정보(212D01) 응용소프트웨어개발자 K000001176 직무 개요 문장과 출처·받은 날짜', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const file = expectFile(JOB)
  const text = JSON.stringify(file)
  expect(text, '직업 코드 K000001176(응용소프트웨어개발자, 공고 직종 133200)').toContain('K000001176')
  expect(text, '출처(고용24)').toMatch(/고용24|work24/i)
  expect(text, '출처(직업정보 API 212D01)').toMatch(/212D01|직업\s*정보/)
  expect(datesIn(text).length, '받은 날짜(YYYY-MM-DD)').toBeGreaterThan(0)
  const sentences = summarySentences(file)
  expect(sentences.length, '직무 개요 문장').toBeGreaterThan(0)
  if (hasCache()) {
    const index = cacheIndex()
    expect(sentences.some((s) => inCache(index, s)), '직무 개요 문장이 받아 둔 원본(.cache/work24)에 글자 그대로 있어야 한다').toBe(true)
  } else {
    test.info().annotations.push({ type: '원본 대조 건너뜀', description: '.cache/work24 없음' })
  }
})

test('DATA-02 ② 카드 고르기 위에 직무 개요 문장과 "고용24 직업정보" 출처가 보인다', async ({ page }) => {
  const sentences = summarySentences(expectFile(JOB))
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  const source = page.getByText(JOB_INFO_SOURCE).filter({ visible: true }).first()
  await expect(source, `출처 "${JOB_INFO_SOURCE}"`).toBeVisible()
  const body = normalize(await bodyText(page))
  const shown = sentences.filter((s) => body.includes(s))
  expect(shown.length, `job-info.json 직무 개요 문장 중 하나가 보여야 한다(예: ${sentences.slice(0, 2).join(' / ')})`).toBeGreaterThan(0)
  const firstCard = cardGroups(page).first()
  expect(await precedes(source, firstCard), '"고용24 직업정보" 출처가 카드보다 위에').toBe(true)
  const sentence = page.getByText(shown[0]?.slice(0, 30) ?? '').filter({ visible: true }).first()
  await expect(sentence).toBeVisible()
  expect(await precedes(sentence, firstCard), '직무 개요 문장이 카드보다 위에').toBe(true)
})

// ── DATA-03 공통코드 ───────────────────────────────────────────

const REGION_KEY = /^(?!.*(?:sta|line|subway|near))[A-Za-z_]*(?:region|rgn|area)[A-Za-z_]*?(?:cd|code)$/i
const JOB_KEY = /(?:^|[a-z_])jobs?_?cd$|^jobs?_?code$|occupation[A-Za-z_]*(?:cd|code)$/i

test('DATA-03 common-codes.json 의 실제 코드: 모의 공고 7건의 지역·직종 코드가 이 파일에 있다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const file = expectFile(CODES)
  const text = JSON.stringify(file)
  expect(text, '출처(공통코드 API 21L01)').toMatch(/21L01|공통\s*코드/)
  expect(datesIn(text).length, '받은 날짜(YYYY-MM-DD)').toBeGreaterThan(0)
  const codes = new Set(
    [...stringLeaves(file), ...numberLeaves(file).map((n) => String(n.value))].map((s) => s.trim()).filter((s) => /^[0-9A-Za-z]{2,12}$/.test(s)),
  )
  expect(codes.size, '지역코드 등 코드 값').toBeGreaterThanOrEqual(50)

  const postings = loadPostings()
  expect(postings, 'data/postings.json 공고 7건').toHaveLength(7)
  const index = hasCache() ? cacheIndex() : null
  for (const p of postings) {
    const id = str(p.wantedAuthNo) || str(p.corpNm)
    const codeKeys = Object.keys(p).filter((k) => /(cd|code)$/i.test(k)).join(', ') || '(없음)'
    const region = valuesByKey(p, REGION_KEY).map((x) => str(x.value).trim()).filter(Boolean)
    const job = valuesByKey(p, JOB_KEY).map((x) => str(x.value).trim()).filter(Boolean)
    expect(region.length, `${id}: 지역 코드 칸(regionCd 등) — 공고의 코드 칸: ${codeKeys}`).toBeGreaterThan(0)
    expect(job.length, `${id}: 직종 코드 칸(jobsCd 등) — 공고의 코드 칸: ${codeKeys}`).toBeGreaterThan(0)
    for (const c of [...region, ...job]) {
      expect(codes.has(c), `${id}: 코드 ${c}가 common-codes.json 에 있어야 한다`).toBe(true)
      if (index) expect(index.leaves.has(c), `${id}: 코드 ${c}가 받아 둔 공통코드 원본에 있어야 한다`).toBe(true)
    }
  }
})

// ── DATA-04 강소기업 통계 ──────────────────────────────────────

function giantsTotal(file: Json): number {
  const totals = valuesByKey(file, /total|전체|^all/i)
    .map((x) => x.value)
    .filter((v): v is number => typeof v === 'number')
  const all = numberLeaves(file).map((n) => n.value)
  return Math.max(...(totals.length > 0 ? totals : all), 0)
}

const ICT = /정보\s*통신|소프트웨어|software|\bict\b|information/i

function giantsIct(file: Json): number | null {
  const byPath = numberLeaves(file).find((n) => ICT.test(n.path))
  if (byPath) return byPath.value
  const visit = (v: Json): number | null => {
    if (Array.isArray(v)) {
      for (const x of v) {
        const r = visit(x)
        if (r !== null) return r
      }
    } else if (isObject(v)) {
      const own = Object.values(v)
      const num = own.find((x): x is number => typeof x === 'number')
      if (num !== undefined && own.some((x) => typeof x === 'string' && ICT.test(x))) return num
      for (const x of own) {
        const r = visit(x)
        if (r !== null) return r
      }
    }
    return null
  }
  return visit(file)
}

/** 인증 종류별 수: cert·brand·인증 이 든 키 아래의 (이름 → 수) 목록 중 가장 긴 것 */
function giantsCertCounts(file: Json): Array<{ name: string; value: number }> {
  let best: Array<{ name: string; value: number }> = []
  for (const { value } of valuesByKey(file, /cert|brand|인증/i)) {
    let list: Array<{ name: string; value: number }> = []
    if (isObject(value)) {
      list = Object.entries(value)
        .filter((e): e is [string, number] => typeof e[1] === 'number')
        .map(([name, v]) => ({ name, value: v }))
    } else if (Array.isArray(value)) {
      list = value.filter(isObject).flatMap((o) => {
        const name = Object.values(o).find((x): x is string => typeof x === 'string')
        const v = Object.values(o).find((x): x is number => typeof x === 'number')
        return name !== undefined && v !== undefined ? [{ name, value: v }] : []
      })
    }
    if (list.length > best.length) best = list
  }
  return best
}

test('DATA-04 small-giants-summary.json: 강소기업 전체 수·정보통신업(소프트웨어) 수·인증 종류별 수·받은 날짜', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const file = expectFile(GIANTS)
  const text = JSON.stringify(file)
  expect(text, '출처(강소기업 API 216L01)').toMatch(/216L01|강소\s*기업/)
  expect(datesIn(text).length, '받은 날짜(YYYY-MM-DD)').toBeGreaterThan(0)
  const total = giantsTotal(file)
  expect(total, '전체 수').toBeGreaterThanOrEqual(1000)
  const ict = giantsIct(file)
  expect(ict, '정보통신업(또는 소프트웨어 업종) 수').not.toBeNull()
  expect((ict ?? 0) > 0 && (ict ?? 0) < total, `정보통신업 수 ${ict}가 0보다 크고 전체 ${total}보다 작아야 한다`).toBe(true)
  const certs = giantsCertCounts(file)
  expect(certs.length, `인증 종류별 수: ${certs.map((c) => `${c.name} ${c.value}`).join(', ') || '(못 찾음)'}`).toBeGreaterThanOrEqual(2)
})

test('DATA-04 /about-ai 에 강소기업 통계(전체 수·정보통신업 수)가 보인다', async ({ page }) => {
  const file = expectFile(GIANTS)
  const total = giantsTotal(file)
  const ict = giantsIct(file)
  await page.goto('/about-ai')
  await expect(heading(page, ABOUT_TITLE)).toBeVisible()
  const text = (await bodyText(page)).replace(/(\d),(?=\d{3})/g, '$1')
  expect(text, '"강소기업"').toContain('강소기업')
  expect(text, `강소기업 전체 수 ${total}`).toContain(String(total))
  expect(text, `정보통신업(소프트웨어) 수 ${ict}`).toContain(String(ict))
})

test('DATA-04 회사 신호의 강소기업 여부는 "모의" 배지다(S4 ①)', async ({ page }) => {
  let seen = 0
  for (const key of ['oo', 'commerce', 'data'] as const) {
    const base = await openPrep(page, key)
    if (!(await stepText(page)).includes('공고 확인')) await page.goto(stepUrl(base, 1))
    await expectCurrentStep(page, '공고 확인')
    const all = page.getByRole('listitem').filter({ hasText: '강소기업' }).filter({ has: page.getByText(/^(실제|모의)$/) })
    const items = all.filter({ hasNot: all })
    const n = await items.count()
    seen += n
    for (let i = 0; i < n; i++) {
      const label = `${COMPANY[key]} 신호 "${normalize(await items.nth(i).innerText()).slice(0, 60)}"`
      await expect(items.nth(i).getByText('모의', { exact: true }).first(), `${label}: "모의"`).toBeVisible()
      await expect(items.nth(i).getByText('실제', { exact: true }), `${label}: "실제"가 아니어야`).toHaveCount(0)
    }
  }
  test.info().annotations.push({ type: '강소기업 신호', description: `${seen}개 확인` })
})

// ── DATA-05 키·실제 회사 정보 ──────────────────────────────────

const SCAN_DIRS = ['dist', 'data', 'src', 'shared', 'api', 'scripts', 'docs', 'public', 'e2e']
const SCAN_ROOT_FILES = ['README.md', 'package.json', 'index.html', 'vite.config.ts', 'vercel.json', '.env.example', '.env.mock']
/** authKey=<긴 값> 꼴(문서의 자리표시 "…"·"<KEY>"·"${…}"는 걸리지 않음) */
const AUTH_KEY_IN_URL = /authKey=([A-Za-z0-9._~%+/=-]{20,})/i

function scanFiles(): string[] {
  return [...SCAN_DIRS.flatMap((d) => listFiles(repoPath(d))), ...SCAN_ROOT_FILES.map(repoPath).filter((p) => existsSync(p))]
}

test('DATA-05 API 키가 dist/·data/·src/·git 기록 어디에도 없다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  test.setTimeout(180_000)
  const secrets = envSecretValues()
  if (!secrets) test.info().annotations.push({ type: '.env 없음', description: 'authKey=… 꼴만 찾는다' })
  const hits: string[] = []
  for (const f of scanFiles()) {
    const text = readText(f)
    if (text === null) continue
    secrets?.forEach((s, i) => {
      if (text.includes(s)) hits.push(`${repoRel(f)} → .env 키 #${i + 1}`)
    })
    if (AUTH_KEY_IN_URL.test(text)) hits.push(`${repoRel(f)} → authKey=… 값`)
  }
  expect(hits, '키가 든 파일(값은 적지 않음)').toEqual([])

  const history = git(['log', '--all', '-p', '--text', '--no-color', '--no-ext-diff'])
  const leaked = (secrets ?? []).map((s, i) => (history.includes(s) ? `.env 키 #${i + 1}` : '')).filter(Boolean)
  if (AUTH_KEY_IN_URL.test(history)) leaked.push('authKey=… 값')
  expect(leaked, 'git 기록(모든 브랜치)에 키가 있으면 안 된다').toEqual([])
})

const COMPANY_NAME_KEY = /^(?:co|corp|cmpny|company|ent|entrps|biz|bizpl|bsns|firm)_?(?:nm|name)$/i
const BIZ_NO_KEY = /^(?:biz|busi|bz|br|bizr|saup|corp_?reg|corpreg)_?no$/i
const BIZ_NO_VALUE = /^\d{3}-?\d{2}-?\d{5}$/
const BIZ_NO_IN_TEXT = /(?<!\d)(\d{3}-\d{2}-\d{5}|\d{10})(?!\d)/g

function bizNosIn(text: string): Set<string> {
  return new Set([...text.matchAll(BIZ_NO_IN_TEXT)].map((m) => (m[1] ?? '').replace(/-/g, '')))
}

/** 받아 둔 강소기업 원본(216L01)의 회사명·사업자번호 */
function cachedCompanies(): { names: Set<string>; bizNos: Set<string> } {
  const names = new Set<string>()
  const bizNos = new Set<string>()
  const take = (key: string, raw: string) => {
    const v = normalize(raw)
    if (COMPANY_NAME_KEY.test(key) && v.length >= 3) names.add(v)
    if (BIZ_NO_KEY.test(key) || BIZ_NO_VALUE.test(v)) {
      if (BIZ_NO_VALUE.test(v)) bizNos.add(v.replace(/-/g, ''))
    }
  }
  for (const f of listFiles(CACHE_DIR)) {
    const text = readText(f, 200_000_000)
    if (text === null || !(/216L01|smallgiant/i.test(repoRel(f)) || /smallGiant/i.test(text.slice(0, 20_000)))) continue
    try {
      const walk = (v: Json): void => {
        if (Array.isArray(v)) v.forEach(walk)
        else if (isObject(v)) for (const [k, x] of Object.entries(v)) typeof x === 'string' || typeof x === 'number' ? take(k, String(x)) : walk(x)
      }
      walk(JSON.parse(text.replace(/^﻿/, '')) as Json)
    } catch {
      for (const m of decodeXml(text).matchAll(/<([A-Za-z_][\w.-]*)>([^<]{1,200})<\/\1>/g)) take(m[1] ?? '', m[2] ?? '')
    }
  }
  return { names, bizNos }
}

test('DATA-05 실제 회사명·사업자번호: .cache/ 는 .gitignore·커밋 안 됨, data/real/ 에 회사 이름·사업자번호가 없다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  test.setTimeout(180_000)
  const ignore = readFileSync(repoPath('.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim())
  expect(ignore.some((l) => l === '.cache' || l === '.cache/' || l === '/.cache' || l === '/.cache/'), '.gitignore 에 .cache').toBe(true)
  const everCommitted = git(['log', '--all', '--pretty=format:', '--name-only'])
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('.cache/'))
  expect([...new Set(everCommitted)], 'git 기록에 .cache/ 파일이 없어야 한다').toEqual([])

  const realFiles = listFiles(repoPath('data/real'))
  expect(realFiles.length, 'data/real/ 파일').toBeGreaterThan(0)
  const problems: string[] = []
  const realLeaves = new Set<string>()
  for (const f of realFiles) {
    const text = readText(f) ?? ''
    if (/\d{3}-\d{2}-\d{5}/.test(text)) problems.push(`${repoRel(f)} → 사업자번호 모양(000-00-00000)`)
    if (!f.endsWith('.json')) continue
    const json = JSON.parse(text.replace(/^﻿/, '')) as Json
    for (const { key } of valuesByKey(json, /.*/)) {
      if (COMPANY_NAME_KEY.test(key) || BIZ_NO_KEY.test(key) || /사업자|회사명|기업명|상호/.test(key)) problems.push(`${repoRel(f)} → 키 "${key}"`)
    }
    stringLeaves(json).forEach((s) => realLeaves.add(normalize(s)))
  }

  if (hasCache()) {
    const { names, bizNos } = cachedCompanies()
    test.info().annotations.push({ type: '강소기업 원본', description: `회사명 ${names.size}개 · 사업자번호 ${bizNos.size}개로 대조` })
    for (const n of names) if (realLeaves.has(n)) problems.push(`data/real/ → 실제 회사명 값(원본과 같음)`)
    for (const f of realFiles) for (const b of bizNosIn(readText(f) ?? '')) if (bizNos.has(b)) problems.push(`${repoRel(f)} → 실제 사업자번호`)
    // 지금 커밋된 파일과 git 기록에 원본(회사명 묶음·사업자번호)이 없어야 한다
    const sample = [...names].filter((n) => n.length >= 5).filter((_n, i, arr) => i % Math.max(1, Math.floor(arr.length / 300)) === 0)
    for (const rel of git(['ls-files']).split(/\r?\n/).filter(Boolean)) {
      const text = readText(join(REPO_ROOT, rel), 50_000_000)
      if (text === null) continue
      const nameHits = sample.filter((n) => text.includes(n)).length
      if (nameHits >= 5) problems.push(`${rel} → 실제 회사명 ${nameHits}개(원본으로 보임)`)
      for (const b of bizNosIn(text)) if (bizNos.has(b)) problems.push(`${rel} → 실제 사업자번호`)
    }
    for (const b of bizNosIn(git(['log', '--all', '-p', '--text', '--no-color', '--no-ext-diff']))) {
      if (bizNos.has(b)) problems.push('git 기록 → 실제 사업자번호')
    }
  } else {
    test.info().annotations.push({ type: '원본 대조 건너뜀', description: '.cache/work24 없음 — 키 이름·모양만 본다' })
  }
  expect([...new Set(problems)]).toEqual([])
})

// ── DATA-06 /about-ai 출처 표 ──────────────────────────────────

test('DATA-06 /about-ai 출처 표: 열 "데이터" "출처" "구분" "받은 날짜" · 고용24 오픈API 4종 실제(받은 날짜) · 채용정보 모의(개인회원) · 국민연금 실제 · 임금체불 모의', async ({ page }) => {
  await page.goto('/about-ai')
  await expect(heading(page, ABOUT_TITLE)).toBeVisible()
  const table = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: '받은 날짜' }) }).first()
  await expect(table, '"받은 날짜" 열이 있는 출처 표').toBeVisible()
  const headers = (await table.getByRole('columnheader').allInnerTexts()).map(normalize)
  for (const col of SOURCE_COLUMNS) expect(headers, `열 "${col}"`).toContain(col)
  const at = (col: (typeof SOURCE_COLUMNS)[number]) => headers.indexOf(col)

  const rows = table.getByRole('row').filter({ has: page.getByRole('cell') })
  const n = await rows.count()
  const data: Array<{ text: string; cells: string[] }> = []
  for (let i = 0; i < n; i++) {
    const cells = (await rowCells(rows.nth(i)).allInnerTexts()).map(normalize)
    data.push({ text: cells.join(' | '), cells })
  }
  expect(data.length, '출처 표의 줄').toBeGreaterThan(0)
  const kind = (r: { cells: string[] }) => r.cells[at('구분')] ?? ''
  for (const r of data) expect(['실제', '모의'], `구분 칸은 "실제" 또는 "모의": ${r.text}`).toContain(kind(r))
  const rowsWith = (word: string) => data.filter((r) => r.text.includes(word))

  const REAL: Array<[string, string]> = [
    ['직무정보', NCS],
    ['직업정보', JOB],
    ['공통코드', CODES],
    ['강소기업', GIANTS],
  ]
  for (const [name, file] of REAL) {
    const real = rowsWith(name).filter((r) => kind(r) === '실제')
    expect(real.length, `"${name}" 줄이 "실제"여야 한다: ${rowsWith(name).map((r) => r.text).join(' / ') || '(줄 없음)'}`).toBeGreaterThan(0)
    const row = real[0] ?? { text: '', cells: [] }
    const source = row.cells[at('출처')] ?? ''
    expect(source, `"${name}" 출처`).toMatch(/고용24/)
    expect(source, `"${name}" 출처`).toMatch(/오픈\s*API|open\s*api/i)
    const shown = parseDisplayedDate(row.cells[at('받은 날짜')] ?? '')
    expect(shown, `"${name}" 받은 날짜: ${row.text}`).not.toBeNull()
    expect(datesIn(JSON.stringify(expectFile(file))), `"${name}" 받은 날짜 ${shown}가 ${file}의 날짜와 같아야 한다`).toContain(shown)
  }

  const jobs = rowsWith('채용정보')
  expect(jobs.length, '"채용정보" 줄').toBeGreaterThan(0)
  for (const r of jobs) expect(kind(r), `채용정보 = "모의": ${r.text}`).toBe('모의')
  expect(jobs.some((r) => r.text.includes('개인회원')), `채용정보 줄에 이유("개인회원" 사용 불가): ${jobs.map((r) => r.text).join(' / ')}`).toBe(true)

  const pension = rowsWith('국민연금')
  expect(pension.length, '"국민연금" 줄').toBeGreaterThan(0)
  for (const r of pension) expect(kind(r), `국민연금 = "실제"(지금 구분 유지): ${r.text}`).toBe('실제')
  const unpaid = rowsWith('임금체불')
  expect(unpaid.length, '"임금체불" 줄').toBeGreaterThan(0)
  for (const r of unpaid) expect(kind(r), `임금체불 = "모의"(지금 구분 유지): ${r.text}`).toBe('모의')
})

// ── DATA-07 fetch:work24 · 시험·빌드는 부르지 않음 ──────────────

const DATA07 = repoPath('review/tmp/data07')

/** 고용24(work24.go.kr)로 가는 호출을 가로채 기록하는 preload. 키 값은 기록하지 않는다(가짜 키인지만). */
const NETSPY = String.raw`
import { appendFileSync } from 'node:fs'
import dns from 'node:dns'
import net from 'node:net'
import tls from 'node:tls'
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'

const LOG = process.env.NETSPY_LOG || ''
const MODE = process.env.NETSPY_MODE || 'block'
let DUMMIES = []
try { DUMMIES = JSON.parse(process.env.NETSPY_DUMMY_KEYS || '[]') } catch {}
const HOST = /(^|\.)work24\.go\.kr\.?$/i
const now = () => performance.timeOrigin + performance.now()
const record = (entry) => { if (!LOG) return; try { appendFileSync(LOG, JSON.stringify({ pid: process.pid, t: now(), ...entry }) + '\n') } catch {} }
const blocked = () => Object.assign(new Error('netspy: 시험 중 고용24 호출을 막음'), { code: 'ENOTFOUND' })
function describe(href) {
  let url
  try { url = new URL(String(href)) } catch { return { host: '', path: '', key: 'none', sig: '' } }
  const raw = url.searchParams.get('authKey') ?? url.searchParams.get('authkey') ?? url.searchParams.get('serviceKey')
  const key = !raw ? 'none' : DUMMIES.includes(raw) ? 'dummy' : 'other'
  for (const k of ['authKey', 'authkey', 'serviceKey']) url.searchParams.delete(k)
  return { host: url.hostname, path: url.pathname, key, sig: url.pathname + '?' + url.searchParams.toString() }
}
function stub(href) {
  const json = /returnType=json/i.test(String(href))
  const body = json ? '{"result":[]}' : '<?xml version="1.0" encoding="UTF-8"?><root><total>0</total></root>'
  return new Response(body, { status: 200, headers: { 'content-type': json ? 'application/json;charset=UTF-8' : 'text/xml;charset=UTF-8' } })
}
const origFetch = globalThis.fetch
if (typeof origFetch === 'function') {
  globalThis.fetch = async function netspyFetch(input, init) {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url
    const d = describe(href)
    if (HOST.test(d.host)) {
      record({ layer: 'fetch', ...d })
      if (MODE === 'stub') return stub(href)
      throw new TypeError('fetch failed', { cause: blocked() })
    }
    return origFetch.call(this, input, init)
  }
}
const hostOf = (a) => {
  if (typeof a === 'string' || a instanceof URL) { try { return new URL(String(a)).hostname } catch { return '' } }
  return String((a && (a.hostname || a.host)) || '').replace(/:\d+$/, '')
}
for (const [mod, proto] of [[http, 'http:'], [https, 'https:']]) {
  for (const fn of ['request', 'get']) {
    const orig = mod[fn]
    mod[fn] = function (...args) {
      const first = args[0]
      const host = hostOf(first)
      if (HOST.test(host)) {
        const href = typeof first === 'string' || first instanceof URL ? String(first) : proto + '//' + host + ((first && first.path) || '/')
        record({ layer: 'http', ...describe(href) })
        throw blocked()
      }
      return orig.apply(this, args)
    }
  }
}
const origLookup = dns.lookup
dns.lookup = function (hostname, ...rest) {
  if (HOST.test(String(hostname))) {
    record({ layer: 'dns', host: String(hostname), path: '', key: 'none', sig: '' })
    const cb = rest[rest.length - 1]
    if (typeof cb === 'function') { process.nextTick(cb, blocked()); return {} }
    throw blocked()
  }
  return origLookup.call(this, hostname, ...rest)
}
const origPromiseLookup = dns.promises.lookup
dns.promises.lookup = function (hostname, ...rest) {
  if (HOST.test(String(hostname))) {
    record({ layer: 'dns', host: String(hostname), path: '', key: 'none', sig: '' })
    return Promise.reject(blocked())
  }
  return origPromiseLookup.call(this, hostname, ...rest)
}
for (const [mod, fns] of [[net, ['connect', 'createConnection']], [tls, ['connect']]]) {
  for (const fn of fns) {
    const orig = mod[fn]
    mod[fn] = function (...args) {
      const a = args[0]
      const host = a && typeof a === 'object' ? String(a.host || a.servername || '') : typeof args[1] === 'string' ? args[1] : ''
      if (HOST.test(host)) { record({ layer: 'net', host, path: '', key: 'none', sig: '' }); throw blocked() }
      return orig.apply(this, args)
    }
  }
}
syncBuiltinESMExports()
`

type SpyRecord = { pid: number; t: number; layer: 'fetch' | 'http' | 'dns' | 'net'; host: string; path: string; key: 'dummy' | 'other' | 'none'; sig: string }

function writeSpy(): string {
  mkdirSync(DATA07, { recursive: true })
  const p = join(DATA07, 'netspy.mjs')
  writeFileSync(p, NETSPY)
  return p
}

function readSpyLog(log: string): SpyRecord[] {
  if (!existsSync(log)) return []
  return readFileSync(log, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SpyRecord)
}

function spyEnv(log: string, mode: 'block' | 'stub', dummies: string[]): NodeJS.ProcessEnv {
  return { NODE_OPTIONS: `--import=${pathToFileURL(writeSpy()).href}`, NETSPY_LOG: log, NETSPY_MODE: mode, NETSPY_DUMMY_KEYS: JSON.stringify(dummies) }
}

/** 출력에서 키 모양을 가린다(복사본은 가짜 키지만, 혹시 진짜 키가 섞여도 남지 않게). */
function redact(text: string): string {
  let out = text.replace(/(authKey=)[^&\s"'<>]+/gi, '$1***')
  for (const s of envSecretValues() ?? []) out = out.split(s).join('***')
  return out
}

const COPY_SKIP = new Set(['node_modules', '.git', 'dist', 'review', 'test-results', 'playwright-report', '.cache', '.vercel', 'e2e', '.env'])

/** 레포를 review/tmp/data07/<name> 에 복사한다(.env·원본·data/real 빼고). */
function makeSandbox(name: string): string {
  const dir = join(DATA07, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const entry of readdirSync(REPO_ROOT)) {
    if (COPY_SKIP.has(entry) || /^\.env\..*local$/.test(entry)) continue
    cpSync(join(REPO_ROOT, entry), join(dir, entry), { recursive: true })
  }
  rmSync(join(dir, 'data', 'real'), { recursive: true, force: true })
  return dir
}

/** 복사본에 가짜 키 .env 를 쓴다(이름은 레포 .env 와 같게, 키 값은 가짜). 레포에 .env 가 없으면 null. */
function writeDummyEnv(dir: string): string[] | null {
  const entries = envEntries()
  if (!entries) return null
  const dummies: string[] = []
  const lines = entries.map(({ name, value }) => {
    if (isSecretName(name) || /[A-Za-z0-9]{20,}/.test(value)) {
      const d = `DUMMY-${name}-0000000000`
      dummies.push(d)
      return `${name}=${d}`
    }
    return `${name}=${value}`
  })
  writeFileSync(join(dir, '.env'), `${lines.join('\n')}\n`)
  return dummies
}

/** 레포의 data/real·.cache/work24 를 떠 두고, 시험 뒤 바뀐 것을 되돌린다(스크립트가 복사본 밖에 쓰면 잡으려고). */
function guardRepo(): { restore: () => string[] } {
  const dirs = [repoPath('data/real'), CACHE_DIR]
  const before = new Map<string, Buffer>()
  for (const d of dirs) for (const f of listFiles(d)) before.set(f, readFileSync(f))
  return {
    restore: () => {
      const touched: string[] = []
      for (const d of dirs) {
        for (const f of listFiles(d)) {
          const old = before.get(f)
          if (!old) {
            rmSync(f, { force: true })
            touched.push(`${repoRel(f)}(새로 생김 → 지움)`)
          } else if (!old.equals(readFileSync(f))) {
            writeFileSync(f, old)
            touched.push(`${repoRel(f)}(바뀜 → 되돌림)`)
          }
        }
      }
      for (const [f, old] of before) {
        if (!existsSync(f)) {
          mkdirSync(dirname(f), { recursive: true })
          writeFileSync(f, old)
          touched.push(`${repoRel(f)}(지워짐 → 되돌림)`)
        }
      }
      return touched
    },
  }
}

function runFetch(dir: string, mode: 'block' | 'stub', dummies: string[]): { status: number | null; calls: SpyRecord[]; output: string } {
  const log = join(dir, 'netspy.log')
  rmSync(log, { force: true })
  const r = runCommand('npm run fetch:work24', { cwd: dir, timeout: 280_000, env: spyEnv(log, mode, dummies) })
  return { status: r.status, calls: readSpyLog(log), output: redact(r.output).slice(-2500) }
}

const callLine = (c: SpyRecord) => `${c.layer} ${c.sig || c.host}`

test('DATA-07 package.json 에 fetch:work24 가 있고 빌드·시험·실행 스크립트는 그것을 부르지 않는다, .cache 는 .gitignore', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const pkg = JSON.parse(readFileSync(repoPath('package.json'), 'utf8')) as { scripts?: Record<string, string> }
  const scripts = pkg.scripts ?? {}
  expect(scripts['fetch:work24'], 'npm run fetch:work24 스크립트').toBeTruthy()
  for (const [name, cmd] of Object.entries(scripts)) {
    if (!/^(build|dev|preview|test|check|typecheck|screens)/.test(name)) continue
    expect(cmd, `"${name}" 스크립트가 fetch:work24 를 부르면 안 된다`).not.toMatch(/fetch:work24|fetch-work24/)
  }
  const ignore = readFileSync(repoPath('.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim())
  expect(ignore.some((l) => /^\/?\.cache\/?$/.test(l)), '.gitignore 에 .cache').toBe(true)
})

test('DATA-07 화면은 고용24 API를 부르지 않는다(모든 경로)', async ({ page, isMobile }) => {
  test.skip(isMobile, '네트워크 호출은 폭과 상관없어 데스크톱에서 한 번')
  test.setTimeout(240_000)
  const calls: string[] = []
  await page.context().route(/work24\.go\.kr/i, async (route) => {
    calls.push(new URL(route.request().url()).pathname)
    await route.abort()
  })
  await tourScreens(page, async () => {})
  expect(calls, '화면에서 고용24로 간 요청').toEqual([])
})

test('DATA-07 빌드·단위 시험은 고용24 API를 부르지 않는다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  test.setTimeout(600_000)
  const log = join(DATA07, 'build-unit.log')
  rmSync(log, { force: true })
  const env = spyEnv(log, 'block', [])
  const build = runCommand('npx vite build --mode mock --outDir review/tmp/data07/dist --emptyOutDir', { env })
  expect(build.ok, `vite build(네트워크 가로채기 켠 채)\n${redact(build.output)}`).toBe(true)
  const unit = runCommand('npm run test:unit', { env })
  expect(unit.output, `npm run test:unit 이 돌아야 한다\n${redact(unit.output)}`).toMatch(/Test Files|Tests\s+\d+/)
  test.info().annotations.push({ type: 'test:unit', description: unit.ok ? '통과' : '실패(NF-01에서 판정)' })
  expect(readSpyLog(log).map(callLine), '빌드·단위 시험 중 고용24 호출').toEqual([])
})

test('DATA-07 받아 둔 원본(.cache/work24)이 있으면 fetch:work24 가 고용24를 다시 부르지 않는다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  test.skip(!hasCache(), '받아 둔 원본(.cache/work24)이 없어 건너뜀(npm run fetch:work24 뒤에 돈다)')
  test.setTimeout(400_000)
  const dir = makeSandbox('cached')
  cpSync(CACHE_DIR, join(dir, '.cache', 'work24'), { recursive: true })
  const dummies = writeDummyEnv(dir) ?? []
  const guard = guardRepo()
  let touched: string[] = []
  try {
    const r = runFetch(dir, 'block', dummies)
    test.info().annotations.push({ type: 'fetch:work24(원본 있음)', description: `종료 코드 ${r.status}, 고용24 호출 ${r.calls.length}번` })
    expect(r.calls.map(callLine), `원본이 있는데 고용24를 불렀다(캐시 이름에 키가 들어가면 가짜 키 때문에 다시 부를 수 있음)\n${r.output}`).toEqual([])
    expect(r.status, `npm run fetch:work24 종료 코드\n${r.output}`).toBe(0)
    expect(listFiles(join(dir, 'data', 'real')).length, '원본에서 data/real/ 을 다시 만들어야 한다').toBeGreaterThan(0)
  } finally {
    touched = guard.restore()
    rmSync(join(dir, '.cache'), { recursive: true, force: true })
  }
  expect(touched, '시험용 복사본 밖(레포 data/real·.cache)에 쓰면 안 된다(되돌려 놓음)').toEqual([])
})

test('DATA-07 원본이 없으면 .env 키로 부르고, 1초에 1번 이하·한 번 실행에 200번 이하(가짜 응답으로 확인)', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  test.skip(envEntries() === null, '.env 가 없어 키 읽기를 확인할 수 없음')
  test.setTimeout(600_000)
  const dir = makeSandbox('fresh')
  const dummies = writeDummyEnv(dir) ?? []
  expect(dummies.length, '.env 에 키 이름(…KEY…)이 있어야 한다').toBeGreaterThan(0)
  const guard = guardRepo()
  let touched: string[] = []
  try {
    const r = runFetch(dir, 'stub', dummies)
    const calls = r.calls.filter((c) => c.layer === 'fetch' || c.layer === 'http').sort((a, b) => a.t - b.t)
    const gaps = calls.slice(1).map((c, i) => Math.round(c.t - (calls[i]?.t ?? c.t)))
    test.info().annotations.push({ type: 'fetch:work24(가짜 응답)', description: `종료 코드 ${r.status}, 호출 ${calls.length}번, 간격(ms) ${gaps.slice(0, 30).join(', ')}` })
    expect(calls.length, `원본이 없으면 고용24를 불러야 한다\n${r.output}`).toBeGreaterThan(0)
    expect(calls.length, '한 번 실행에 200번 이하').toBeLessThanOrEqual(200)
    expect(calls.filter((c) => c.key !== 'dummy').map((c) => `${c.sig} (키: ${c.key})`), '모든 호출이 .env 의 키(authKey)를 써야 한다').toEqual([])
    expect(gaps.filter((g) => g < 990), `1초에 1번 이하 — 1초보다 짧은 간격(ms)`).toEqual([])
    if (calls.length < 2) test.info().annotations.push({ type: '간격 확인 못 함', description: '가짜 응답에서 호출이 1번뿐' })
  } finally {
    touched = guard.restore()
  }
  expect(touched, '시험용 복사본 밖(레포 data/real·.cache)에 쓰면 안 된다(되돌려 놓음)').toEqual([])
})
