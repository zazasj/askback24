/**
 * 공용 도우미. docs/ACCEPTANCE.md 「정확한 문구」와 접근성 이름만으로 화면을 찾는다.
 * 구현 코드를 보지 않고 쓴 독립 시험이라 화면 구조는 역할(role)·이름·글자로만 가정한다.
 * CSS 클래스·data-testid·data-tour는 쓰지 않는다(예외: <mark>, data-active, data-drawn, aria-current, aria-*, role=dialog/status).
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── 정확한 문구 ────────────────────────────────────────────────
export const TITLE_SUFFIX = ' | 고용24 (시연)'
export const BANNER_TEXTS = ['해커톤 시연용 모의 서비스', '실제 고용24가 아닙니다'] as const
export const GOV_TEXTS = ['공식 전자정부 누리집', '누리집입니다'] as const
export const MAIN_MENU = ['채용정보', '취업지원', '실업급여', '직업 능력 개발', '출산휴가·육아휴직'] as const
export const OUT_OF_SCOPE = '시연 범위 밖 메뉴예요'

export const S1_TITLE = '알선/입사지원 내역'
export const S1_URL = /\/mypage\/applications(?:[?#].*)?$/
export const S1_COLUMNS = ['회사명 / 지원공고', '지원일', '열람일', '지원결과', '면접 준비'] as const
export const S2_TITLE = '이력서/자기소개서 관리'
export const S2_SECTIONS = ['기본정보', '희망조건', '학력', '경력', '직업훈련', '프로젝트', '자격·어학', '보유 기술', '자기소개서'] as const
export const S3_TITLE = '채용정보'
export const S3_SECTIONS = ['모집요강', '근무조건', '기업정보'] as const
export const S4_TITLE_TEXT = '면접 역질문 준비'
export const S4_TITLE = /^\s*면접 역질문 준비/
export const ABOUT_TITLE = '이 질문은 어떻게 만들어지나요'
export const NOT_FOUND_TEXT = '페이지를 찾을 수 없어요'
export const MISSING_PATH = '/this-page-does-not-exist'

export const COMPANY = { oo: '(주)OO소프트', commerce: '(주)△△커머스', data: '(주)◇◇데이터' } as const
export type CompanyKey = keyof typeof COMPANY

export const PREP_URL = /\/mypage\/applications\/[^/?#]+\/prep(?:[?#]|$)/
export const PREP_BUTTON = /면접 역질문 준비|최종 면접 준비/

export const MODE_FIRST = '1차·기술 면접'
export const MODE_FINAL = '최종 면접·처우 협의'
export type Mode = typeof MODE_FIRST | typeof MODE_FINAL
export const FIRST_STEPS = ['공고 확인', '내 기대·걱정', '질문 받기'] as const
export const FINAL_STEPS = ['공고 확인', '1차 면접 정리', '최종 질문 받기'] as const
export const LOADING_TEXTS = ['공고 근거 확인', '질문 순서 정하기', 'AI가 문장 쓰는 중'] as const
/** 6차 LD-01: S4 ①에 처음 들어갈 때 공고 분석 로딩(role=status) 제목과 단계 3줄 */
export const POSTING_LOADING_TITLE = 'AI가 분석한 공고를 펼치고 있어요'
export const POSTING_LOADING_STEPS = ['공고 원문 확인', '업무 카드와 맞춰 보기', '확인할 곳 표시'] as const
/** ① 내용이 그려졌다는 표시(F-04 상자 제목 · S4 ① 소제목) */
const POSTING_READY_TEXT = 'AI 분석 요약'
const POSTING_READY_HEADING = 'AI가 찾은 확인할 점'
/** 6차 RS-01: 질문마다 남는 펼침 */
export const WHY_TEXT = '왜 이 질문인가요'
/** 6차 TR: 안내(스포트라이트) 설명 상자의 단계 표시 "N/M" */
export const TOUR_STEP_RE = /(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/

export const CHOICES = ['기대돼요', '걱정돼요', '모르겠어요'] as const
export const FIRST_TYPES = ['차이 확인', '기회 확인', '깊이 확인', '미리 확인', '탐색'] as const
export const FINAL_TYPES = ['다시 확인', '신호 확인', '범위 확인', '처우 확인', '기회 확인'] as const
/** S4-13·S4-17: 예시 구직자 A × (주)OO소프트 1차 질문 유형 순서 */
export const FIRST_ORDER_A_OO = ['차이 확인', '차이 확인', '기회 확인', '기회 확인', '깊이 확인']

export const PRESET_A = {
  expect: ['신규 API 개발', '서비스 구조 설계', 'DB 테이블 설계'],
  worry: ['기존 시스템 유지보수', '고객사 상주 개발', '배치·정산 프로그램', '화면 개발 겸업'],
  unknown: ['장애 대응·온콜', 'SQL 작성·쿼리 개선', '외부 시스템 연동', '배포·서버 운영', '데이터 이전·시스템 전환', '테스트·품질 검증', '요구사항 협의', '개발 문서·산출물 작성', '보안 점검·취약점 조치', '혼자 맡는 백엔드'],
  experience: '직업훈련 팀 프로젝트에서 FastAPI로 API를 설계부터 배포까지 맡아 본 경험이 있습니다.',
} as const

export const NOT_ASKED_REASONS = ['시간이 없었어요', '분위기가 아니었어요', '잊어버렸어요', '질문할 기회가 없었어요', '회사가 먼저 설명해 줬어요'] as const
export const MOODS = ['편했어요', '보통이었어요', '압박이 있었어요'] as const
/** R-04 「1차 면접 다녀온 것으로 채우기」가 넣는 들은 답 */
export const R04_ANSWERS = {
  onsite: '프로젝트마다 달라서요',
  maintenance: '유지보수가 7할쯤 되고 신규는 프로젝트 들어갈 때만요',
  design: '설계 리뷰에 신입도 들어가고 작은 기능은 직접 설계해요',
  newApi: '수습 끝나면 작은 API부터 맡겨요',
} as const

/** S4-11: 김00 이력서의 경험 칩(칩 글자 label → 입력칸에 들어갈 경험 문장 text). 정본은 data/persona.json. */
export function resumeChips(): ReadonlyArray<{ label: string; text: string }> {
  const persona = JSON.parse(readFileSync(join(REPO_ROOT, 'data', 'persona.json'), 'utf8')) as {
    experience_chips?: Array<{ label: string; text: string }>
  }
  return persona.experience_chips ?? []
}

// ── 작은 도구 ──────────────────────────────────────────────────
export const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim()
export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const stepUrl = (base: string, step: 1 | 2 | 3, extra = ''): string => `${base}?step=${step}${extra}`
export const STEP_RE = (n: 1 | 2 | 3): RegExp => new RegExp(`[?&]step=${n}(?:&|#|$)`)

async function isShown(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false)
}

