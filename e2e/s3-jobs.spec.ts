/** S3 — 채용정보 · 입사지원 [S]. ACCEPTANCE.md 「S3」. */
import { expect, test } from '@playwright/test'
import {
  PREP_URL,
  S3_SECTIONS,
  S3_TITLE,
  STEP_RE,
  applicationEntries,
  applyButton,
  applyToPosting,
  columnIndex,
  dataRows,
  escapeRe,
  findUnappliedPosting,
  gotoApplications,
  heading,
  jobDetailPaths,
  postingTitle,
  rowCells,
  toast,
} from './helpers'

test.use({ actionTimeout: 10_000 })

test('S3-01 /jobs 제목 "채용정보", 공고 6건 이상, 각 공고가 상세로 연결된다', async ({ page }) => {
  test.setTimeout(90_000)
  const paths = await jobDetailPaths(page)
  await expect(heading(page, S3_TITLE)).toBeVisible()
  expect(paths.length, `상세 링크: ${paths.join(', ')}`).toBeGreaterThanOrEqual(6)
  for (const p of paths) {
    await page.goto(p)
    await expect(heading(page, '모집요강'), p).toBeVisible()
    await expect(page.getByText('모의 공고', { exact: true }).first(), p).toBeVisible()
  }
})

test('S3-01 목록의 공고를 누르면 그 공고 상세(/jobs/:id)로 간다', async ({ page }) => {
  const [first] = await jobDetailPaths(page)
  const link = page.getByRole('link').filter({ visible: true })
  const hrefs = await link.evaluateAll((els) => els.map((e) => new URL((e as HTMLAnchorElement).href || '/', location.href).pathname))
  const index = hrefs.indexOf(first ?? '')
  expect(index, '상세 링크가 화면에 보여야 한다').toBeGreaterThanOrEqual(0)
  await link.nth(index).click()
  await expect(page).toHaveURL(new RegExp(`${escapeRe(first ?? "")}(?:[?#].*)?$`))
  await expect(heading(page, '모집요강')).toBeVisible()
})

test('S3-02 상세에 채용제목 제목, 소제목 "모집요강" "근무조건" "기업정보", 배지 "모의 공고"', async ({ page }) => {
  const [first] = await jobDetailPaths(page)
  await page.goto(first ?? '/jobs')
  for (const name of S3_SECTIONS) await expect(heading(page, name), `소제목 "${name}"`).toBeVisible()
  await expect(page.getByText('모의 공고', { exact: true }).first()).toBeVisible()
  const title = await postingTitle(page)
  await expect(heading(page, title)).toBeVisible()
  // 같은 채용제목이 목록에도 있다
  await page.goto('/jobs')
  await expect(page.getByText(title).first()).toBeVisible()
})

test('S3-03 지원 안 한 공고 "입사지원" → 대화상자 "입사지원"(김00 이력서) → "지원하기" → 알림 "지원했어요"', async ({ page }) => {
  await findUnappliedPosting(page)
  await applyButton(page).first().click()
  const dialog = page.getByRole('dialog', { name: '입사지원' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('김00 이력서').first()).toBeVisible()
  await dialog.getByRole('button', { name: '지원하기', exact: true }).click()
  await expect(toast(page, '지원했어요')).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('S3-04 지원 뒤 지원 내역이 4건, 맨 위가 방금 지원한 공고, 지원결과 "-"', async ({ page, isMobile }) => {
  const { title } = await applyToPosting(page)
  await gotoApplications(page)
  const entries = applicationEntries(page)
  await expect(entries).toHaveCount(4)
  await expect(entries.first()).toContainText(title)
  if (!isMobile) {
    const result = await columnIndex(page, '지원결과')
    await expect(rowCells(dataRows(page).first()).nth(result)).toHaveText('-')
  }
})

test('S3-05 지원한 공고 상세로 돌아가면 버튼이 "지원 완료"(비활성)', async ({ page }) => {
  const { path } = await applyToPosting(page)
  await page.goto('/jobs')
  await page.goto(path)
  await expect(heading(page, '모집요강')).toBeVisible()
  const done = page.getByRole('button', { name: '지원 완료' }).first()
  await expect(done).toBeVisible()
  await expect(done).toBeDisabled()
  await expect(applyButton(page)).toHaveCount(0)
})

test('S3-06 새 행의 "면접 역질문 준비" → S4 ①에 그 공고와 형광펜(<mark> 1개 이상)', async ({ page }) => {
  const { title } = await applyToPosting(page)
  await gotoApplications(page)
  const entry = applicationEntries(page).first()
  await expect(entry).toContainText(title)
  await entry.getByRole('button', { name: '면접 역질문 준비' }).click()
  await expect(page).toHaveURL(PREP_URL)
  await expect(page).toHaveURL(STEP_RE(1))
  await expect(page.getByText(title).first()).toBeVisible()
  await expect.poll(() => page.locator('mark').count(), { message: '<mark> 형광펜' }).toBeGreaterThanOrEqual(1)
})
