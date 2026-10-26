/**
 * V-01~23 — 보류 의견 화면·접근성 묶음(2026-10-25 세진 결정). ACCEPTANCE.md 「4차 추가분」만 보고 쓴다.
 * 화면은 역할·이름·글자로 찾고, 위치·색·글자 크기처럼 재야 하는 것은 찾은 요소에서 계산한다.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { join } from 'node:path'
import {
  COMPANY,
  FINAL_TYPES,
  FIRST_TYPES,
  MODE_FINAL,
  MODE_FIRST,
  REPO_ROOT,
  applicationEntries,
  applyToPosting,
  WHY_TEXT,
  currentStep,
  demoToolsButton,
  experienceInput,
  expectCurrentStep,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  gotoApplications,
  heading,
  installPrintSpy,
  itemTypes,
  localStorageDump,
  makeFinalQuestions,
  makeFirstQuestions,
  makeQuestionsButton,
  modeGroup,
  modeRadio,
  normalize,
  openPrep,
  pickRadio,
  printCalls,
  questionItems,
  questionSentence,
  questionSentences,
  readClipboard,
  reviewItems,
  stepList,
  waitFinalResults,
  waitFirstResults,
  waitPostingReady,
} from './helpers'
import {
  PRINT_BUTTON,
  inBottomBar,
  insideBand,
  pdfPageCount,
  readRepoJson,
  rectOf,
  scrollToBottom,
  scrollToTop,
  settleScroll,
  textUnderBottomBar,
  visibleBand,
} from './helpers2'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })
test.describe.configure({ timeout: 120_000 })

const MODE_HINT = /고르면 그 면접 준비 화면으로 바로 바뀌어요/
const BEHIND = '최종 질문은 이전 1차 질문 기준이에요'
const TAG_BRACKETS = /\[[^\]]+\]/

/** 화면에 보이는(인쇄 화면 포함) 글자인가 */
async function shown(target: Locator): Promise<boolean> {
  const n = await target.count()
  for (let i = 0; i < n; i++) if (await target.nth(i).isVisible()) return true
  return false
}

/** 질문 항목들을 화면 위에서부터 놓인 순서로(인쇄 순서 확인용) */
async function itemsByTop(items: Locator): Promise<Locator[]> {
  const n = await items.count()
  const tops: Array<{ i: number; top: number }> = []
  for (let i = 0; i < n; i++) tops.push({ i, top: (await rectOf(items.nth(i))).top })
  return tops.sort((a, b) => a.top - b.top).map((t) => items.nth(t.i))
}

// ── V-01·V-02 인쇄물과 전체 복사 ────────────────────────────────