export async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText)
}

export function heading(page: Page, name: string | RegExp, exact = true): Locator {
  return typeof name === 'string'
    ? page.getByRole('heading', { name, exact }).first()
    : page.getByRole('heading', { name }).first()
}

export function toast(page: Page, text: string): Locator {
  return page.getByRole('status').filter({ hasText: text }).first()
}

export function acceptDialogs(page: Page): void {
  page.on('dialog', (d) => {
    void d.accept()
  })
}

/** 라디오 묶음: role=radiogroup 이나 fieldset(role=group) 둘 다 받는다. */
export function namedGroup(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('radiogroup', { name }).or(scope.getByRole('group', { name })).first()
}

/** 라디오는 보이는 글자를 누른다(입력칸이 시각적으로 숨겨진 칩 모양이어도 동작). */
export async function pickRadio(scope: Locator, label: string): Promise<void> {
  await scope.getByText(label, { exact: true }).filter({ visible: true }).first().click()
}

// ── S1 지원 내역 ───────────────────────────────────────────────
export async function gotoApplications(page: Page): Promise<void> {
  await page.goto('/mypage/applications')
  await expect(heading(page, S1_TITLE)).toBeVisible()
}

/** 지원 내역 한 건(데스크톱은 표의 행, 휴대폰은 카드). 면접 준비 버튼을 가진 가장 안쪽 묶음. */
export function applicationEntries(page: Page): Locator {
  const btn = page.getByRole('button', { name: PREP_BUTTON })
  const box = page.getByRole('row').or(page.getByRole('listitem')).or(page.getByRole('article'))
  return box.filter({ has: btn }).filter({ hasNot: box.filter({ has: btn }) })
}

/** 데스크톱 표의 데이터 행(머리 행 제외). */
export function dataRows(page: Page): Locator {
  return page.getByRole('table').first().getByRole('row').filter({ has: page.getByRole('cell') })
}

export function rowCells(row: Locator): Locator {
  return row.getByRole('cell').or(row.getByRole('rowheader'))
}

