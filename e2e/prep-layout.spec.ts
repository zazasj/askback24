/**
 * F-01~05 — 역질문 화면 정리(고용24 틀 유지). ACCEPTANCE.md 「2차 추가분 · F」.
 * "첫 화면" = 고정(fixed·sticky) 위·아래 띠를 뺀 지금 보이는 세로 범위. 데스크톱은 스크롤 맨 위, 휴대폰은 이동 직후 그대로.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  BANNER_TEXTS,
  FIRST_TYPES,
  MAIN_MENU,
  S1_URL,
  S2_TITLE,
  S4_TITLE_TEXT,
  cardGroups,
  copyQuestion,
  expectCurrentStep,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  gotoApplications,
  heading,
  listAfterHeading,
  makeFirstQuestions,
  makeQuestionsButton,
  normalize,
  openPrep,
  questionItems,
  stepText,
  stepUrl,
  waitFinalResults,
  waitFirstResults,
} from './helpers'
import {
  AI_SUMMARY_COUNT,
  AI_SUMMARY_TITLE,
  LEFT_MENU_ON,
  inBottomBar,
  insideBand,
  rectOf,
  scrollToBottom,
  scrollToTop,
  settleScroll,
  textUnderBottomBar,
  visibleBand,
  type Box,
} from './helpers2'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })
test.describe.configure({ timeout: 120_000 })

// ── F-01 공통 틀 ───────────────────────────────────────────────

type FrameItem = { key: string; loc: Locator; desktopOnly?: boolean }

function frameItems(page: Page): FrameItem[] {
  const main = page.getByRole('navigation', { name: '주 메뉴' })
  const side = page.getByRole('navigation', { name: '마이페이지 메뉴' })
  return [
    ...BANNER_TEXTS.map((t) => ({ key: `시연 띠 "${t}"`, loc: page.getByText(t).first() })),
    { key: '헤더 "고용24"', loc: page.getByText('고용24', { exact: true }).first() },
    { key: '헤더 배지 "시연"', loc: page.getByText('시연', { exact: true }).first() },
    { key: '헤더 "김00님"', loc: page.getByText('김00님').first() },
    { key: '주 메뉴', loc: main },
    ...MAIN_MENU.map((n) => ({ key: `주 메뉴 "${n}"`, loc: main.getByRole('link', { name: n, exact: true }).or(main.getByRole('button', { name: n, exact: true })).first() })),
    { key: '왼쪽 메뉴', loc: side, desktopOnly: true },
    ...LEFT_MENU_ON.map((n) => ({ key: `왼쪽 메뉴 "${n}"`, loc: side.getByRole('link', { name: n, exact: true }), desktopOnly: true })),
    { key: '경로 표시', loc: page.getByRole('navigation', { name: '현재 위치' }) },
  ]
}

test('F-01 S4 모든 단계(1차 ①②③·최종 ①②③)에 공통 틀(시연 띠·헤더·주 메뉴·왼쪽 메뉴·경로 표시)이 S1과 같이 있다', async ({ page, isMobile }) => {
  test.setTimeout(180_000)
  // 기준: S1 에서 보이는 틀(휴대폰 왼쪽 메뉴는 G-04처럼 보지 않는다)
  await gotoApplications(page)
  const baseline = new Map<string, boolean>()
  for (const item of frameItems(page)) {
    if (item.desktopOnly && isMobile) continue
    baseline.set(item.key, await item.loc.isVisible())
  }
  const notOnS1 = [...baseline].filter(([, v]) => !v).map(([k]) => k)
  if (!isMobile) expect(notOnS1, 'S1(데스크톱)에 공통 틀이 모두 보여야 한다').toEqual([])
  else if (notOnS1.length > 0) test.info().annotations.push({ type: '휴대폰 S1에 없는 틀(비교 안 함)', description: notOnS1.join(', ') })

  const check = async (step: string) => {
    for (const item of frameItems(page)) {
      if (!baseline.get(item.key)) continue
      await expect.soft(item.loc, `${step}: ${item.key}`).toBeVisible()
    }
    const last = page.getByRole('navigation', { name: '현재 위치' }).getByRole('listitem').last()
    await expect.soft(last, `${step}: 경로 표시 마지막 = "${S4_TITLE_TEXT}"(G-05)`).toContainText(S4_TITLE_TEXT)
  }

  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  await check('1차 ①')
  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expectCurrentStep(page, '내 기대·걱정')
  await check('1차 ②')
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await check('1차 ③')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await check('최종 ②')
  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
  await check('최종 ③')
  const base = await openPrep(page, 'commerce')
  if (!(await stepText(page)).includes('공고 확인')) await page.goto(stepUrl(base, 1))
  await expectCurrentStep(page, '공고 확인')
  await check('최종 ①')
})

test('F-01 S4 에서도 왼쪽 메뉴 두 링크가 동작한다(G-04 그대로)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'G-04와 같이 휴대폰은 왼쪽 메뉴가 선택 상자라 데스크톱에서 본다')
  const side = () => page.getByRole('navigation', { name: '마이페이지 메뉴' })
  await makeFirstQuestions(page, 'oo')
  await side().getByRole('link', { name: '이력서/자기소개서 관리', exact: true }).click()
  await expect(page).toHaveURL(/\/mypage\/resume(?:[?#].*)?$/)
  await expect(heading(page, S2_TITLE)).toBeVisible()
  await openPrep(page, 'oo')
  await side().getByRole('link', { name: '알선/입사지원 내역', exact: true }).click()
  await expect(page).toHaveURL(S1_URL)
})

// ── F-02·F-03 첫 화면 ──────────────────────────────────────────

/** 요소 안의 모든 요소(자신 포함)의 글과 상자 — 잰 다음에 복사(스크롤이 바뀔 수 있음)해서 문장 요소를 고른다. */
async function textBoxes(scope: Locator): Promise<Array<{ text: string; box: Box }>> {
  return scope.evaluate((root) =>
    [root, ...Array.from(root.querySelectorAll('*'))].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        box: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height },
      }
    }),
  )
}