// 6차 RS-04(2026-10-26): "면접에서 쓸 것 같아요"를 없애 인쇄 순서는 화면 순서 그대로다
test('V-01 1차 ③ 인쇄: 번호·카드 이름·질문·"들은 답"만, 유형 칩·내 선택·경험 포함은 없음 · 순서는 화면 순서', async ({ page, isMobile }) => {
  test.skip(isMobile, '인쇄는 화면 폭과 상관없이 A4라 데스크톱에서 한 번')
  await installPrintSpy(page)
  await makeFirstQuestions(page, 'oo')
  const sentences = await questionSentences(page)
  expect(sentences).toHaveLength(5)

  await page.emulateMedia({ media: 'print' })
  // 인쇄 화면에서는 펼침이 숨을 수 있어 질문 목록의 항목으로 찾는다
  const ordered = await itemsByTop(page.getByRole('list', { name: '1차·기술 면접 질문 목록' }).getByRole('listitem'))
  expect(ordered.length).toBe(5)
  const top = ordered[0] as Locator
  for (const [k, item] of ordered.entries()) {
    expect(normalize(await item.innerText()), `인쇄 ${k + 1}번째 = 화면 ${k + 1}번 질문`).toContain(sentences[k] ?? '')
  }
  for (const [k, item] of ordered.entries()) {
    const text = normalize(await item.innerText())
    for (const t of FIRST_TYPES) expect(text, `인쇄 ${k + 1}번째: 유형 칩 "${t}" 없음`).not.toContain(t)
    for (const t of ['걱정돼요', '기대돼요', '모르겠어요', '경험 포함', '검수 문장', '공고에 없음']) expect(text, `인쇄 ${k + 1}번째: "${t}" 없음`).not.toContain(t)
    expect(text, `인쇄 ${k + 1}번째: "들은 답" 칸`).toContain('들은 답')
    expect(text, `인쇄 ${k + 1}번째: 번호 ${k + 1}`).toMatch(new RegExp(`^${k + 1}\\b`))
  }
  expect(normalize(await top.innerText()), '카드 이름은 남는다').toMatch(/서비스 구조 설계|신규 API 개발|DB 테이블 설계|고객사 상주 개발|기존 시스템 유지보수/)
  expect(await shown(page.getByText('좋은 신호', { exact: true })), '"좋은 신호"는 종이에 없다').toBe(false)

  await page.emulateMedia({ media: null })
  await page.getByRole('button', { name: PRINT_BUTTON }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
  const pdf = await page.pdf({ format: 'A4', path: join(REPO_ROOT, 'review', 'tmp', 'v01-first-print.pdf') })
  expect(pdfPageCount(pdf), '1차 ③ 인쇄 A4 1쪽(Q-02)').toBe(1)
})

/** 글 안에서 조각들이 이 순서로 나오는 위치(못 찾으면 -1) */
function orderIn(text: string, pieces: readonly string[], from = 0): number[] {
  const out: number[] = []
  let at = from
  for (const p of pieces) {
    const i = text.indexOf(p, at)
    out.push(i)
    if (i >= 0) at = i + p.length
  }
  return out
}

/** 최종 ③ 묶음 목록 안 질문 문장(화면 순서) */
async function groupQuestionSentences(page: Page, group: string): Promise<string[]> {
  const items = page.getByRole('list', { name: `${group} 목록` }).getByRole('listitem').filter({ has: page.getByText(WHY_TEXT) })
  const n = await items.count()
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(normalize(await questionSentence(items.nth(i))))
  return out
}

// 6차 RS-04(2026-10-26): "면접에서 쓸 것 같아요"를 없애 복사 순서는 화면 순서 그대로다
test('V-02 "전체 복사" 글에 [유형] 꼬리표가 없고 순서는 화면 순서(1차·최종), 최종 복사 글은 소제목 두 개 아래로', async ({ page, isMobile }) => {
  test.skip(isMobile, '복사 글은 폭과 상관없어 데스크톱에서 한 번')
  await makeFirstQuestions(page, 'oo')
  const sentences = await questionSentences(page)
  expect(sentences).toHaveLength(5)
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await page.getByRole('button', { name: '전체 복사' }).click()
  await expect.poll(() => readClipboard(page)).not.toBe('')
  const first = await readClipboard(page)
  expect(first, '1차 복사 글: 대괄호 꼬리표 없음').not.toMatch(TAG_BRACKETS)
  for (const t of FIRST_TYPES) expect(first, `1차 복사 글: "${t}" 없음`).not.toContain(t)
  const pos = orderIn(normalize(first), sentences)
  expect(pos, `1차 복사 글의 질문 순서 = 화면 순서(위치 ${pos.join(', ')})`).not.toContain(-1)
  const line1 = first.split('\n').find((l) => /^1\.\s/.test(l))
  if (line1 !== undefined) expect(normalize(line1), '1차 복사 글 "1." 줄 = 화면 1번 질문').toContain(sentences[0] ?? '')

  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
  const g1 = await groupQuestionSentences(page, '최종 면접에서 물을 것')
  const g2 = await groupQuestionSentences(page, '처우 협의 때 물을 것')
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await page.getByRole('button', { name: '전체 복사' }).click()
  await expect.poll(() => readClipboard(page)).not.toBe('')
  const fin = await readClipboard(page)
  expect(fin, '최종 복사 글: 대괄호 꼬리표 없음').not.toMatch(TAG_BRACKETS)
  for (const t of FINAL_TYPES) expect(fin, `최종 복사 글: "${t}" 없음`).not.toContain(t)
  expect(fin, '최종 복사 글: 소제목 두 개(V-15)').toContain('최종 면접에서 물을 것')
  expect(fin).toContain('처우 협의 때 물을 것')
  const all = normalize(fin)
  const h1 = all.indexOf('최종 면접에서 물을 것')
  const h2 = all.indexOf('처우 협의 때 물을 것', Math.max(0, h1))
  expect(h2, '소제목 순서: "최종 면접에서 물을 것" → "처우 협의 때 물을 것"').toBeGreaterThan(h1)
  const p1 = orderIn(all, g1, h1)
  expect(p1, '첫 묶음 문장이 첫 소제목 아래 화면 순서로').not.toContain(-1)
  for (const p of p1) expect(p, '첫 묶음 문장은 둘째 소제목 앞').toBeLessThan(h2)
  expect(orderIn(all, g2, h2), '둘째 묶음 문장이 둘째 소제목 아래 화면 순서로').not.toContain(-1)
})

test('V-01 최종 ③ 인쇄: 유형 칩·내 선택·판정·공고 판정 없음, 소제목과 카드 이름은 남고 A4 1쪽', async ({ page, isMobile }) => {
  test.skip(isMobile, '인쇄는 데스크톱에서 한 번')
  await installPrintSpy(page)
  await makeFinalQuestions(page)
  const total = await questionItems(page).count()
  await page.emulateMedia({ media: 'print' })
  const items = page.getByRole('list', { name: /물을 것 목록$/ }).getByRole('listitem')
  const n = await items.count()
  expect(n, '인쇄 화면의 질문 수').toBe(total)
  for (let i = 0; i < n; i++) {
    const text = normalize(await items.nth(i).innerText())
    for (const t of [...FINAL_TYPES, '걱정돼요', '기대돼요', '모르겠어요', '아직 모름', '기대와 다름', '확인됨', '공고에 없음', '모호한 표현', '확인 필요']) {
      expect(text, `인쇄 최종 ${i + 1}번째: "${t}" 없음`).not.toContain(t)
    }
    expect(text, `인쇄 최종 ${i + 1}번째: "들은 답" 칸`).toContain('들은 답')
  }
  await expect(page.getByRole('heading', { name: '처우 협의 때 물을 것' })).toBeVisible()
  await page.emulateMedia({ media: null })
  await page.getByRole('button', { name: PRINT_BUTTON }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
  const pdf = await page.pdf({ format: 'A4', path: join(REPO_ROOT, 'review', 'tmp', 'v01-final-print.pdf') })
  expect(pdfPageCount(pdf), '최종 ③ 인쇄 A4 1쪽(Q-02)').toBe(1)
})

// ── V-03 준비할 면접 라디오 ────────────────────────────────────

test('V-03 "준비할 면접" 라디오: 보이는 안내 한 줄을 접근 설명으로 · 1차 ③에서 방향키로 최종을 고르면 "1차 면접 정리"로', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await expect(page.getByText(MODE_HINT).first(), '보이는 안내 한 줄').toBeVisible()
  for (const m of [MODE_FIRST, MODE_FINAL] as const) await expect(modeRadio(page, m), `${m} 접근 설명`).toHaveAccessibleDescription(MODE_HINT)
  await modeRadio(page, MODE_FIRST).focus()
  await page.keyboard.press('ArrowRight')
  await expect(modeRadio(page, MODE_FINAL)).toBeChecked()
  await expect(page).toHaveURL(/[?&]step=2(?:&|$)/)
  await expect(page).toHaveURL(/[?&]mode=final(?:&|$)/)
  await expectCurrentStep(page, '1차 면접 정리')
  await expect(reviewItems(page), '빈 ③ 대신 1차 질문 5개를 정리하는 화면').toHaveCount(5)
})

// ── V-04·V-19 다시 들어올 때 ─────────────────────────────────

test('V-04 서류합격 건(1행)에서 최종 질문을 만들면 S1 버튼이 "최종 면접 준비"·"최종 질문 N개 준비됨", 누르면 최종 ③', async ({ page }) => {
  await makeFinalQuestions(page)
  const n = await questionItems(page).count()
  await gotoApplications(page)
  const row1 = applicationEntries(page).filter({ hasText: COMPANY.oo }).first()
  await expect(row1.getByRole('button', { name: '최종 면접 준비' })).toBeVisible()
  await expect(row1.getByRole('button', { name: '면접 역질문 준비' })).toHaveCount(0)
  await expect(row1.getByText(`최종 질문 ${n}개 준비됨`).filter({ visible: true })).toHaveCount(1)
  await row1.getByRole('button', { name: '최종 면접 준비' }).click()
  await expect(page).toHaveURL(/[?&]step=3(?:&|$)/)
  await expect(modeRadio(page, MODE_FINAL)).toBeChecked()
  await waitFinalResults(page)
})

test('V-19 S1 면접 준비 버튼 아래 "1차 질문 5개 준비됨"(시드 2행 포함), 결과 없는 행은 없음 · 1차만 만든 1행은 "면접 역질문 준비"로 1차 ③', async ({ page }) => {
  await gotoApplications(page)
  const entries = applicationEntries(page)
  await expect(entries.filter({ hasText: COMPANY.commerce }).first().getByText('1차 질문 5개 준비됨').filter({ visible: true })).toHaveCount(1)
  await expect(entries.filter({ hasText: COMPANY.oo }).first().getByText(/준비됨/).filter({ visible: true })).toHaveCount(0)
  await makeFirstQuestions(page, 'oo')
  await gotoApplications(page)
  const row1 = applicationEntries(page).filter({ hasText: COMPANY.oo }).first()
  await expect(row1.getByText('1차 질문 5개 준비됨').filter({ visible: true })).toHaveCount(1)
  await row1.getByRole('button', { name: '면접 역질문 준비' }).click()
  await waitFirstResults(page)
  await expect(modeRadio(page, MODE_FIRST)).toBeChecked()
})

test('V-04 ④ 최종 결과가 있는데 1차를 다시 만들면 "최종 질문은 이전 1차 질문 기준이에요"(1차 ③·최종 ③)', async ({ page }) => {
  await makeFinalQuestions(page)
  await expect(page.getByText(BEHIND)).toHaveCount(0)
  await pickRadio(modeGroup(page), MODE_FIRST)
  await waitFirstResults(page)
  await page.getByRole('button', { name: 'AI로 다시 만들기' }).click()
  await waitFirstResults(page)
  await expect(page.getByText(BEHIND).first()).toBeVisible({ timeout: 15_000 })
  await pickRadio(modeGroup(page), MODE_FINAL)
  await waitFinalResults(page)
  await expect(page.getByText(BEHIND).first()).toBeVisible()
})

// ── V-05 최종 ③ 고정 바 ───────────────────────────────────────

// 6차 RS-02·V-05 변경(2026-10-26): 최종 ③ 아래 고정 바를 없애고(D-196 뒤집음) "전체 복사"·인쇄는 오른쪽 상자로
test('V-05 최종 ③에는 아래 고정 바가 없고 "전체 복사"·"면접에 들고 갈 한 장 인쇄"(각 하나)는 오른쪽 상자 안 · 정리 화면은 고정 바 없이 버튼 줄', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)
  await settleScroll(page)
  await scrollToTop(page)
  expect(await inBottomBar(page.getByRole('button', { name: '최종 질문 만들기', exact: true })), '정리 화면은 버튼 줄(고정 바 아님, D-066·실측)').toBe(false)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
  await settleScroll(page)
  await scrollToTop(page)
  const side = page.getByRole('complementary').filter({ has: page.getByRole('button', { name: '전체 복사', exact: true }) })
  await expect(side, '"전체 복사"를 품은 오른쪽 상자(complementary)').toHaveCount(1)
  for (const name of ['전체 복사', PRINT_BUTTON]) {
    const b = page.getByRole('button', { name, exact: true })
    await expect(b, `"${name}" 하나`).toHaveCount(1)
    await expect(side.getByRole('button', { name, exact: true }), `"${name}"이 오른쪽 상자 안에`).toHaveCount(1)
    expect(await inBottomBar(b), `"${name}"은 아래 고정 바 밖`).toBe(false)
  }
  expect((await textUnderBottomBar(page)).barTop, '최종 ③ 맨 위: 아래 고정 바 없음').toBeNull()
  await scrollToBottom(page)
  const bottom = await textUnderBottomBar(page)
  expect(bottom.barTop, '최종 ③ 맨 아래: 아래 고정 바 없음').toBeNull()
  expect(bottom.covered, '맨 아래에서 가린 글').toEqual([])
})