export async function columnIndex(page: Page, header: string): Promise<number> {
  const headers = (await page.getByRole('table').first().getByRole('columnheader').allInnerTexts()).map(normalize)
  const i = headers.findIndex((h) => h.includes(header))
  if (i < 0) throw new Error(`열 "${header}"를 찾지 못했다: ${headers.join(' | ')}`)
  return i
}

/** 휴대폰 지원 내역 카드의 칸 이름(S1 열 이름 중 표가 아니어도 카드에 보이는 것). */
export const ENTRY_FIELDS = ['지원일', '열람일', '지원결과', '면접 준비'] as const
export type EntryField = (typeof ENTRY_FIELDS)[number]

/**
 * 지원 내역 한 건에서 회사명을 뗀 채용제목.
 * 데스크톱은 표 「회사명 / 지원공고」 칸, 휴대폰은 카드 글에서 회사명 줄과 칸(지원일·열람일·지원결과·면접 준비)을 뺀 첫 줄.
 */
export async function applicationPostingTitle(page: Page, key: CompanyKey): Promise<string> {
  if (await isShown(page.getByRole('table').first())) {
    const col = await columnIndex(page, '회사명 / 지원공고')
    const row = dataRows(page).filter({ hasText: COMPANY[key] }).first()
    const cell = normalize(await rowCells(row).nth(col).innerText())
    return normalize(cell.replace(COMPANY[key], '')).replace(/^[/·|\-\s]+/, '')
  }
  const entry = applicationEntries(page).filter({ hasText: COMPANY[key] }).first()
  await expect(entry, `${COMPANY[key]} 지원 건`).toBeVisible()
  const lines = (await entry.innerText()).split('\n').map(normalize).filter(Boolean)
  const end = lines.findIndex((l) => ENTRY_FIELDS.some((f) => l.startsWith(f)))
  const head = (end < 0 ? lines : lines.slice(0, end))
    .map((l) => normalize(l.replace(COMPANY[key], '')).replace(/^[/·|\-\s]+/, ''))
    .filter(Boolean)
  if (!head[0]) throw new Error(`${COMPANY[key]} 카드에서 채용제목을 찾지 못했다: ${lines.join(' | ')}`)
  return head[0]
}

/** 지원 내역 카드(휴대폰)의 칸 값. 칸 이름 뒤부터 다음 칸 이름 전까지(예: "지원일" → "2026.10.14"). */
export async function entryField(entry: Locator, label: EntryField): Promise<string> {
  const text = normalize(await entry.innerText())
  const others = ENTRY_FIELDS.filter((f) => f !== label).map(escapeRe).join('|')
  const m = new RegExp(`${escapeRe(label)}\\s*(.*?)\\s*(?=${others}|$)`).exec(text)
  if (!m) throw new Error(`"${label}" 칸을 찾지 못했다: ${text}`)
  return m[1] ?? ''
}

/**
 * 6차 LD-01·02: 지원 건마다 처음 ①에 들어가면 공고 분석 로딩(최대 2.5초)이 ① 내용보다 먼저 나온다.
 * ① 내용("AI 분석 요약" 또는 "AI가 찾은 확인할 점")이 보이고 로딩 제목이 사라질 때까지 기다린다(확인 내용은 그대로).
 */
export async function waitPostingReady(page: Page, timeout = 10_000): Promise<void> {
  const ready = page
    .getByText(POSTING_READY_TEXT, { exact: true })
    .or(page.getByRole('heading', { name: POSTING_READY_HEADING }))
    .filter({ visible: true })
    .first()
  await expect(ready, '① 내용(공고 분석 로딩이 끝난 뒤)').toBeVisible({ timeout })
  await expect(page.getByText(POSTING_LOADING_TITLE).filter({ visible: true }), '① 공고 분석 로딩이 끝나야 한다').toHaveCount(0, { timeout })
}

/** S1에서 해당 회사의 면접 준비 버튼을 눌러 S4로 간다. ①로 열리면 로딩이 끝날 때까지 기다린다. 반환값은 S4 주소의 경로(쿼리 제외). */
export async function openPrep(page: Page, key: CompanyKey): Promise<string> {
  await gotoApplications(page)
  const entry = applicationEntries(page).filter({ hasText: COMPANY[key] }).first()
  await entry.getByRole('button', { name: PREP_BUTTON }).click()
  await page.waitForURL(PREP_URL)
  await expect(heading(page, S4_TITLE)).toBeVisible()
  if (STEP_RE(1).test(page.url())) await waitPostingReady(page)
  return new URL(page.url()).pathname
}