const TYPE_CHIP = new RegExp(`^(?:${FIRST_TYPES.join('|')})$`)

test('F-02 ③ 첫 화면: 데스크톱 1440×900(스크롤 전) 1번 질문 문장 전체 + 2번 유형 칩, 휴대폰 390×844(③ 이동 직후) 1번 질문 문장 전체', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 })
  await makeFirstQuestions(page, 'oo')
  await settleScroll(page)
  if (!isMobile) await scrollToTop(page)
  const items = questionItems(page)
  await expect(items).toHaveCount(5)

  const band = await visibleBand(page)
  const boxes = await textBoxes(items.first())
  const chip = items.nth(1).getByText(TYPE_CHIP).filter({ visible: true }).first()
  const chipBox = isMobile ? null : await rectOf(chip)
  const scrollY = await page.evaluate(() => window.scrollY)

  const sentence = normalize(await copyQuestion(page, items.first()))
  const holder = boxes.filter((b) => b.text.includes(sentence) && b.box.height > 0).sort((a, b) => a.text.length - b.text.length)[0]
  expect(holder, `1번 질문 문장 "${sentence}"을 담은 요소`).toBeDefined()
  const where = `보이는 범위 ${Math.round(band.top)}~${Math.round(band.bottom)}px(스크롤 ${scrollY})`
  expect(
    insideBand(holder?.box ?? { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }, band),
    `1번 질문 문장 전체가 첫 화면 안에: 문장 ${Math.round(holder?.box.top ?? 0)}~${Math.round(holder?.box.bottom ?? 0)}px, ${where}`,
  ).toBe(true)
  if (chipBox) {
    expect(insideBand(chipBox, band), `2번 질문 유형 칩이 첫 화면 안에: 칩 ${Math.round(chipBox.top)}~${Math.round(chipBox.bottom)}px, ${where}`).toBe(true)
  }
})

/** ② 카드 상자(카드 radiogroup 하나만 품은 가장 큰 조상)의 위치 */
async function cardBoxes(page: Page): Promise<Box[]> {
  return cardGroups(page).evaluateAll((groups) =>
    groups.map((g) => {
      let box: Element = g
      while (box.parentElement && box.parentElement.querySelectorAll('[role="radiogroup"]').length === 1) box = box.parentElement
      const r = box.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }
    }),
  )
}