// ── V-06 낮은 노트북 화면·브라우저 확대 ────────────────────────

const LOW_SIZES = [
  { width: 1366, height: 657, cards: 4 },
  { width: 1152, height: 720, cards: 4 },
  { width: 960, height: 600, cards: 2 },
] as const

async function cardsInView(page: Page): Promise<number> {
  const band = await visibleBand(page)
  const boxes = await page
    .getByRole('radiogroup')
    .filter({ has: page.getByRole('radio', { name: '기대돼요' }) })
    .evaluateAll((groups) =>
      groups.map((g) => {
        let box: Element = g
        while (box.parentElement && box.parentElement.querySelectorAll('[role="radiogroup"]').length === 1) box = box.parentElement
        const r = box.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }
      }),
    )
  return boxes.filter((b) => insideBand(b, band)).length
}

async function stepsAtTop(page: Page, where: string): Promise<void> {
  const r = await rectOf(stepList(page))
  expect(r.top, `${where}: 단계 표시가 화면 맨 위(위끝 ${Math.round(r.top)}px)`).toBeGreaterThanOrEqual(-1)
  expect(r.top, `${where}: 단계 표시가 화면 맨 위(위끝 ${Math.round(r.top)}px)`).toBeLessThanOrEqual(16)
}

for (const size of LOW_SIZES) {
  // 6차 V-06 변경(2026-10-26): "S4 ① 들어온 직후" → "S4 ① 로딩이 끝난 직후"(LD-01)
  test(`V-06 ${size.width}×${size.height}: S1 "바로 해 보기" · ① 로딩이 끝난 직후 "AI 분석 요약" · 단계를 옮기면 단계 표시로 · ② 카드 ${size.cards}개 · ③ 1번 질문 전체와 2번 칩`, async ({ page, isMobile }) => {
    test.skip(isMobile, '노트북·확대 폭 기준(데스크톱 프로젝트)')
    await page.setViewportSize({ width: size.width, height: size.height })
    await gotoApplications(page)
    const tryNow = page.getByRole('button', { name: '바로 해 보기' })
    expect(insideBand(await rectOf(tryNow), await visibleBand(page)), 'S1 첫 화면에 "바로 해 보기"').toBe(true)
    await tryNow.click()
    await expect(page).toHaveURL(/\/prep\?step=1(?:&|$)/)
    await expect(page.getByText(COMPANY.oo).first(), '맨 위 지원 건').toBeVisible()
    await waitPostingReady(page)
    await settleScroll(page)
    const summary = page.getByText('AI 분석 요약', { exact: true }).first()
    expect(insideBand(await rectOf(summary), await visibleBand(page)), 'S4 ① 로딩이 끝난 직후 첫 화면에 "AI 분석 요약" 제목').toBe(true)

    await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
    await expectCurrentStep(page, '내 기대·걱정')
    await settleScroll(page)
    await stepsAtTop(page, '②로 옮긴 직후')
    expect(await cardsInView(page), '② 첫 화면 카드 수').toBeGreaterThanOrEqual(size.cards)

    await fillPresetA(page)
    await makeQuestionsButton(page).click()
    await waitFirstResults(page)
    await settleScroll(page)
    await stepsAtTop(page, '③으로 옮긴 직후')
    const band = await visibleBand(page)
    const items = questionItems(page)
    const chip = items.nth(1).getByText(new RegExp(`^(?:${FIRST_TYPES.join('|')})$`)).filter({ visible: true }).first()
    const chipBox = await rectOf(chip)
    const q1 = items.first()
    const sentence = await q1.evaluate((el) => {
      const ps = Array.from(el.querySelectorAll('p')).filter((p) => (p.textContent ?? '').trim().length > 20)
      const r = ps[0]?.getBoundingClientRect()
      return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null
    })
    expect(sentence, '1번 질문 문장').not.toBeNull()
    expect(insideBand(sentence ?? { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }, band), `1번 질문 문장 전체(보이는 범위 ${Math.round(band.top)}~${Math.round(band.bottom)})`).toBe(true)
    expect(insideBand(chipBox, band), '2번 질문 유형 칩').toBe(true)
  })
}

