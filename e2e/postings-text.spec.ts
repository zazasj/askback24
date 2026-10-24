/**
 * P-01~05 — 비정형(긴 글) 공고. ACCEPTANCE.md 「2차 추가분 · P」.
 * P-01·02·04 는 data/postings.json·data/analysis/*.json 을 node fs 로 읽는다(데스크톱 프로젝트에서 한 번).
 * P-03·05 는 화면의 공고 글 블록이 원문 줄(소제목·목록 기호 포함)을 그대로 보이는지 본다.
 */
import { expect, test } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import { basename } from 'node:path'
import { COMPANY, expectCurrentStep, jobDetailPaths, normalize, openPrep, postingTitle, stepText, stepUrl } from './helpers'
import { isObject, loadPostings, postingBlock, readRepoJson, repoPath, sourceLinesOf, str, stringLeaves, type Json, type JsonObject, type Posting } from './helpers2'

test.use({ actionTimeout: 10_000 })

const FILE_ONCE = '파일 검사는 데스크톱 프로젝트에서 한 번'

const SECTIONS: ReadonlyArray<[string, RegExp]> = [
  ['회사소개', /회사\s*소개|기업\s*소개|회사\s*개요|기업\s*개요|회사\s*안내|우리\s*회사/],
  ['담당업무', /담당\s*업무|주요\s*업무|업무\s*내용|수행\s*업무|하는\s*일|직무\s*내용|업무\s*소개/],
  ['자격요건', /자격\s*요건|지원\s*자격|자격\s*조건|필수\s*(?:요건|자격|조건|사항)|모집\s*요건/],
  ['우대사항', /우대/],
  ['복지', /복지|복리\s*후생|혜택/],
]

type Style = '■' | '[ ]' | '- 목록' | '번호' | '줄글'
const GLYPH = /^[■□▣◆◇●○▶▷★☆▪▫]/
const BRACKET = /^[[【〔〈《<]\s*[^\]】〕〉》>]{1,30}\s*[\]】〕〉》>]/
const DASH = /^[-–—·•*]\s*\S/
const NUMBERED = /^(?:\d{1,2}\s*[.)]|[①-⑳]|\(\d{1,2}\))\s*\S/

/** 공고 글의 첫 표기(처음 나오는 소제목·목록 기호). 목록·번호는 두 줄 이상일 때만 표기로 친다. 없으면 줄글. */
function primaryStyle(text: string): Style {
  const lines = sourceLinesOf(text)
  const dashes = lines.filter((l) => DASH.test(l)).length
  const numbers = lines.filter((l) => NUMBERED.test(l)).length
  for (const l of lines) {
    if (GLYPH.test(l)) return '■'
    if (BRACKET.test(l)) return '[ ]'
    if (NUMBERED.test(l) && numbers >= 2) return '번호'
    if (DASH.test(l) && dashes >= 2) return '- 목록'
  }
  return '줄글'
}

function postingLabel(p: Posting): string {
  return `${str(p.wantedAuthNo)} ${str(p.corpNm)}`.trim()
}

test('P-01 공고 7건의 직무내용(jobCont)이 500자 이상 긴 글, 회사소개·담당업무·자격요건·우대사항·복지 중 4가지 이상, 표기 방식 3가지 이상', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const postings = loadPostings()
  expect(postings, 'data/postings.json 공고 7건').toHaveLength(7)
  const styles: string[] = []
  for (const p of postings) {
    const label = postingLabel(p)
    const text = str(p.jobCont)
    expect([...text].length, `${label}: 직무내용 길이(공백 포함)`).toBeGreaterThanOrEqual(500)
    const found = SECTIONS.filter(([, re]) => re.test(text)).map(([name]) => name)
    expect(found.length, `${label}: 들어 있는 구성(${found.join('·') || '없음'})`).toBeGreaterThanOrEqual(4)
    styles.push(`${label} → ${primaryStyle(text)}`)
  }
  const kinds = new Set(postings.map((p) => primaryStyle(str(p.jobCont))))
  expect(kinds.size, `7건의 표기 방식(■·[ ]·- 목록·번호·줄글)이 3가지 이상 달라야 한다:\n${styles.join('\n')}`).toBeGreaterThanOrEqual(3)
})

const PAY_TYPE_ONLY = /^(?:연봉|월급|시급|일급|주급|건별|기타)$/

test('P-02 7건 중 4건 이상은 임금을 숫자 없이 적었고, 3건 이상은 근무시간 칸이 비었다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const postings = loadPostings()
  expect(postings).toHaveLength(7)
  const pay = postings.map((p) => ({ label: postingLabel(p), text: normalize(str(p.sal)) || normalize(str(p.salTpNm)) }))
  const noDigits = pay.filter((x) => x.text !== '' && !/\d/.test(x.text) && !PAY_TYPE_ONLY.test(x.text))
  expect(noDigits.length, `임금을 숫자 없이 적은 공고(sal): ${pay.map((x) => `${x.label}="${x.text}"`).join(' / ')}`).toBeGreaterThanOrEqual(4)
  const emptyHours = postings.filter((p) => normalize(str(p.workdayWorkhrCont)) === '')
  expect(emptyHours.length, `근무시간 칸(workdayWorkhrCont)이 빈 공고: ${emptyHours.map(postingLabel).join(', ') || '없음'}`).toBeGreaterThanOrEqual(3)
})