// ── S4 머리·단계 ───────────────────────────────────────────────
export function modeGroup(page: Page): Locator {
  return namedGroup(page, '준비할 면접')
}

export function modeRadio(page: Page, label: Mode): Locator {
  return modeGroup(page).getByRole('radio', { name: label })
}

export function currentStep(page: Page): Locator {
  return page.locator('[aria-current="step"]')
}

/** 단계 표시 목록(aria-current="step" 항목을 가진 가장 안쪽 목록). */
export function stepList(page: Page): Locator {
  return page.getByRole('list').filter({ has: currentStep(page) }).last()
}

export async function stepText(page: Page): Promise<string> {
  return normalize(await currentStep(page).first().innerText())
}

/** 현재 단계 확인. ① "공고 확인"이면 공고 분석 로딩(LD-01)이 끝나 ① 내용이 보일 때까지 기다린다. */
export async function expectCurrentStep(page: Page, name: string): Promise<void> {
  await expect(currentStep(page)).toHaveCount(1)
  await expect(currentStep(page)).toContainText(name)
  if (name === '공고 확인') await waitPostingReady(page)
}

export async function switchMode(page: Page, label: Mode): Promise<void> {
  await pickRadio(modeGroup(page), label)
  await expect(modeRadio(page, label)).toBeChecked()
  await expect(stepList(page)).toContainText(label === MODE_FIRST ? '내 기대·걱정' : '1차 면접 정리')
}

/** 1차 흐름 ② 「내 기대·걱정」 단계로 간다. */
export async function goToCardsStep(page: Page, base: string, apiFail = false): Promise<void> {
  if (apiFail) {
    await page.goto(stepUrl(base, 2, '&apiFail=1'))
  } else {
    const cur = await stepText(page)
    if (cur.includes('공고 확인')) await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
    else if (!cur.includes('내 기대·걱정')) await page.goto(stepUrl(base, 2))
  }
  await expectCurrentStep(page, '내 기대·걱정')
}

/** 최종 흐름 「1차 면접 정리」 단계로 간다. */
export async function goToReviewStep(page: Page): Promise<void> {
  await expect(modeRadio(page, MODE_FINAL)).toBeChecked()
  if ((await stepText(page)).includes('공고 확인')) await page.getByRole('button', { name: '1차 면접 정리하기' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
}

// ── S4 ② 카드 ─────────────────────────────────────────────────
/** 카드 radiogroup 전부(「준비할 면접」 묶음은 제외 — "기대돼요" 라디오가 있는 묶음만). */
export function cardGroups(page: Page): Locator {
  return page.getByRole('radiogroup').filter({ has: page.getByRole('radio', { name: '기대돼요' }) })
}

export function cardGroup(page: Page, cardName: string): Locator {
  return page.getByRole('radiogroup', { name: cardName, exact: true })
}

export function experienceInput(page: Page): Locator {
  return page.getByRole('textbox', { name: '경험 한 줄' })
}

export function makeQuestionsButton(page: Page): Locator {
  return page.getByRole('button', { name: '질문 만들기', exact: true })
}

export async function showAllCards(page: Page): Promise<void> {
  const more = page.getByRole('button', { name: '5개 더 보기' })
  if (await isShown(more)) await more.click()
}

// ── 시연 도구 ──────────────────────────────────────────────────
export function demoToolsButton(page: Page): Locator {
  return page.getByRole('button', { name: '시연 도구', exact: true })
}

export function demoItem(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true }).or(page.getByRole('menuitem', { name, exact: true })).first()
}

export async function demoAction(page: Page, name: string): Promise<void> {
  const toggle = demoToolsButton(page)
  await toggle.click()
  const item = demoItem(page, name)
  await item.click()
  // 도구 상자가 열린 채 남아 다음 동작을 가리지 않게 닫는다(Esc → 그래도 열려 있으면 토글).
  const settle = () => item.waitFor({ state: 'hidden', timeout: 1_000 }).catch(() => undefined)
  await settle()
  if (await isShown(item)) {
    await page.keyboard.press('Escape')
    await settle()
  }
  if (await isShown(item)) {
    const expanded = await toggle.getAttribute('aria-expanded', { timeout: 1_000 }).catch(() => null)
    if (expanded !== 'false') {
      await toggle.click({ timeout: 3_000 }).catch(() => undefined)
      await settle()
    }
  }
}