// ── V-07 공고 목록에 없는 지원 건 ─────────────────────────────

test('V-07 지원할 때 회사명·채용제목을 저장하고, 공고 목록에 없는 지원 건은 "공고 마감"과 흐린 준비 버튼으로 남는다', async ({ page }) => {
  const applied = await applyToPosting(page)
  expect(await localStorageDump(page), '지원 내역 저장값에 채용제목').toContain(applied.title)
  await gotoApplications(page)
  await page.evaluate(() => {
    const key = 'rq:v1:applications'
    const list = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
    list.unshift({
      apply_id: 'A-0099',
      wantedAuthNo: 'K-GONE-0001',
      applied_on: new Date().toISOString().slice(0, 10),
      viewed_days_ago: null,
      result: '-',
      corpNm: '(주)OO마감',
      wantedTitle: '백엔드 개발자(마감된 예시 공고)',
    })
    localStorage.setItem(key, JSON.stringify(list))
  })
  await page.reload()
  const gone = applicationEntries(page).filter({ hasText: '(주)OO마감' }).first()
  await expect(gone).toBeVisible()
  await expect(gone).toContainText('백엔드 개발자(마감된 예시 공고)')
  await expect(gone).toContainText('공고 마감')
  await expect(gone.getByRole('button', { name: '면접 역질문 준비' })).toBeDisabled()
})