for (const key of ['oo', 'commerce', 'data'] as const) {
  test(`P-03 ① 공고 확인: ${COMPANY[key]} 직무내용이 원문 줄(소제목·목록 기호) 그대로 글 블록으로 보이고 형광펜이 문단 안에 있다`, async ({ page }) => {
    const posting = loadPostings().find((p) => str(p.corpNm) === COMPANY[key])
    expect(posting, `data/postings.json 에 ${COMPANY[key]} 공고`).toBeDefined()
    const lines = sourceLinesOf(str(posting?.jobCont))
    expect(lines.length, '직무내용 줄 수').toBeGreaterThan(3)

    const base = await openPrep(page, key)
    if (!(await stepText(page)).includes('공고 확인')) await page.goto(stepUrl(base, 1))
    await expectCurrentStep(page, '공고 확인')
    await expect.poll(() => page.locator('mark').count(), { message: '형광펜(<mark>)' }).toBeGreaterThan(0)

    const block = await postingBlock(page, lines)
    expect(block, '직무내용 글 블록(첫 줄과 끝 줄을 함께 품은 요소)이 화면에 있어야 한다').not.toBeNull()
    const rendered = new Set(block?.lines ?? [])
    expect(lines.filter((l) => !rendered.has(l)), '원문 줄이 화면에서도 한 줄씩 그대로(소제목·목록 기호 포함)').toEqual([])
    const marks = block?.marks ?? []
    if (key === 'oo') expect(marks.length, '직무내용 글 블록 안의 형광펜').toBeGreaterThan(0)
    expect(marks.filter((m) => !m.inline).map((m) => m.text), '형광펜은 문단 안(같은 줄에 다른 글이 붙어 있음)에 있어야 한다').toEqual([])
  })
}

/** 분석 JSON 안의 근거(quote 가 든 객체)와 그 필드 이름 */
function evidences(v: Json, out: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(v)) v.forEach((x) => evidences(x, out))
  else if (isObject(v)) {
    if (typeof v.quote === 'string') out.push(v)
    Object.values(v).forEach((x) => evidences(x, out))
  }
  return out
}

const FIELD_KEYS = ['field', 'source_field', 'posting_field', 'fieldName', 'key'] as const

function resolveField(posting: Posting, path: string): string | null {
  let cur: Json | undefined = posting
  for (const part of path.split('.')) {
    if (!isObject(cur)) return null
    cur = cur[part]
  }
  return typeof cur === 'string' ? cur : null
}

test('P-04 분석 JSON(7건)의 모든 근거 인용이 해당 필드 원문에 글자 그대로 있다', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const postings = loadPostings()
  const dir = repoPath('data/analysis')
  expect(existsSync(dir), 'data/analysis/').toBe(true)
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  const problems: string[] = []
  const covered = new Set<string>()
  let quotes = 0
  for (const f of files) {
    const analysis = readRepoJson(`data/analysis/${f}`)
    const stem = basename(f, '.json')
    const leaves = new Set(stringLeaves(analysis))
    const posting = postings.find((p) => str(p.wantedAuthNo) === stem) ?? postings.find((p) => leaves.has(str(p.wantedAuthNo)))
    if (!posting) {
      problems.push(`${f}: 맞는 공고(wantedAuthNo)가 없다`)
      continue
    }
    covered.add(str(posting.wantedAuthNo))
    for (const ev of evidences(analysis)) {
      quotes += 1
      const quote = str(ev.quote)
      const fieldKey = FIELD_KEYS.find((k) => typeof ev[k] === 'string')
      if (!fieldKey) {
        problems.push(`${f}: 근거 "${quote}"에 필드 이름이 없다(키: ${Object.keys(ev).join(', ')})`)
        continue
      }
      const field = str(ev[fieldKey])
      const original = resolveField(posting, field)
      if (original === null) problems.push(`${f}: 근거 "${quote}"의 필드 "${field}"가 공고에 없다`)
      else if (!original.includes(quote)) problems.push(`${f}: 근거 "${quote}"가 ${field} 원문에 글자 그대로 없다`)
    }
  }
  expect(covered.size, `분석이 있는 공고(7건): ${[...covered].join(', ')}`).toBe(7)
  expect(quotes, '근거 인용 수').toBeGreaterThanOrEqual(7)
  expect(problems).toEqual([])
})

test('P-05 채용정보 상세(S3)도 직무내용이 원문 줄 그대로 글 블록으로 보인다(7건)', async ({ page }) => {
  test.setTimeout(150_000)
  const postings = loadPostings()
  const paths = await jobDetailPaths(page)
  let checked = 0
  for (const path of paths) {
    await page.goto(path)
    const title = await postingTitle(page)
    const posting = postings.find((p) => normalize(str(p.wantedTitle)) === title)
    expect.soft(posting, `상세 "${title}"(${path})에 맞는 공고(wantedTitle)`).toBeDefined()
    if (!posting) continue
    const lines = sourceLinesOf(str(posting.jobCont))
    const block = await postingBlock(page, lines)
    expect.soft(block, `${title}: 직무내용 글 블록`).not.toBeNull()
    const rendered = new Set(block?.lines ?? [])
    expect.soft(lines.filter((l) => !rendered.has(l)), `${title}: 원문 줄이 한 줄씩 그대로(소제목·목록 기호 포함)`).toEqual([])
    checked += 1
  }
  expect(checked, '확인한 상세 화면 수').toBe(7)
})