export async function fillPresetA(page: Page): Promise<void> {
  await demoAction(page, '예시 구직자 A로 채우기')
  await expect(experienceInput(page)).not.toHaveValue('')
}

// ── S4 ③ 질문 ─────────────────────────────────────────────────
/**
 * 질문 하나(「왜 이 질문인가요」 펼침을 가진 가장 안쪽 목록 항목이나 article).
 * 6차 RS-01로 질문마다 있던 「복사」 버튼이 없어져, 질문마다 남는 펼침으로 찾는다("더 알아볼 질문"에는 펼침이 없다).
 */
export function questionItems(page: Page): Locator {
  const why = page.getByText(WHY_TEXT)
  const box = page.getByRole('listitem').or(page.getByRole('article'))
  return box.filter({ has: why }).filter({ hasNot: box.filter({ has: why }) })
}

export async function waitFirstResults(page: Page): Promise<void> {
  await expect(page).toHaveURL(STEP_RE(3))
  await expect(heading(page, '1차·기술 면접 질문', false)).toBeVisible({ timeout: 15_000 })
  await expect(questionItems(page).first()).toBeVisible({ timeout: 15_000 })
}

export async function waitFinalResults(page: Page): Promise<void> {
  await expect(heading(page, '최종 면접·처우 질문', false)).toBeVisible({ timeout: 15_000 })
  await expect(questionItems(page).first()).toBeVisible({ timeout: 15_000 })
}

/** 회사 + 예시 구직자 A로 1차 질문을 만든다(③까지). 반환값은 S4 경로. */
export async function makeFirstQuestions(page: Page, key: CompanyKey = 'oo', opts: { apiFail?: boolean } = {}): Promise<string> {
  const base = await openPrep(page, key)
  if (key === 'commerce') await switchMode(page, MODE_FIRST)
  await goToCardsStep(page, base, opts.apiFail ?? false)
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  return base
}

export async function fillReviewR04(page: Page): Promise<void> {
  await demoAction(page, '1차 면접 다녀온 것으로 채우기')
  await expect(page.getByRole('button', { name: '최종 질문 만들기', exact: true })).toBeEnabled()
}

/** 예시 A × (주)OO소프트 1차 결과 → 면접 다녀왔어요 → R-04 채우기 → 최종 질문 받기. */
export async function makeFinalQuestions(page: Page): Promise<string> {
  const base = await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
  return base
}

/** 질문마다 보이는 유형 칩. 칩이 없거나 둘 이상이면 그대로 드러나게 적는다. */
export async function itemTypes(items: Locator, labels: readonly string[]): Promise<string[]> {
  const n = await items.count()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const found: string[] = []
    for (const label of labels) {
      if ((await items.nth(i).getByText(label, { exact: true }).filter({ visible: true }).count()) > 0) found.push(label)
    }
    out.push(found.join('+') || '(칩 없음)')
  }
  return out
}

export async function itemTexts(items: Locator): Promise<string[]> {
  return (await items.allInnerTexts()).map(normalize)
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}

/** 질문 항목 안에서 문장이 아닌 짧은 꼬리표 줄 */
const ITEM_TAGS = new Set<string>([...FIRST_TYPES, ...FINAL_TYPES, '경험 포함', '검수 문장', '근거 보기', '공고에 없음'])

/**
 * 질문 문장. RS-06대로 문장은 「왜 이 질문인가요」 바로 위에 있으므로, 펼침 줄 앞의 줄 가운데 꼬리표가 아닌 가장 긴 줄을 문장으로 읽는다
 * (펼친 내용은 펼침 줄 뒤라 섞이지 않는다).
 */
export async function questionSentence(item: Locator): Promise<string> {
  const lines = (await item.innerText()).split('\n').map(normalize).filter(Boolean)
  const end = lines.findIndex((l) => l.includes(WHY_TEXT))
  const head = (end >= 0 ? lines.slice(0, end) : lines).filter((l) => !ITEM_TAGS.has(l))
  const sentence = [...head].sort((a, b) => b.length - a.length)[0]
  if (!sentence) throw new Error(`질문 문장을 찾지 못했다: ${lines.join(' | ')}`)
  return sentence
}