// ── V-08·V-09 문구 ────────────────────────────────────────────

test('V-08 안내 띠 둘째 문장에 시간 약속이 없고("차례로 안내해요"), 주 메뉴 "채용정보"에 펼침 화살표가 없다', async ({ page }) => {
  await gotoApplications(page)
  const guide = page.locator('section').filter({ hasText: /면접에서 물어볼 질문/ }).first()
  await expect(guide).toContainText('공고 확인부터 질문 받기까지 차례로 안내해요')
  await expect(guide).not.toContainText('1분')
  const jobs = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '채용정보', exact: true })
  await expect(jobs.locator('svg')).toHaveCount(0)
})

test('V-09 1차 ③ 아래 바 왼쪽(데스크톱): "면접 다녀왔어요는 면접에 다녀온 뒤 눌러 주세요"', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 바는 버튼만(D-133)')
  await makeFirstQuestions(page, 'oo')
  await settleScroll(page)
  await scrollToTop(page)
  const note = page.getByText(/면접에 다녀온 뒤 눌러 주세요/).first()
  await expect(note).toBeVisible()
  expect(normalize(await note.innerText())).toContain('면접 다녀왔어요')
  expect(await inBottomBar(note), '아래 고정 바 안').toBe(true)
})

// ── V-10 같은 이름 버튼에 몇 번 질문인지 ───────────────────────

// 6차 V-10 변경(2026-10-26): 접근 설명 "N번 질문"은 "근거 보기"에(복사·면접에서 쓸 것 같아요 버튼은 없음, RS-01)
test('V-10 질문마다 "근거 보기"의 접근 설명이 "N번 질문"(이름은 그대로) · "복사"·"면접에서 쓸 것 같아요" 버튼은 없다', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  let checked = 0
  for (let i = 0; i < 5; i++) {
    const item = items.nth(i)
    await expect(item.getByRole('button', { name: '복사', exact: true }), `${i + 1}번 "복사" 없음`).toHaveCount(0)
    await expect(item.getByRole('button', { name: '면접에서 쓸 것 같아요' }), `${i + 1}번 "면접에서 쓸 것 같아요" 없음`).toHaveCount(0)
    await item.getByText('왜 이 질문인가요').first().click()
    const link = item.getByRole('link', { name: '근거 보기', exact: true })
    // 1·2번은 공고에 근거가 있는 질문(V-18)이라 "근거 보기"가 꼭 있다
    if (i < 2) await expect(link, `${i + 1}번 "근거 보기"`).toHaveCount(1)
    if ((await link.count()) === 0) continue
    await expect(link.first(), `${i + 1}번 "근거 보기" 접근 설명`).toHaveAccessibleDescription(`${i + 1}번 질문`)
    checked += 1
  }
  test.info().annotations.push({ type: 'V-10', description: `"근거 보기"가 있는 질문 ${checked}개` })
})

