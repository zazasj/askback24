/** 신뢰 페이지 /about-ai. ACCEPTANCE.md S4-24 [S]. */
import { expect, test, type Page } from '@playwright/test'
import { ABOUT_TITLE, heading, makeFirstQuestions } from './helpers'

test.use({ actionTimeout: 10_000 })
test.describe.configure({ timeout: 60_000 })

/** 제목 · 처리 단계 3개짜리 목록(메뉴 목록 제외) · "실제"·"모의"가 적힌 데이터 출처 표 */
async function expectAboutPage(page: Page) {
  await expect(heading(page, ABOUT_TITLE)).toBeVisible()

  const lists = page.getByRole('list')
  const n = await lists.count()
  const sizes: number[] = []
  for (let i = 0; i < n; i++) {
    const inNav = await lists.nth(i).evaluate((el) => el.closest('nav, [role="navigation"]') !== null)
    if (!inNav) sizes.push(await lists.nth(i).getByRole('listitem').count())
  }
  expect(sizes, `메뉴 밖 목록의 항목 수: ${sizes.join(', ')}`).toContain(3)

  const table = page.getByRole('table').filter({ hasText: '실제' }).filter({ hasText: '모의' }).first()
  await expect(table, '데이터 출처 표').toBeVisible()
  await expect(table.getByText('실제', { exact: true }).first()).toBeVisible()
  await expect(table.getByText('모의', { exact: true }).first()).toBeVisible()
}

test('S4-24 ③의 "이 질문은 어떻게 만들어지나요" → /about-ai, 제목·처리 단계 3개·데이터 출처 표', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('link', { name: ABOUT_TITLE }).click()
  await expect(page).toHaveURL(/\/about-ai(?:[?#].*)?$/)
  await expectAboutPage(page)
})

test('S4-24 /about-ai 를 주소로 바로 열어도 제목·처리 단계 3개·데이터 출처 표가 있다', async ({ page }) => {
  await page.goto('/about-ai')
  await expectAboutPage(page)
})