/**
 * 예전 이름(질문마다 「복사」를 눌러 문장을 읽던 도우미). 6차 RS-01로 질문마다의 복사 버튼이 없어져
 * 같은 이름을 쓰던 시험이 화면의 질문 문장을 읽게 한다. 클립보드는 쓰지 않는다.
 */
export async function copyQuestion(_page: Page, item: Locator): Promise<string> {
  return questionSentence(item)
}

export async function questionSentences(page: Page): Promise<string[]> {
  const items = questionItems(page)
  const n = await items.count()
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(normalize(await questionSentence(items.nth(i))))
  return out
}

// ── 1차 면접 정리 ──────────────────────────────────────────────
/** 정리할 질문 하나(「물어봤어요」 라디오를 가진 가장 안쪽 목록 항목이나 article). */
export function reviewItems(page: Page): Locator {
  const asked = page.getByRole('radio', { name: '물어봤어요', exact: true })
  const box = page.getByRole('listitem').or(page.getByRole('article'))
  return box.filter({ has: asked }).filter({ hasNot: box.filter({ has: asked }) })
}

/** 선택 상자의 실제 선택지(빈 값·비활성 자리표시 제외). 기본 select가 아니면 펼쳐서 option을 읽는다. */
export async function optionLabels(page: Page, select: Locator): Promise<string[]> {
  const native = await select.evaluate((el) =>
    el instanceof HTMLSelectElement
      ? Array.from(el.options)
          .filter((o) => o.value !== '' && !o.disabled)
          .map((o) => o.text.trim())
      : null,
  )
  if (native) return native
  await select.click()
  const labels = (await page.getByRole('option').allInnerTexts()).map(normalize)
  await page.keyboard.press('Escape')
  return labels
}

export async function selectedLabel(select: Locator): Promise<string> {
  return select.evaluate((el) =>
    el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? '').trim() : (el.textContent ?? '').trim(),
  )
}

/** 요약 "확인됨 2" 같은 글에서 라벨 뒤(없으면 앞)의 개수를 읽는다. */
export function countNear(text: string, label: string): number | null {
  const after = new RegExp(`${escapeRe(label)}\\s*[:：·]?\\s*(\\d+)`).exec(text)
  if (after) return Number(after[1])
  const before = new RegExp(`(\\d+)\\s*개?\\s*${escapeRe(label)}`).exec(text)
  return before ? Number(before[1]) : null
}