// ── V-11 경험 한 줄 바로가기 ──────────────────────────────────

test('V-11 ② 경험이 비어 있으면 아래 바에 "경험 한 줄 붙이기(선택)", 누르면 입력칸으로 · 채우면 사라진다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await settleScroll(page)
  const jump = page.getByRole('button', { name: '경험 한 줄 붙이기(선택)' })
  await expect(jump).toBeVisible()
  expect(await inBottomBar(jump), '아래 고정 바 안(카운터 옆)').toBe(true)
  await jump.click()
  await expect(experienceInput(page)).toBeFocused()
  await fillPresetA(page)
  await expect(jump).toHaveCount(0)
})

// ── V-12 누를 수 있는 것과 없는 것, 정리 화면 색 ───────────────

test('V-12 ① 누를 수 있는 확인할 점·먼저 볼 곳은 이름에 "공고에서 보기", 누를 수 없는 확인할 점은 회색 바탕', async ({ page }) => {
  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  const more = page.getByRole('button', { name: /확인할 점 \d+개 더 보기/ })
  if ((await more.count()) > 0) await more.click()
  const checks = page.locator('section').filter({ has: page.getByRole('heading', { name: 'AI가 찾은 확인할 점' }) }).first()
  const items = checks.getByRole('listitem')
  const n = await items.count()
  let links = 0
  let plain = 0
  const bgOf = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor)
  let linkBg = ''
  let plainBg = ''
  for (let i = 0; i < n; i++) {
    const btn = items.nth(i).getByRole('button')
    if ((await btn.count()) > 0) {
      links++
      await expect(btn.first(), `확인할 점 ${i + 1}번 버튼 이름`).toHaveAccessibleName(/공고에서 보기/)
      linkBg = await bgOf(btn.first())
    } else {
      plain++
      plainBg = await bgOf(items.nth(i).locator(':scope > *').first())
    }
  }
  expect(links, '누를 수 있는 항목').toBeGreaterThan(0)
  expect(plain, '누를 수 없는 항목(근로조건 등)').toBeGreaterThan(0)
  expect(plainBg, '누를 수 없는 항목 바탕이 누를 수 있는 항목과 다르다(회색)').not.toBe(linkBg)
  const looks = page.getByRole('list', { name: /먼저 볼/ }).getByRole('button')
  expect(await looks.count()).toBe(2)
  for (let i = 0; i < 2; i++) await expect(looks.nth(i), `먼저 볼 곳 ${i + 1}`).toHaveAccessibleName(/공고에서 보기/)
})

test('V-12 정리 화면: 고른 표시는 강조색 하나(물어봤어요=못 물어봤어요, 구체적=모호), 유형 칩은 ③과 같은 색', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const chipColor = async (scope: Locator, label: string) =>
    scope.getByText(label, { exact: true }).filter({ visible: true }).first().evaluate((el) => {
      const cs = getComputedStyle(el)
      return `${cs.backgroundColor}|${cs.color}`
    })
  const firstItem = questionItems(page).first()
  const [type1] = await itemTypes(questionItems(page).first(), FIRST_TYPES)
  const resultChip = await chipColor(firstItem, type1 ?? '차이 확인')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)
  const rows = reviewItems(page)
  expect(await chipColor(rows.first(), type1 ?? '차이 확인'), '정리 화면 1번 유형 칩 색 = ③ 1번 유형 칩 색').toBe(resultChip)
  const bg = (row: Locator, label: string) =>
    row.getByText(label, { exact: true }).filter({ visible: true }).first().evaluate((el) => getComputedStyle(el).backgroundColor)
  const askedRow = rows.filter({ has: page.getByRole('radio', { name: '물어봤어요', exact: true, checked: true }) }).first()
  const notAskedRow = rows.filter({ has: page.getByRole('radio', { name: '못 물어봤어요', exact: true, checked: true }) }).first()
  const vagueRow = rows.filter({ has: page.getByRole('radio', { name: '모호했어요', exact: true, checked: true }) }).first()
  const clearRow = rows.filter({ has: page.getByRole('radio', { name: '구체적이었어요', exact: true, checked: true }) }).first()
  expect(await bg(notAskedRow, '못 물어봤어요'), '못 물어봤어요(고름) = 물어봤어요(고름)').toBe(await bg(askedRow, '물어봤어요'))
  expect(await bg(vagueRow, '모호했어요'), '모호했어요(고름) = 구체적이었어요(고름)').toBe(await bg(clearRow, '구체적이었어요'))
})

// ── V-13 떠날 때 확인 창 ──────────────────────────────────────