test('F-03 데스크톱 1440×900 첫 화면에 ② 카드 4개(2줄) 이상', async ({ page, isMobile }) => {
  test.skip(isMobile, '데스크톱 기준 항목')
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await settleScroll(page)
  await scrollToTop(page)
  const band = await visibleBand(page)
  const boxes = await cardBoxes(page)
  const inView = boxes.filter((b) => insideBand(b, band))
  expect(inView.length, `첫 화면 안에 다 보이는 카드 ${inView.length}개(보이는 범위 ${Math.round(band.top)}~${Math.round(band.bottom)}px, 첫 카드 ${Math.round(boxes[0]?.top ?? 0)}px)`).toBeGreaterThanOrEqual(4)
})

// ── F-04 AI 분석 요약 ──────────────────────────────────────────

const QUOTE_MARKS = /[“”"'‘’「」『』…]/g
const unquote = (s: string): string => normalize(s.replace(QUOTE_MARKS, ''))

function summaryBox(page: Page): Locator {
  return page
    .locator('*')
    .filter({ has: page.getByText(AI_SUMMARY_TITLE, { exact: true }) })
    .filter({ hasText: AI_SUMMARY_COUNT })
    .last()
}

test('F-04 ① 맨 위 "AI 분석 요약": "확인할 곳 N군데를 찾았어요"(N = 확인할 점 수) · 먼저 볼 두 곳(인용+이유) · 인용을 누르면 그 형광펜이 켜지고 그리로 스크롤', async ({ page }) => {
  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  await expect(page.getByText(AI_SUMMARY_TITLE, { exact: true }).first(), `"${AI_SUMMARY_TITLE}"`).toBeVisible()
  const box = summaryBox(page)
  await expect(box, '"AI 분석 요약" 상자(제목과 "확인할 곳 N군데를 찾았어요")').toBeVisible()

  // 맨 위: 상자 밖 첫 공고 형광펜보다 앞·위
  await expect(page.locator('mark').first()).toBeVisible()
  const order = await box.evaluate((b) => {
    const mark = Array.from(document.querySelectorAll('mark')).find((m) => !b.contains(m))
    if (!mark) return null
    return {
      before: (b.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      boxTop: b.getBoundingClientRect().top,
      markTop: mark.getBoundingClientRect().top,
    }
  })
  expect(order, '상자 밖 공고 형광펜').not.toBeNull()
  expect(order?.before, '"AI 분석 요약"이 공고(형광펜)보다 앞에 있어야 한다').toBe(true)
  expect(order?.boxTop ?? Infinity, '"AI 분석 요약"이 공고(형광펜)보다 위에 있어야 한다').toBeLessThan(order?.markTop ?? -Infinity)

  // N = "AI가 찾은 확인할 점" 수(접힌 것은 펼쳐서 센다)
  const n = Number(AI_SUMMARY_COUNT.exec(normalize(await box.innerText()))?.[1] ?? NaN)
  const morePoints = page.getByRole('button', { name: /확인할 점.*더 보기/ }).filter({ visible: true })
  const more = (await morePoints.count()) > 0 ? morePoints : page.getByRole('button', { name: /더 보기/ }).filter({ visible: true })
  if ((await more.count()) > 0) await more.first().click()
  const list = await listAfterHeading(page, 'AI가 찾은 확인할 점')
  const points = await list.getByRole('listitem').count()
  expect(n, `"확인할 곳 N군데"(${n})가 "AI가 찾은 확인할 점" 수(${points})와 같아야 한다`).toBe(points)

  // 먼저 볼 두 곳: 공고 형광펜 글을 인용한 컨트롤 2개 + 한 줄 이유
  const markTexts = (await page.locator('mark').allInnerTexts()).map(normalize).filter(Boolean)
  const controls = box.getByRole('button').or(box.getByRole('link'))
  const names = (await controls.allInnerTexts()).map(unquote)
  const quoteIdx = names.map((t, i) => (t && markTexts.some((m) => m.includes(t) || t.includes(m)) ? i : -1)).filter((i) => i >= 0)
  expect(quoteIdx.length, `공고 인용 컨트롤 2개(상자 안 컨트롤: ${names.join(' / ')})`).toBe(2)
  const quotes = quoteIdx.map((i) => controls.nth(i))
  for (const [k, q] of quotes.entries()) {
    const other = await quotes[1 - k]?.elementHandle()
    const boxHandle = await box.elementHandle()
    const itemText = await q.evaluate(
      (el, [o, root]) => {
        let n: Element = el
        while (n.parentElement && n.parentElement !== root && !(o && n.parentElement.contains(o))) n = n.parentElement
        return (n.textContent ?? '').replace(/\s+/g, ' ').trim()
      },
      [other ?? null, boxHandle] as const,
    )
    const quoteText = normalize(await q.innerText())
    expect(normalize(itemText.replace(quoteText, '')).length, `${k + 1}번째 곳에 한 줄 이유가 있어야 한다: "${itemText}"`).toBeGreaterThanOrEqual(4)
  }

  // 인용을 누르면 그 형광펜이 data-active="true" 가 되고 화면 안으로 온다
  for (const [k, q] of quotes.entries()) {
    const quoteText = unquote(await q.innerText())
    await scrollToTop(page)
    await q.click()
    const active = page.locator('mark[data-active="true"]')
    await expect(active.first(), `${k + 1}번째 인용 → 켜진 형광펜`).toBeVisible()
    const activeText = normalize(await active.first().innerText())
    expect(activeText.includes(quoteText) || quoteText.includes(activeText), `켜진 형광펜 "${activeText}"이 인용 "${quoteText}"와 같은 곳이어야 한다`).toBe(true)
    await expect
      .poll(async () => insideBand(await rectOf(active.first()), await visibleBand(page)), { message: `${k + 1}번째 인용 → 그 형광펜으로 스크롤` })
      .toBe(true)
  }
})

// ── F-05 아래 고정 바 ──────────────────────────────────────────

async function expectInBar(target: Locator, label: string): Promise<void> {
  const n = await target.count()
  let found = false
  for (let i = 0; i < n && !found; i++) found = (await target.nth(i).isVisible()) && (await inBottomBar(target.nth(i)))
  expect(found, `${label}이(가) 화면 아래 고정 바 안에 있어야 한다`).toBe(true)
}

/** 맨 아래까지 내렸을 때 화면 아래에 붙은 바 밑에 깔린 글이 없어야 한다(sticky 바가 제자리로 돌아가 붙어 있지 않으면 가릴 것도 없다). */
async function expectBarNotCovering(page: Page, step: string): Promise<void> {
  await scrollToBottom(page)
  const r = await textUnderBottomBar(page)
  if (r.barTop === null) test.info().annotations.push({ type: '고정 바', description: `${step}: 맨 아래에서는 바가 제자리(흐름 안)에 있음` })
  expect(r.covered, `${step}: 맨 아래까지 내렸을 때 고정 바에 가린 글`).toEqual([])
  await scrollToTop(page)
}

test('F-05 아래 고정 바: ① "내 기대·걱정 고르기", ② "N개 골랐어요"·"질문 만들기", ③ "전체 복사"·"면접 다녀왔어요", 마지막 내용을 가리지 않는다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  await settleScroll(page)
  await scrollToTop(page)
  await expectInBar(page.getByRole('button', { name: '내 기대·걱정 고르기' }), '① "내 기대·걱정 고르기"')
  await expectBarNotCovering(page, '①')

  await goToCardsStep(page, base)
  await fillPresetA(page)
  await settleScroll(page)
  await scrollToTop(page)
  await expectInBar(page.getByText(/\d+개 골랐어요/), '② "N개 골랐어요"')
  await expectInBar(makeQuestionsButton(page), '② "질문 만들기"')
  await expectBarNotCovering(page, '②')

  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await settleScroll(page)
  await scrollToTop(page)
  await expectInBar(page.getByRole('button', { name: '전체 복사' }), '③ "전체 복사"')
  await expectInBar(page.getByRole('button', { name: '면접 다녀왔어요' }), '③ "면접 다녀왔어요"')
  await expectBarNotCovering(page, '③')
})
