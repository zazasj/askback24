/**
 * S4 — 면접 역질문 준비(1차·기술 면접)와 R — 1차 면접 정리 → 최종 면접 질문.
 * ACCEPTANCE.md 「S4」「R」. 시험 환경은 가짜 응답 모드(vite build --mode mock).
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  CHOICES,
  COMPANY,
  FINAL_STEPS,
  FINAL_TYPES,
  FIRST_ORDER_A_OO,
  FIRST_STEPS,
  FIRST_TYPES,
  LOADING_TEXTS,
  MODE_FINAL,
  MODE_FIRST,
  MOODS,
  NOT_ASKED_REASONS,
  PREP_BUTTON,
  PRESET_A,
  R04_ANSWERS,
  S4_TITLE,
  STEP_RE,
  acceptDialogs,
  applicationEntries,
  applicationPostingTitle,
  bodyText,
  cardGroup,
  cardGroups,
  copyQuestion,
  countNear,
  currentStep,
  demoAction,
  expectCurrentStep,
  experienceInput,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  goToReviewStep,
  gotoApplications,
  heading,
  installPrintSpy,
  itemTexts,
  itemTypes,
  listAfterHeading,
  localStorageDump,
  makeFinalQuestions,
  makeFirstQuestions,
  makeQuestionsButton,
  modeGroup,
  modeRadio,
  normalize,
  openPrep,
  optionLabels,
  pickRadio,
  printCalls,
  questionItems,
  questionSentences,
  readClipboard,
  resumeChips,
  reviewItems,
  selectedLabel,
  showAllCards,
  stepList,
  stepText,
  stepUrl,
  switchMode,
  toast,
  waitFirstResults,
} from './helpers'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })
test.describe.configure({ timeout: 90_000 })

const SOURCE_BADGE = /^(실제|모의)$/
const PAY_WORDS = /연봉|수당|처우|근무\s*시간[^.?]*협의/
const QUOTE_WORDS = /아까|하셨는데|말씀하신/

async function expectLoadingShown(page: Page) {
  for (const t of LOADING_TEXTS) await expect(page.getByText(t).first(), `만드는 중 "${t}"`).toBeVisible()
}

async function expectPresetA(page: Page) {
  await showAllCards(page)
  for (const card of PRESET_A.expect) await expect(cardGroup(page, card).getByRole('radio', { name: '기대돼요' }), card).toBeChecked()
  for (const card of PRESET_A.worry) await expect(cardGroup(page, card).getByRole('radio', { name: '걱정돼요' }), card).toBeChecked()
  for (const card of PRESET_A.unknown) await expect(cardGroup(page, card).getByRole('radio', { name: '모르겠어요' }), card).toBeChecked()
  await expect(experienceInput(page)).toHaveValue(PRESET_A.experience)
}

// ── S4 머리·단계 ───────────────────────────────────────────────

test('S4-01 제목 "면접 역질문 준비"와 라벨 "AI", 머리 요약에 회사명·채용제목·지원결과', async ({ page }) => {
  await gotoApplications(page)
  const posting = await applicationPostingTitle(page, 'oo')
  expect(posting, 'S1에서 읽은 채용제목').not.toBe('')
  await applicationEntries(page).filter({ hasText: COMPANY.oo }).first().getByRole('button', { name: PREP_BUTTON }).click()
  await expect(heading(page, S4_TITLE)).toBeVisible()
  await expect(page.getByText('AI', { exact: true }).first(), '라벨 "AI"').toBeVisible()
  await expect(page.getByText(COMPANY.oo).first()).toBeVisible()
  await expect(page.getByText('서류합격').first()).toBeVisible()
  await expect(page.getByText(posting).first(), `채용제목 "${posting}"`).toBeVisible()
})

test('S4-02 단계 표시 3개, 현재 단계 aria-current="step", 주소 ?step= 과 맞고 뒤로 가기로 이전 단계', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await expect(page).toHaveURL(STEP_RE(1))
  const steps = stepList(page)
  await expect(steps.getByRole('listitem')).toHaveCount(3)
  for (const s of FIRST_STEPS) await expect(steps).toContainText(s)
  await expectCurrentStep(page, '공고 확인')

  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expect(page).toHaveURL(STEP_RE(2))
  await expectCurrentStep(page, '내 기대·걱정')

  await page.goBack()
  await expect(page).toHaveURL(STEP_RE(1))
  await expectCurrentStep(page, '공고 확인')

  await page.goto(stepUrl(base, 2))
  await expectCurrentStep(page, '내 기대·걱정')
})

// ── S4 ① 공고 확인 ────────────────────────────────────────────

test('S4-03 ① (주)OO소프트 공고에 <mark> 3개 이상, "기타 업무 지원"·"고객사 상주 가능자" 포함', async ({ page }) => {
  await openPrep(page, 'oo')
  const marks = page.locator('mark')
  await expect.poll(() => marks.count(), { message: '<mark> 개수' }).toBeGreaterThanOrEqual(3)
  await expect(marks.filter({ hasText: '기타 업무 지원' }).first()).toBeVisible()
  await expect(marks.filter({ hasText: '고객사 상주 가능자' }).first()).toBeVisible()
})

test('S4-04 ① "기타 업무 지원" 형광펜을 누르면 "기존 시스템 유지보수" 설명이 뜨고 Esc·바깥 클릭으로 닫힌다', async ({ page }) => {
  await openPrep(page, 'oo')
  const mark = page.locator('mark').filter({ hasText: '기타 업무 지원' }).first()
  await expect(mark).toBeVisible()
  const explained = page.getByText('기존 시스템 유지보수').filter({ visible: true })
  const before = await explained.count()

  await mark.click()
  await expect.poll(() => explained.count(), { message: '누르면 설명이 떠야 한다' }).toBeGreaterThan(before)
  await page.keyboard.press('Escape')
  await expect.poll(() => explained.count(), { message: 'Esc로 닫혀야 한다' }).toBe(before)

  await mark.click()
  await expect.poll(() => explained.count(), { message: '다시 누르면 다시 떠야 한다' }).toBeGreaterThan(before)
  await heading(page, S4_TITLE).click()
  await expect.poll(() => explained.count(), { message: '바깥 클릭으로 닫혀야 한다' }).toBe(before)
})

test('S4-05 ① "AI가 찾은 확인할 점" 항목이 3개 이상', async ({ page }) => {
  await openPrep(page, 'oo')
  const list = await listAfterHeading(page, 'AI가 찾은 확인할 점')
  expect(await list.getByRole('listitem').count()).toBeGreaterThanOrEqual(3)
})

test('S4-06 ① 회사 신호마다 출처 배지("실제" 또는 "모의")가 있다', async ({ page }) => {
  await openPrep(page, 'oo')
  const badge = page.getByText(SOURCE_BADGE)
  await expect(badge.first(), '출처 배지').toBeVisible()
  const badgeLists = page.getByRole('list').filter({ has: badge })
  const signalLists = badgeLists.filter({ hasNot: page.getByRole('list').filter({ has: badge }) })
  const n = await signalLists.count()
  expect(n, '출처 배지가 든 신호 목록').toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    const items = signalLists.nth(i).getByRole('listitem')
    const m = await items.count()
    for (let j = 0; j < m; j++) {
      await expect(items.nth(j).getByText(SOURCE_BADGE).first(), `신호 ${j + 1}: ${normalize(await items.nth(j).innerText())}`).toBeVisible()
    }
  }
})

test('S4-07 ① "내 기대·걱정 고르기" → ?step=2', async ({ page }) => {
  await openPrep(page, 'oo')
  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expect(page).toHaveURL(STEP_RE(2))
})

// ── S4 ② 내 기대·걱정 ─────────────────────────────────────────

test('S4-08 ② 처음 카드 12개, "5개 더 보기" 뒤 17개, 카드마다 radiogroup과 라디오 3개', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  const groups = cardGroups(page)
  await expect(groups).toHaveCount(12)
  await page.getByRole('button', { name: '5개 더 보기' }).click()
  await expect(groups).toHaveCount(17)
  for (let i = 0; i < 17; i++) {
    const g = groups.nth(i)
    await expect(g.getByRole('radio'), `카드 ${i + 1}`).toHaveCount(3)
    for (const c of CHOICES) await expect(g.getByRole('radio', { name: c }), `카드 ${i + 1} "${c}"`).toHaveCount(1)
    await expect(g, `카드 ${i + 1} radiogroup 이름`).toHaveAccessibleName(/\S/)
  }
  // radiogroup 이름 = 카드 이름
  for (const card of [...PRESET_A.expect, ...PRESET_A.worry, ...PRESET_A.unknown]) await expect(cardGroup(page, card), card).toHaveCount(1)
})

test('S4-09 ② 아무것도 안 고르면 "질문 만들기" 비활성, 하나 고르면 활성, 카운터 "1개 골랐어요"', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await expect(makeQuestionsButton(page)).toBeDisabled()
  await pickRadio(cardGroups(page).first(), '기대돼요')
  await expect(cardGroups(page).first().getByRole('radio', { name: '기대돼요' })).toBeChecked()
  await expect(makeQuestionsButton(page)).toBeEnabled()
  await expect(page.getByText('1개 골랐어요').first()).toBeVisible()
})

test('S4-10 ② 고른 라디오를 다시 누르면 선택이 풀리고 카운터가 줄어든다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  const first = cardGroups(page).nth(0)
  const second = cardGroups(page).nth(1)
  await pickRadio(first, '기대돼요')
  await pickRadio(second, '걱정돼요')
  await expect(page.getByText('2개 골랐어요').first()).toBeVisible()

  await pickRadio(first, '기대돼요')
  await expect(first.getByRole('radio', { name: '기대돼요' })).not.toBeChecked()
  for (const c of CHOICES) await expect(first.getByRole('radio', { name: c })).not.toBeChecked()
  await expect(page.getByText('1개 골랐어요').first()).toBeVisible()
  await expect(second.getByRole('radio', { name: '걱정돼요' })).toBeChecked()
})

test('S4-11 ② "경험 한 줄" 최대 100자, "이력서에서 가져오기" 칩 3개가 입력칸을 경험 문장으로 채운다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  const input = experienceInput(page)

  await input.fill('가'.repeat(100))
  await expect(input).toHaveValue('가'.repeat(100))
  await input.press('End')
  await input.pressSequentially('나나나')
  const typed = await input.inputValue()
  expect(typed.length, '100자를 넘겨 입력되면 안 된다').toBeLessThanOrEqual(100)
  expect(typed).not.toContain('나')

  const chipName = '이력서에서 가져오기'
  const chips = page
    .getByRole('group', { name: chipName })
    .or(page.getByRole('list', { name: chipName }))
    .or(page.getByRole('toolbar', { name: chipName }))
    .first()
  await expect(chips).toBeVisible()
  const buttons = chips.getByRole('button')
  await expect(buttons).toHaveCount(3)
  // 칩마다 그 칩의 이력서 경험 문장(data/persona.json experience_chips 에서 label 이 칩 글자와 같은 항목의 text)이 들어가야 한다
  const resume = resumeChips()
  const filled: string[] = []
  for (let i = 0; i < 3; i++) {
    const label = normalize(await buttons.nth(i).innerText())
    const chip = resume.find((c) => normalize(c.label) === label)
    expect(chip, `칩 ${i + 1} "${label}"이 이력서 경험(persona.json experience_chips)에 있어야 한다`).toBeDefined()
    await input.fill('')
    await buttons.nth(i).click()
    await expect(input, `칩 ${i + 1} "${label}"`).toHaveValue(chip?.text ?? '')
    const value = await input.inputValue()
    expect(value.length).toBeLessThanOrEqual(100)
    filled.push(value)
  }
  expect(new Set(filled).size, `칩마다 다른 경험 문장: ${filled.join(' / ')}`).toBe(3)
})

test('S4-12 ② 시연 도구 "예시 구직자 A로 채우기": 17개 모두(기대 3·걱정 4·모르겠어요 10), 경험 한 줄, "17개 골랐어요"', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await demoAction(page, '예시 구직자 A로 채우기')
  await expect(page.getByText('17개 골랐어요').first()).toBeVisible()
  await expectPresetA(page)
})

// ── S4 ③ 1차 질문 ─────────────────────────────────────────────

test('S4-13 예시 구직자 A × OO소프트 = 만드는 중 문구 뒤 질문 5개와 유형 순서, 1번 "상주", 5번 "경험 포함"·"FastAPI"', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await expectLoadingShown(page)
  await expect(page).toHaveURL(STEP_RE(3))
  await waitFirstResults(page)
  await expectCurrentStep(page, '질문 받기')

  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  expect(await itemTypes(items, FIRST_TYPES)).toEqual(FIRST_ORDER_A_OO)
  expect(await copyQuestion(page, items.nth(0)), '1번 질문').toContain('상주')
  await expect(items.nth(4).getByText('경험 포함', { exact: true }).first()).toBeVisible()
  expect(await copyQuestion(page, items.nth(4)), '5번 질문').toContain('FastAPI')
})

test('S4-14 질문마다 "복사"(알림·클립보드), "면접에서 쓸 것 같아요"(aria-pressed), "왜 이 질문인가요"(근거·주의할 답·좋은 신호)', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    const item = items.nth(i)
    const label = `${i + 1}번 질문`

    const copied = normalize(await copyQuestion(page, item))
    await expect(toast(page, '복사했어요'), `${label} 복사 알림`).toBeVisible()
    expect(normalize(await item.innerText()), `${label}: 클립보드 글이 그 질문 문장이어야 한다`).toContain(copied)

    const keep = item.getByRole('button', { name: '면접에서 쓸 것 같아요' })
    await keep.click()
    await expect(keep, label).toHaveAttribute('aria-pressed', 'true')

    await expect(item.getByText('주의할 답', { exact: true }).filter({ visible: true }), `${label}: 처음엔 접혀 있다`).toHaveCount(0)
    await item.getByText('왜 이 질문인가요').first().click()
    for (const part of ['근거', '주의할 답', '좋은 신호']) {
      await expect(item.getByText(part, { exact: true }).first(), `${label} 펼침 "${part}"`).toBeVisible()
    }
  }
})

test('S4-15 1차 결과에는 처우 질문·"처우 확인" 칩이 없고 "1차 면접을 다녀오면" 다음 단계 상자가 있다', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  for (const [i, text] of (await itemTexts(items)).entries()) expect(text, `${i + 1}번 질문`).not.toMatch(PAY_WORDS)
  await expect(page.getByText('처우 확인', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/1차 면접을 다녀오면/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '면접 다녀왔어요' })).toBeVisible()
})

// H1-18·H2-07 ③(세진 승인 2026-10-25): 칩 이름 "미리 확인". 예시 A 그대로면 공고에 적힌 "모르겠어요" 업무(배포·테스트, 탐색 3.5)가
// 공고에 없는 걱정(미리 확인 4)보다 앞서 상주 질문이 5개에 들지 않으므로, 그 두 카드의 선택을 풀고 만든다
test('S4-16 (주)△△커머스 + "1차·기술 면접" + 예시 A(공고에 적힌 모르겠어요 카드 둘 풀기): "공고에 고객사 상주" 문구 없음, 상주 질문 유형은 "미리 확인"', async ({ page }) => {
  const base = await openPrep(page, 'commerce')
  await switchMode(page, MODE_FIRST)
  await goToCardsStep(page, base)
  await fillPresetA(page)
  await showAllCards(page)
  for (const name of ['배포·서버 운영', '테스트·품질 검증']) {
    await pickRadio(cardGroup(page, name), '모르겠어요')
    for (const c of CHOICES) await expect(cardGroup(page, name).getByRole('radio', { name: c }), `${name} 선택 풀림`).not.toBeChecked()
  }
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expect(modeRadio(page, MODE_FIRST)).toBeChecked()
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  const texts = await itemTexts(items)
  for (const [i, text] of texts.entries()) expect(text, `${i + 1}번 질문`).not.toMatch(/공고에\s*고객사\s*상주/)
  const sentences = await questionSentences(page)
  for (const s of sentences) expect(s).not.toMatch(/공고에\s*고객사\s*상주/)
  const types = await itemTypes(items, FIRST_TYPES)
  const onsite = sentences.map((s, i) => (s.includes('상주') ? i : -1)).filter((i) => i >= 0)
  expect(onsite.length, `상주 질문이 있어야 한다: ${sentences.join(' / ')}`).toBeGreaterThan(0)
  for (const i of onsite) expect(types[i], `${i + 1}번(상주) 질문 유형`).toBe('미리 확인')
})

test('S4-17 ?apiFail=1 → "미리 검수한 문장" 안내, 질문 5개마다 "검수 문장" 라벨, 유형 순서는 S4-13과 같다', async ({ page }) => {
  await makeFirstQuestions(page, 'oo', { apiFail: true })
  await expect(page.getByText(/미리 검수한 문장/).first()).toBeVisible()
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    await expect(items.nth(i).getByText('검수 문장', { exact: true }).first(), `${i + 1}번 질문 "검수 문장"`).toBeVisible()
  }
  expect(await itemTypes(items, FIRST_TYPES)).toEqual(FIRST_ORDER_A_OO)
})

test('S4-18 "근거 보기" → ?step=1 이고 그 질문의 <mark>에 data-active="true"', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const item = questionItems(page).first()
  await item.getByText('왜 이 질문인가요').first().click()
  await expect(item.getByText('근거', { exact: true }).first()).toBeVisible()
  const evidence = normalize(await item.innerText())
  await item.getByRole('link', { name: '근거 보기' }).first().click()
  await expect(page).toHaveURL(STEP_RE(1))
  const active = page.locator('mark[data-active="true"]')
  await expect(active.first()).toBeVisible()
  const marked = normalize(await active.first().innerText())
  expect(evidence, `켜진 형광펜 "${marked}"이 1번 질문의 근거여야 한다`).toContain(marked)
})

test('S4-19 "선택 바꾸기" → ?step=2, 고른 카드·경험이 그대로', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '선택 바꾸기' }).click()
  await expect(page).toHaveURL(STEP_RE(2))
  await expectCurrentStep(page, '내 기대·걱정')
  await expectPresetA(page)
  await expect(page.getByText('17개 골랐어요').first()).toBeVisible()
})

test('S4-20 ③에서 새로고침해도 같은 질문이 그대로 보인다(브라우저 저장)', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  const before = await itemTexts(items)
  const first = await copyQuestion(page, items.first())
  const piece = first.split(/["\\\n]/).sort((a, b) => b.length - a.length)[0] ?? first
  expect(await localStorageDump(page), '질문이 localStorage 에 저장돼야 한다').toContain(piece)

  await page.reload()
  await expect(items).toHaveCount(5)
  expect(await itemTexts(items)).toEqual(before)
})

test('S4-21 "전체 복사" → 클립보드에 질문 5개 문장이 모두 있다', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const sentences = await questionSentences(page)
  expect(sentences).toHaveLength(5)
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await page.getByRole('button', { name: '전체 복사' }).click()
  await expect.poll(() => readClipboard(page)).not.toBe('')
  const all = normalize(await readClipboard(page))
  for (const [i, s] of sentences.entries()) expect(all, `${i + 1}번 질문`).toContain(s)
})

test('S4-22 "면접에 들고 갈 한 장 인쇄" → window.print 호출', async ({ page }) => {
  await installPrintSpy(page)
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접에 들고 갈 한 장 인쇄' }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
})

test('S4-23 "AI로 다시 만들기" → 만드는 중 문구가 다시 보였다가 질문 5개', async ({ page }) => {
  acceptDialogs(page)
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: 'AI로 다시 만들기' }).click()
  await expect(page.getByText(LOADING_TEXTS[0]).first()).toBeVisible()
  await expect(page.getByText(LOADING_TEXTS[2]).filter({ visible: true })).toHaveCount(0, { timeout: 15_000 })
  await expect(questionItems(page)).toHaveCount(5)
})

// ── R 1차 면접 정리 → 최종 질문 ───────────────────────────────

async function toReview(page: Page): Promise<void> {
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
}

test('R-01 "면접 다녀왔어요" → "최종 면접·처우 협의"로 바뀌고 "1차 면접 정리" 단계, 1차 질문 5개가 목록으로', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const sentences = await questionSentences(page)
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expect(modeRadio(page, MODE_FINAL)).toBeChecked()
  await expectCurrentStep(page, '1차 면접 정리')
  for (const s of FINAL_STEPS) await expect(stepList(page)).toContainText(s)
  const items = reviewItems(page)
  await expect(items).toHaveCount(5)
  const texts = await itemTexts(items)
  for (const s of sentences) expect(texts.some((t) => t.includes(s)), `1차 질문 "${s}"`).toBe(true)
})

test('R-02 "물어봤어요"면 "들은 답"(최대 100자)·"구체적이었어요/모호했어요", "못 물어봤어요"면 "못 물은 이유" 5개', async ({ page }) => {
  await toReview(page)
  const item = reviewItems(page).first()
  const answer = item.getByRole('textbox', { name: '들은 답' })
  const reason = item.getByLabel('못 물은 이유')

  await pickRadio(item, '물어봤어요')
  await expect(item.getByRole('radio', { name: '물어봤어요', exact: true })).toBeChecked()
  await expect(answer).toBeVisible()
  await expect(item.getByText('구체적이었어요', { exact: true }).first()).toBeVisible()
  await expect(item.getByText('모호했어요', { exact: true }).first()).toBeVisible()
  await expect(reason).toBeHidden()

  await answer.fill('가'.repeat(100))
  await answer.press('End')
  await answer.pressSequentially('나나')
  expect((await answer.inputValue()).length, '"들은 답" 최대 100자').toBeLessThanOrEqual(100)

  await pickRadio(item, '못 물어봤어요')
  await expect(item.getByRole('radio', { name: '못 물어봤어요', exact: true })).toBeChecked()
  await expect(reason).toBeVisible()
  const options = await optionLabels(page, reason)
  expect([...options].sort()).toEqual([...NOT_ASKED_REASONS].sort())
  await expect(answer).toBeHidden()
  await expect(item.getByText('구체적이었어요', { exact: true }).filter({ visible: true })).toHaveCount(0)
})

test('R-03 "회사가 물어본 업무" 체크 17개, "면접 분위기" 라디오 3개, 아무것도 정리 안 하면 "최종 질문 만들기" 비활성', async ({ page }) => {
  await toReview(page)
  const tasks = page.getByRole('group', { name: '회사가 물어본 업무' }).first()
  await expect(tasks.getByRole('checkbox')).toHaveCount(17)
  const mood = page.getByRole('radiogroup', { name: '면접 분위기' }).or(page.getByRole('group', { name: '면접 분위기' })).first()
  await expect(mood.getByRole('radio')).toHaveCount(3)
  for (const m of MOODS) await expect(mood.getByRole('radio', { name: m }), m).toHaveCount(1)
  await expect(page.getByRole('button', { name: '최종 질문 만들기', exact: true })).toBeDisabled()
})

type ReviewRow = { text: string; asked: boolean; notAsked: boolean; answer: string; concrete: boolean; vague: boolean; reason: string }

async function readReview(item: Locator): Promise<ReviewRow> {
  const asked = await item.getByRole('radio', { name: '물어봤어요', exact: true }).isChecked()
  const notAsked = await item.getByRole('radio', { name: '못 물어봤어요', exact: true }).isChecked()
  return {
    text: normalize(await item.innerText()),
    asked,
    notAsked,
    answer: asked ? await item.getByRole('textbox', { name: '들은 답' }).inputValue() : '',
    concrete: asked ? await item.getByRole('radio', { name: '구체적이었어요' }).isChecked() : false,
    vague: asked ? await item.getByRole('radio', { name: '모호했어요' }).isChecked() : false,
    reason: notAsked ? await selectedLabel(item.getByLabel('못 물은 이유')) : '',
  }
}

test('R-04 "1차 면접 다녀온 것으로 채우기"가 예시 세트(들은 답 4·못 물음 1·회사가 물어본 업무·압박)를 채운다', async ({ page }) => {
  await toReview(page)
  await fillReviewR04(page)
  const items = reviewItems(page)
  await expect(items).toHaveCount(5)
  const rows: ReviewRow[] = []
  for (let i = 0; i < 5; i++) rows.push(await readReview(items.nth(i)))

  expect(rows.filter((r) => r.asked)).toHaveLength(4)
  expect(rows.filter((r) => r.notAsked)).toHaveLength(1)
  expect(rows.filter((r) => r.asked).map((r) => r.answer).sort()).toEqual(Object.values(R04_ANSWERS).sort())

  const byAnswer = (a: string) => rows.find((r) => r.answer === a)
  const onsite = byAnswer(R04_ANSWERS.onsite)
  expect(onsite?.text, '"프로젝트마다 달라서요"는 고객사 상주 질문의 답').toContain('상주')
  expect(onsite?.vague, '고객사 상주 개발 = 모호했어요').toBe(true)
  expect(onsite?.concrete).toBe(false)
  const concreteCards: [string, string][] = [
    [R04_ANSWERS.maintenance, '기존 시스템 유지보수'],
    [R04_ANSWERS.design, '서비스 구조 설계'],
    [R04_ANSWERS.newApi, '신규 API 개발'],
  ]
  for (const [a, card] of concreteCards) {
    expect(byAnswer(a)?.text, `"${a}"는 ${card} 질문의 답`).toContain(card)
    expect(byAnswer(a)?.concrete, `"${a}" = 구체적이었어요`).toBe(true)
    expect(byAnswer(a)?.vague).toBe(false)
  }
  const notAsked = rows.find((r) => r.notAsked)
  expect(notAsked?.text, '못 물어봤어요 = DB 테이블 설계 질문').toContain('DB 테이블 설계')
  expect(notAsked?.reason, 'DB 테이블 설계 = 못 물어봤어요 · 시간이 없었어요').toBe('시간이 없었어요')

  const tasks = page.getByRole('group', { name: '회사가 물어본 업무' }).first()
  await expect(tasks.getByRole('checkbox', { name: '장애 대응·온콜' })).toBeChecked()
  await expect(tasks.getByRole('checkbox', { checked: true })).toHaveCount(1)
  const mood = page.getByRole('radiogroup', { name: '면접 분위기' }).or(page.getByRole('group', { name: '면접 분위기' })).first()
  await expect(mood.getByRole('radio', { name: '압박이 있었어요' })).toBeChecked()
})

test('R-05 R-04 뒤 "최종 질문 만들기" → 요약 2·1·2·1, 첫 질문 "다시 확인"·"상주", 처우 확인 3개 이상, 8개 이하', async ({ page }) => {
  await makeFinalQuestions(page)
  await expectCurrentStep(page, '최종 질문 받기')
  await expect(heading(page, '최종 면접·처우 질문', false)).toBeVisible()

  const text = await bodyText(page)
  expect(countNear(text, '확인됨'), '확인됨').toBe(2)
  expect(countNear(text, '기대와 다름'), '기대와 다름').toBe(1)
  expect(countNear(text, '아직 모름'), '아직 모름').toBe(2)
  expect(countNear(text, '회사가 먼저 물은 것'), '회사가 먼저 물은 것').toBe(1)

  const items = questionItems(page)
  const n = await items.count()
  expect(n).toBeGreaterThan(0)
  expect(n, '최종 질문 8개 이하').toBeLessThanOrEqual(8)
  const types = await itemTypes(items, FINAL_TYPES)
  expect(types[0], '첫 질문 유형').toBe('다시 확인')
  expect(await copyQuestion(page, items.first()), '첫 질문 문장').toContain('상주')
  expect(types.filter((t) => t === '처우 확인').length, `처우 확인 개수: ${types.join(', ')}`).toBeGreaterThanOrEqual(3)
  for (const t of await itemTexts(items)) {
    expect(t, '확인됨 카드(서비스 구조 설계) 질문은 빠진다').not.toContain('서비스 구조 설계')
    expect(t, '확인됨 카드(신규 API 개발) 질문은 빠진다').not.toContain('신규 API 개발')
  }
})

test('R-05 최종 질문 유형 순서가 API-07 규칙과 같다: 다시 확인 → 신호 확인 → 범위 확인 → 처우 확인들 → 다시 확인', async ({ page }) => {
  await makeFinalQuestions(page)
  const types = await itemTypes(questionItems(page), FINAL_TYPES)
  const pay = types.filter((t) => t === '처우 확인').length
  expect(pay).toBeGreaterThanOrEqual(3)
  expect(types).toEqual(['다시 확인', '신호 확인', '범위 확인', ...Array.from({ length: pay }, () => '처우 확인'), '다시 확인'])
})

test('R-06 최종 질문에 1차 면접관 인용 표현이 없고, 분위기 "압박"이라 완충 문장("여쭤도 될까요")이 1개 이상', async ({ page }) => {
  await makeFinalQuestions(page)
  const texts = await itemTexts(questionItems(page))
  expect(texts.length).toBeGreaterThan(0)
  for (const [i, t] of texts.entries()) expect(t, `${i + 1}번 최종 질문`).not.toMatch(QUOTE_WORDS)
  const sentences = await questionSentences(page)
  for (const s of sentences) expect(s).not.toMatch(QUOTE_WORDS)
  expect(sentences.some((s) => s.includes('여쭤도 될까요')), `완충 문장: ${sentences.join(' / ')}`).toBe(true)
})

test('R-07 S1 2행 "최종 면접 준비" → "1차 면접 정리" 단계에 1차 질문 5개가 이미 있다(시드)', async ({ page }) => {
  await openPrep(page, 'commerce')
  await goToReviewStep(page)
  await expect(reviewItems(page)).toHaveCount(5)
})

test('R-08 1차 결과가 없는 S1 3행에서 "최종 면접·처우 협의"로 바꾸면 "먼저 1차 면접 질문을 만들어 주세요"와 "1차 면접 질문 만들기"', async ({ page }) => {
  await openPrep(page, 'data')
  await expect(modeRadio(page, MODE_FIRST)).toBeChecked()
  await pickRadio(modeGroup(page), MODE_FINAL)
  await expect(modeRadio(page, MODE_FINAL)).toBeChecked()
  const notice = page.getByText('먼저 1차 면접 질문을 만들어 주세요').first()
  const next = page.getByRole('button', { name: '1차 면접 정리하기' })
  await expect(notice.or(next).first()).toBeVisible()
  if (!(await notice.isVisible()) && (await currentStep(page).count()) > 0 && (await stepText(page)).includes('공고 확인')) await next.click()
  await expect(notice).toBeVisible()
  await expect(page.getByRole('button', { name: '1차 면접 질문 만들기' })).toBeVisible()
  await expect(reviewItems(page)).toHaveCount(0)
})

test('R-09 최종 질문을 만든 뒤 localStorage 어디에도 R-04의 들은 답 문장이 없다', async ({ page }) => {
  await makeFinalQuestions(page)
  const dump = await localStorageDump(page)
  for (const a of Object.values(R04_ANSWERS)) expect(dump, `들은 답 "${a}"`).not.toContain(a)
})
