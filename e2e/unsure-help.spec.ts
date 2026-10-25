/**
 * U — "모르겠어요" 돕기(2026-10-25, D-175·176). ACCEPTANCE 「3차 추가분」.
 * ② 카드의 "예를 들면"(예시·용어 풀이)과 ③ 1차 결과의 "더 알아볼 질문".
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  PRESET_A,
  cardGroup,
  fillPresetA,
  goToCardsStep,
  heading,
  makeFirstQuestions,
  makeQuestionsButton,
  openPrep,
  pickRadio,
  questionItems,
  readClipboard,
  showAllCards,
  waitFirstResults,
} from './helpers'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })

/** 카드 하나(카드 이름 제목과 "예를 들면"을 함께 가진 가장 안쪽 상자) */
function cardBox(page: Page, name: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .filter({ has: page.getByText('예를 들면', { exact: true }) })
    .last()
}

const BE01_EXAMPLE = '회원가입·결제 같은 새 기능의 API를 만든다'

test('U-01 ② 카드마다 "예를 들면" — 처음엔 접혀 있고, 펼치면 예시 2개와 용어 풀이', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  const card = cardBox(page, '신규 API 개발')
  await expect(card.getByText('예를 들면', { exact: true })).toBeVisible()
  await expect(card.getByText(BE01_EXAMPLE)).toBeHidden()
  await card.getByText('예를 들면', { exact: true }).click()
  await expect(card.getByText(BE01_EXAMPLE)).toBeVisible()
  await expect(card.getByText('앱·웹 화면이 호출할 데이터를 서버에서 내려준다')).toBeVisible()
  const terms = card.getByLabel('용어 풀이')
  await expect(terms).toBeVisible()
  await expect(terms).toContainText('API')
  await expect(terms).toContainText('약속된 창구')
})

test('U-02 ② "모르겠어요"를 고르면 그 카드의 "예를 들면"이 펼쳐진다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  const card = cardBox(page, '신규 API 개발')
  await expect(card.getByText(BE01_EXAMPLE)).toBeHidden()
  await pickRadio(cardGroup(page, '신규 API 개발'), '모르겠어요')
  await expect(card.getByText(BE01_EXAMPLE)).toBeVisible()
})

test('U-03 ③ 예시 A × OO소프트: 질문 5개 아래 "더 알아볼 질문" 3개(공고에 나온 모르겠어요 카드 순), 5개와 겹치지 않음', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await expect(questionItems(page)).toHaveCount(5)
  await expect(heading(page, '더 알아볼 질문')).toBeVisible()
  await expect(page.getByText('배우려는 태도')).toBeVisible()
  const list = page.getByRole('list', { name: '더 알아볼 질문 목록' })
  const items = list.getByRole('listitem')
  await expect(items).toHaveCount(3)
  // H2-07 ③(세진 승인 2026-10-25): 공고에 적힌 카드(산출물 작성)가 유추한 카드(SQL·요구사항 협의)보다 먼저
  const expected = ['개발 문서·산출물 작성', 'SQL 작성·쿼리 개선', '요구사항 협의']
  for (const [i, name] of expected.entries()) {
    await expect(items.nth(i)).toContainText(name)
    await expect(items.nth(i)).toContainText('탐색')
  }
  const fiveText = (await questionItems(page).allInnerTexts()).join('\n')
  for (const name of expected) expect(fiveText, `${name}이 질문 5개에도 있다`).not.toContain(name)
})

test('U-04 ③ "모르겠어요"를 고르지 않으면 "더 알아볼 질문"이 없다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await pickRadio(cardGroup(page, '신규 API 개발'), '기대돼요')
  await pickRadio(cardGroup(page, '기존 시스템 유지보수'), '걱정돼요')
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expect(heading(page, '더 알아볼 질문')).toHaveCount(0)
})

test('U-05 ③ 더 알아볼 질문의 "복사" → 그 질문 문장이 클립보드에', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  const item = page.getByRole('list', { name: '더 알아볼 질문 목록' }).getByRole('listitem').first()
  const text = (await item.locator('p').nth(1).innerText()).trim()
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await item.getByRole('button', { name: '개발 문서·산출물 작성 질문 복사' }).click()
  await expect.poll(() => readClipboard(page)).toBe(text)
})

/** 카드 하나(카드 이름 제목과 그 카드 radiogroup을 함께 가진 가장 안쪽 상자) — "예를 들면"이 없는 카드도 찾는다 */
function cardByName(page: Page, name: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .filter({ has: page.getByRole('radiogroup', { name, exact: true }) })
    .last()
}

test('U-06 ② "기대돼요"·"걱정돼요" 카드에는 "예를 들면"이 없고, 옆 카드가 펼쳐져도 높이가 늘지 않는다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await showAllCards(page)
  const chosen = [...PRESET_A.expect, ...PRESET_A.worry]
  const before = new Map<string, number>()
  for (const name of chosen) before.set(name, (await cardByName(page, name).boundingBox())?.height ?? 0)

  await fillPresetA(page)
  for (const name of chosen) {
    const card = cardByName(page, name)
    await expect(card.getByRole('button', { name: '예를 들면' }), `${name}: 예를 들면 없음`).toHaveCount(0)
    const h = (await card.boundingBox())?.height ?? 0
    expect(h, `${name}: 처음 ${before.get(name)}px → ${h}px`).toBeLessThanOrEqual((before.get(name) ?? 0) + 2)
  }
  // 모르겠어요 카드는 펼쳐져 있다(U-02)
  const unsure = cardByName(page, PRESET_A.unknown[0])
  await expect(unsure.getByRole('button', { name: '예를 들면' })).toHaveAttribute('aria-expanded', 'true')
})