// ── S2·S3 ─────────────────────────────────────────────────────
/** 제목들 사이의 글(문서 순서대로 다음 제목 전까지). names 순서대로 돌려준다. */
export async function sectionTexts(page: Page, names: readonly string[]): Promise<string[]> {
  const handles: Awaited<ReturnType<Locator['elementHandle']>>[] = []
  for (const name of names) handles.push(await page.getByRole('heading', { name, exact: true }).first().elementHandle())
  return page.evaluate((els) => {
    const order = els
      .map((_el, i) => i)
      .sort((a, b) => (els[a]!.compareDocumentPosition(els[b]!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    const texts = new Array<string>(els.length).fill('')
    order.forEach((idx, k) => {
      const range = document.createRange()
      range.setStartAfter(els[idx]!)
      const next = order[k + 1]
      if (next !== undefined) range.setEndBefore(els[next]!)
      else range.setEndAfter(document.body.lastChild ?? document.body)
      texts[idx] = range.toString()
    })
    return texts
  }, handles)
}

/** 제목 바로 뒤(문서 순서)에 오는 첫 목록. */
export async function listAfterHeading(page: Page, name: string): Promise<Locator> {
  const h = page.getByRole('heading', { name }).first()
  await expect(h).toBeVisible()
  const handle = await h.elementHandle()
  const lists = page.getByRole('list')
  const n = await lists.count()
  for (let i = 0; i < n; i++) {
    const after = await lists
      .nth(i)
      .evaluate((el, head) => head !== null && !head.contains(el) && (head.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, handle)
    if (after) return lists.nth(i)
  }
  throw new Error(`"${name}" 제목 뒤에 목록이 없다`)
}

/** /jobs 의 상세 링크 경로(/jobs/:id) 목록. */
export async function jobDetailPaths(page: Page): Promise<string[]> {
  await page.goto('/jobs')
  await expect(heading(page, S3_TITLE)).toBeVisible()
  const read = async (): Promise<string[]> => {
    const hrefs = await page.getByRole('link').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href || ''))
    const paths = hrefs
      .map((h) => {
        try {
          return new URL(h).pathname
        } catch {
          return ''
        }
      })
      .filter((p) => /^\/jobs\/[^/]+$/.test(p))
    return [...new Set(paths)]
  }
  await expect.poll(async () => (await read()).length, { message: '/jobs 에 상세(/jobs/:id) 링크가 없다' }).toBeGreaterThan(0)
  return read()
}

const NON_TITLE_HEADINGS = new Set<string>(['고용24', S3_TITLE, ...S3_SECTIONS])

/** 상세 화면의 채용제목(구역 제목이 아닌 첫 제목, 끝의 "모의 공고" 배지 글자는 뗀다). */
export async function postingTitle(page: Page): Promise<string> {
  await expect(heading(page, '모집요강')).toBeVisible()
  const texts = (await page.getByRole('heading').allInnerTexts())
    .map((t) => normalize(t).replace(/\s*모의 공고$/, ''))
    .filter((t) => t !== '' && !NON_TITLE_HEADINGS.has(t))
  if (!texts[0]) throw new Error('상세 화면에서 채용제목 제목을 찾지 못했다')
  return texts[0]
}

export function applyButton(page: Page): Locator {
  return page.getByRole('button', { name: '입사지원', exact: true })
}

/** 아직 지원 안 한 공고 상세로 가서 그 경로와 채용제목을 돌려준다. */
export async function findUnappliedPosting(page: Page): Promise<{ path: string; title: string }> {
  for (const p of await jobDetailPaths(page)) {
    await page.goto(p)
    await expect(heading(page, '모집요강')).toBeVisible()
    if ((await applyButton(page).count()) > 0 && (await applyButton(page).first().isEnabled())) {
      return { path: p, title: await postingTitle(page) }
    }
  }
  throw new Error('"입사지원" 버튼이 살아 있는 공고가 없다')
}

/** 지원 안 한 공고 하나에 입사지원한다. */
export async function applyToPosting(page: Page): Promise<{ path: string; title: string }> {
  const found = await findUnappliedPosting(page)
  await applyButton(page).first().click()
  const dialog = page.getByRole('dialog', { name: '입사지원' })
  await dialog.getByRole('button', { name: '지원하기', exact: true }).click()
  await expect(toast(page, '지원했어요')).toBeVisible()
  return found
}

// ── 브라우저 장치 ──────────────────────────────────────────────
/** window.print 를 가짜로 바꿔 호출 수를 센다(페이지를 열기 전에 부른다). */
export async function installPrintSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __printCalls: number }
    w.__printCalls = 0
    window.print = () => {
      w.__printCalls += 1
    }
  })
}

export async function printCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __printCalls?: number }).__printCalls ?? 0)
}

// ── 처음 온 사람 안내(6차 TR) ─────────────────────────────────
/** 안내(스포트라이트) 설명 상자: role=dialog 이고 단계 "N/M"과 안내 버튼(이전·다음·건너뛰기·시작하기·닫기)을 가진 것 */
export function tourDialog(page: Page): Locator {
  return page
    .getByRole('dialog')
    .filter({ hasText: TOUR_STEP_RE })
    .filter({ has: page.getByRole('button', { name: /^(?:이전|다음|건너뛰기|시작하기|닫기)$/ }) })
}

/**
 * localStorage 에 손대면 예외가 나게 한다(G-13, 페이지를 열기 전에 부른다).
 * 시험 스위치(rq:test:tour-off, TR-09)도 저장소에 있어 막힌 저장소에서는 읽히지 않는다 → 안내가 뜨면 건너뛰고 흐름을 잇는다.
 */
export async function blockStorage(page: Page): Promise<void> {
  await page.addLocatorHandler(tourDialog(page), async (dialog) => {
    const skip = dialog.getByRole('button', { name: '건너뛰기', exact: true })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    else await page.keyboard.press('Escape')
  })
  await page.addInitScript(() => {
    const fail = (): never => {
      throw new DOMException('시험: 저장소가 막혀 있어요', 'SecurityError')
    }
    try {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: fail })
    } catch {
      // 정의를 못 바꾸는 브라우저면 아래 메서드 차단만 쓴다.
    }
    for (const key of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
      try {
        Object.defineProperty(Storage.prototype, key, { configurable: true, value: fail })
      } catch {
        // 위와 같음
      }
    }
  })
}

export async function localStorageDump(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k !== null) out.push(`${k}=${localStorage.getItem(k) ?? ''}`)
    }
    return out.join('\n')
  })
}