test('V-13 정리 화면에 하나라도 적었으면 떠날 때 확인 창(beforeunload), 적지 않았으면 없음', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.type())
    void d.accept()
  })
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await page.reload()
  await expectCurrentStep(page, '1차 면접 정리')
  expect(dialogs, '아무것도 적지 않으면 확인 창 없음').toEqual([])
  const row = reviewItems(page).first()
  await pickRadio(row, '물어봤어요')
  await row.getByRole('textbox', { name: '들은 답' }).fill('유지보수가 반쯤이에요')
  await page.reload()
  await expect.poll(() => dialogs, { message: '떠날 때 확인 창' }).toContain('beforeunload')
  expect(await localStorageDump(page), '들은 답은 저장하지 않는다(R-09, 임시 저장 없음)').not.toContain('유지보수가 반쯤이에요')
})

// ── V-14 AI 이용 안내·직종 코드 ───────────────────────────────

test('V-14 S4 머리 "AI 이용 안내" 링크(①②③) → /about-ai, S3 상세 모집직종에 "(직종코드 133200)"', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  const link = () => page.getByRole('link', { name: 'AI 이용 안내', exact: true })
  await expect(link()).toBeVisible()
  await goToCardsStep(page, base)
  await expect(link()).toBeVisible()
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expect(link()).toBeVisible()
  await link().click()
  await expect(page).toHaveURL(/\/about-ai$/)
  await expect(heading(page, '이 질문은 어떻게 만들어지나요')).toBeVisible()

  await page.goto('/jobs/K-MOCK-0001')
  await expect(heading(page, '모집요강')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: '모집직종' }).first()).toContainText('응용 소프트웨어 개발자 (직종코드 133200)')
})

// ── V-15 최종 ③ 소제목 ───────────────────────────────────────

test('V-15 최종 ③ 소제목 "최종 면접에서 물을 것"·"처우 협의 때 물을 것": 처우 확인은 둘째 묶음, 나머지는 첫째 묶음, 개수 그대로', async ({ page }) => {
  await makeFinalQuestions(page)
  const all = await questionItems(page).count()
  const interview = page.getByRole('list', { name: '최종 면접에서 물을 것 목록' })
  const offer = page.getByRole('list', { name: '처우 협의 때 물을 것 목록' })
  await expect(page.getByRole('heading', { name: '최종 면접에서 물을 것' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '처우 협의 때 물을 것' })).toBeVisible()
  // 질문 항목은 질문마다 남는 "왜 이 질문인가요" 펼침으로 찾는다(6차 RS-01로 질문마다의 "복사"가 없어짐)
  const t1 = await itemTypes(interview.getByRole('listitem').filter({ has: page.getByText(WHY_TEXT) }), FINAL_TYPES)
  const t2 = await itemTypes(offer.getByRole('listitem').filter({ has: page.getByText(WHY_TEXT) }), FINAL_TYPES)
  expect(t1, '첫째 묶음 = API-07 순서에서 처우 확인을 뺀 것').toEqual(['다시 확인', '신호 확인', '범위 확인', '다시 확인'])
  expect(t2.length, '처우 확인 3개 이상').toBeGreaterThanOrEqual(3)
  expect(new Set(t2), '둘째 묶음은 처우 확인만').toEqual(new Set(['처우 확인']))
  expect(t1.length + t2.length, '개수 그대로').toBe(all)
  // 3차 r1 시험 수정(SPEC-ISSUES V-15): "한두 개만" 문장은 D-239로 오른쪽 상자로 옮겨 RS-05가 본다. 여기서는 묶음마다
  // 소제목 옆·아래(질문 목록 밖, 목록보다 위)에 보이는 안내 한 줄이 있는지 본다 — 문장 내용은 ACCEPTANCE에 없다
  for (const title of ['최종 면접에서 물을 것', '처우 협의 때 물을 것']) {
    const group = page.getByRole('region', { name: title, exact: true })
    await expect(group, `묶음 "${title}"(aria-labelledby 소제목)`).toHaveCount(1)
    const note = await group.evaluate((sec) => {
      const heading = sec.querySelector('h2, h3, h4')
      const list = sec.querySelector('ol, ul')
      if (!heading || !list) return ''
      const h = heading.getBoundingClientRect()
      const l = list.getBoundingClientRect()
      const out: string[] = []
      const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement
        if (!el || heading.contains(el) || list.contains(el)) continue
        const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!t) continue
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1 || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue
        if (r.top < h.top - 2 || r.bottom > l.top + 2) continue
        out.push(t)
      }
      return out.join(' ')
    })
    expect(note, `"${title}" 묶음 머리(소제목 옆·아래, 질문 목록 밖)에 보이는 안내 한 줄`).not.toBe('')
  }
})

// ── V-16 안내 문구 ───────────────────────────────────────────

