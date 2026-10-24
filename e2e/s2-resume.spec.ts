/** S2 — 이력서/자기소개서 관리. ACCEPTANCE.md 「S2」. */
import { expect, test, type Page } from '@playwright/test'
import { S2_SECTIONS, S2_TITLE, gotoApplications, heading, installPrintSpy, printCalls, sectionTexts } from './helpers'

test.use({ actionTimeout: 10_000 })

async function gotoResume(page: Page) {
  await page.goto('/mypage/resume')
  await expect(heading(page, S2_TITLE)).toBeVisible()
}

test('S2-01 왼쪽 메뉴 "이력서/자기소개서 관리" → 제목과 "김00님의 이력서입니다"', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 폭은 왼쪽 메뉴가 선택 상자로 바뀌므로 데스크톱에서 본다')
  await gotoApplications(page)
  await page.getByRole('navigation', { name: '마이페이지 메뉴' }).getByRole('link', { name: '이력서/자기소개서 관리' }).click()
  await expect(page).toHaveURL(/\/mypage\/resume(?:[?#].*)?$/)
  await expect(heading(page, S2_TITLE)).toBeVisible()
  await expect(page.getByText('김00님의 이력서입니다').first()).toBeVisible()
})

test('S2-01 /mypage/resume 를 바로 열어도 제목과 "김00님의 이력서입니다"', async ({ page }) => {
  await gotoResume(page)
  await expect(page.getByText('김00님의 이력서입니다').first()).toBeVisible()
})

test('S2-02 소제목 9개가 모두 있다', async ({ page }) => {
  await gotoResume(page)
  for (const name of S2_SECTIONS) await expect(heading(page, name), `소제목 "${name}"`).toBeVisible()
})

test('S2-03 "kim00@example.com"과 "010-0000-0000"이 보인다', async ({ page }) => {
  await gotoResume(page)
  await expect(page.getByText('kim00@example.com').first()).toBeVisible()
  await expect(page.getByText('010-0000-0000').first()).toBeVisible()
})

test('S2-04 경력은 없음(신입), 직업훈련에 FastAPI·AWS, 프로젝트에 DB 설계, 자격에 정보처리기사', async ({ page }) => {
  await gotoResume(page)
  for (const name of S2_SECTIONS) await expect(heading(page, name)).toBeVisible()
  const texts = await sectionTexts(page, S2_SECTIONS)
  const section = (name: (typeof S2_SECTIONS)[number]) => texts[S2_SECTIONS.indexOf(name)] ?? ''
  expect(section('경력'), '경력').toContain('경력 사항이 없어요')
  expect(section('직업훈련'), '직업훈련').toContain('FastAPI')
  expect(section('직업훈련'), '직업훈련').toContain('AWS')
  expect(section('프로젝트'), '프로젝트').toContain('DB 설계')
  expect(section('자격·어학'), '자격·어학').toContain('정보처리기사')
})

test('S2-05 "이력서 출력" → window.print 호출', async ({ page }) => {
  await installPrintSpy(page)
  await gotoResume(page)
  await page.getByRole('button', { name: '이력서 출력' }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
})