// ── 화면 전체 검사 ─────────────────────────────────────────────
export function trackPageErrors(page: Page, consoleErrors = true): string[] {
  const errors: string[] = []
  if (consoleErrors) {
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[console.error] ${m.text()} @ ${page.url()}`)
    })
  }
  page.on('pageerror', (e) => errors.push(`[처리 안 된 예외] ${e.message} @ ${page.url()}`))
  return errors
}

export async function seriousAxeViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).analyze()
  return result.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}(${v.impact}) ${v.help} → ${v.nodes.slice(0, 5).map((n) => n.target.join(' ')).join(', ')}`)
}

export async function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
}

/** 실제 개인정보 모양: @example.com 이 아닌 이메일, 010-0000-0000 이 아닌 전화번호. */
export async function piiProblems(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => `${document.body.innerText}\n${document.body.textContent ?? ''}`)
  const problems = new Set<string>()
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    if (!m[0].toLowerCase().endsWith('@example.com')) problems.add(`이메일 ${m[0]}`)
  }
  for (const m of text.matchAll(/(?<!\d)0\d{1,2}[-.\s)]\s?\d{3,4}[-.\s]\d{4}(?!\d)/g)) {
    if (m[0] !== '010-0000-0000') problems.add(`전화 ${m[0]}`)
  }
  for (const m of text.matchAll(/(?<!\d)01[016789]\d{7,8}(?!\d)/g)) problems.add(`전화 ${m[0]}`)
  return [...problems]
}

export async function govTextFound(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.body.textContent ?? '')
  return GOV_TEXTS.filter((t) => text.includes(t))
}

// ── 모든 화면 돌기 ─────────────────────────────────────────────
export const SCREENS = [
  's1-applications',
  's2-resume',
  's3-jobs',
  's3-job-detail',
  'about-ai',
  'not-found',
  's4-first-1',
  's4-first-2',
  's4-first-3',
  's4-final-2-review',
  's4-final-3',
  's4-final-1',
] as const
export type ScreenName = (typeof SCREENS)[number]

/** 화면 이름 → 화면 제목(G-06). 상세는 채용제목이라 따로 구한다. */
export const SCREEN_TITLES: Record<Exclude<ScreenName, 's3-job-detail'>, string> = {
  's1-applications': S1_TITLE,
  's2-resume': S2_TITLE,
  's3-jobs': S3_TITLE,
  'about-ai': ABOUT_TITLE,
  'not-found': NOT_FOUND_TEXT,
  's4-first-1': S4_TITLE_TEXT,
  's4-first-2': S4_TITLE_TEXT,
  's4-first-3': S4_TITLE_TEXT,
  's4-final-2-review': S4_TITLE_TEXT,
  's4-final-3': S4_TITLE_TEXT,
  's4-final-1': S4_TITLE_TEXT,
}

/**
 * 모든 경로(S1, S2, S3 목록·상세, /about-ai, 404, S4 1차 ①②③, 최종 ①②③)를 차례로 열고
 * 화면마다 visit 를 부른다. S4 ③과 최종 ③은 예시 구직자 A·R-04 예시로 채운 결과.
 */
export async function tourScreens(page: Page, visit: (name: ScreenName) => Promise<void>): Promise<void> {
  await gotoApplications(page)
  await visit('s1-applications')

  await page.goto('/mypage/resume')
  await expect(heading(page, S2_TITLE)).toBeVisible()
  await visit('s2-resume')

  const details = await jobDetailPaths(page)
  await visit('s3-jobs')

  await page.goto(details[0] ?? '/jobs')
  await expect(heading(page, '모집요강')).toBeVisible()
  await visit('s3-job-detail')

  await page.goto('/about-ai')
  await expect(heading(page, ABOUT_TITLE)).toBeVisible()
  await visit('about-ai')

  await page.goto(MISSING_PATH)
  await expect(page.getByText(NOT_FOUND_TEXT).first()).toBeVisible()
  await visit('not-found')

  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  await visit('s4-first-1')

  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expectCurrentStep(page, '내 기대·걱정')
  await visit('s4-first-2')

  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await visit('s4-first-3')

  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await visit('s4-final-2-review')

  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
  await visit('s4-final-3')

  const base = await openPrep(page, 'commerce')
  if (!(await stepText(page)).includes('공고 확인')) await page.goto(stepUrl(base, 1))
  await expectCurrentStep(page, '공고 확인')
  await visit('s4-final-1')
}