// 6차 V-16 변경(2026-10-26): "면접에서 쓸 것 같아요"를 누르면 맨 위에 온다는 안내는 뺀다(RS-05)
test('V-16 ③ 오른쪽 상자 "면접에서는 보통 한두 개만 물을 수 있어요"·"기대되는 일을 묻는 질문부터" 안내("면접에서 쓸 것 같아요" 안내 없음), 주의할 답 설명은 "회사가 이렇게 답하면 … 회사의 흠은 아니에요"', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const side = page.getByRole('complementary').filter({ has: page.getByRole('button', { name: '전체 복사', exact: true }) })
  await expect(side, '③ 오른쪽 상자').toHaveCount(1)
  await expect(side).toContainText('면접에서는 보통 한두 개만 물을 수 있어요')
  await expect(side).toContainText('기대되는 일을 묻는 질문부터')
  await expect(side, '"면접에서 쓸 것 같아요" 안내 없음').not.toContainText('면접에서 쓸 것 같아요')
  const first = questionItems(page).first()
  await first.getByText('왜 이 질문인가요').click()
  await expect(first.getByText('회사가 이렇게 답하면 내 기대와 다를 수 있어요. 회사의 흠은 아니에요.')).toBeVisible()
})

// ── V-17·V-18 ② 안내·메타 줄 ─────────────────────────────────

test('V-17 ② 안내 끝에 "꼬리표는 AI가 찾은 확인할 점 · "모르겠어요"는 더 알고 싶은 일"', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await expect(page.getByText(/꼬리표는 AI가 찾은 확인할 점/).first()).toBeVisible()
  await expect(page.getByText(/"모르겠어요"는 더 알고 싶은 일/).first()).toBeVisible()
})

test('V-18 공고에 근거가 없는 카드 질문은 메타 줄에 "공고에 없음"(예시 A × OO소프트 3·4번), 근거가 있으면 없음', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const items = questionItems(page)
  for (const i of [2, 3]) await expect(items.nth(i).getByText(/공고에 없음/).filter({ visible: true }).first(), `${i + 1}번`).toBeVisible()
  for (const i of [0, 1]) await expect(items.nth(i).getByText(/공고에 없음/).filter({ visible: true }), `${i + 1}번`).toHaveCount(0)
})

// ── V-20 지난 단계 링크 ──────────────────────────────────────

test('V-20 단계 표시의 지난 단계는 링크(누르면 그 단계), 현재 단계는 링크가 아니다', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await expect(currentStep(page).getByRole('link')).toHaveCount(0)
  const past = stepList(page).getByRole('link', { name: /공고 확인/ })
  await expect(past).toBeVisible()
  await expect(stepList(page).getByRole('link')).toHaveCount(2)
  await past.click()
  await expectCurrentStep(page, '공고 확인')
  await expect(page).toHaveURL(/[?&]step=1(?:&|$)/)
})

// ── V-21 휴대폰 직무내용 쌓기 ─────────────────────────────────

test('V-21 휴대폰 ① 직무내용은 항목 이름 위·내용 아래(내용 폭 = 표 폭)', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 기준')
  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  const table = page.getByRole('table', { name: '공고 원문' })
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '직무내용' }) }).first()
  const th = await rectOf(row.getByRole('rowheader', { name: '직무내용' }))
  const td = await rectOf(row.getByRole('cell').first())
  const t = await rectOf(table)
  expect(th.bottom, '항목 이름이 위').toBeLessThanOrEqual(td.top + 1)
  expect(td.width, `내용 폭 ${Math.round(td.width)} ≈ 표 폭 ${Math.round(t.width)}`).toBeGreaterThanOrEqual(t.width - 2)
})

// ── V-22 AI 판단 문장 크기 ────────────────────────────────────

test('V-22 ① AI 판단 문장(확인할 점 설명)과 "AI 분석 요약" 도움말이 15px', async ({ page }) => {
  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  const analysis = readRepoJson('data/analysis/K-MOCK-0001.json') as { cards: Array<{ card_id: string; reason: string }> }
  const reason = analysis.cards.find((c) => c.card_id === 'BE07')?.reason ?? ''
  expect(reason).not.toBe('')
  const size = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize)
  const checks = page.locator('section').filter({ has: page.getByRole('heading', { name: 'AI가 찾은 확인할 점' }) }).first()
  expect(await size(checks.getByText(reason, { exact: true }).first()), '확인할 점 설명').toBe('15px')
  expect(await size(page.getByText(/공고 분석은 미리 만들어 둔 결과예요/).first().locator('xpath=..')), '요약 도움말').toBe('15px')
})

// ── V-23 예시 구직자 설명 ────────────────────────────────────

test('V-23 시연 도구 "예시 구직자 A/B로 채우기"에 둘의 차이를 말하는 설명 한 줄(접근 설명)', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await demoToolsButton(page).click()
  const a = page.getByRole('button', { name: '예시 구직자 A로 채우기', exact: true })
  const b = page.getByRole('button', { name: '예시 구직자 B로 채우기', exact: true })
  await expect(a).toHaveAccessibleDescription(/새 기능 개발을 기대하고/)
  await expect(b).toHaveAccessibleDescription(/배포·데이터 일을 기대하고/)
  await expect(page.getByText(/새 기능 개발을 기대하고/).first()).toBeVisible()
})
