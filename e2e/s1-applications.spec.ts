/** S1 — 알선/입사지원 내역(메인). ACCEPTANCE.md 「S1」. */
import { expect, test, type Page } from '@playwright/test'
import {
  COMPANY,
  FINAL_STEPS,
  MODE_FINAL,
  MODE_FIRST,
  S1_COLUMNS,
  S1_TITLE,
  S1_URL,
  applicationEntries,
  applicationPostingTitle,
  columnIndex,
  dataRows,
  gotoApplications,
  heading,
  modeRadio,
  normalize,
  openPrep,
  rowCells,
  stepList,
} from './helpers'

test.use({ actionTimeout: 10_000 })

const guideBanner = (page: Page) => page.getByText(/면접에서 물어볼 질문/).filter({ visible: true })

test('S1-01 / 로 들어오면 /mypage/applications 로 가고 제목은 "알선/입사지원 내역"', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(S1_URL)
  await expect(heading(page, S1_TITLE)).toBeVisible()
})

test('S1-02 표에 열 "회사명 / 지원공고" "지원일" "열람일" "지원결과" "면접 준비"', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 폭은 표가 카드로 바뀌므로(PLAN M6) 데스크톱에서 본다')
  await gotoApplications(page)
  for (const col of S1_COLUMNS) await expect(page.getByRole('columnheader', { name: col }), col).toBeVisible()
})

test('S1-03 처음 상태 3건: (주)OO소프트(서류합격) · (주)△△커머스(1차 합격) · (주)◇◇데이터(-)', async ({ page, isMobile }) => {
  await gotoApplications(page)
  const entries = applicationEntries(page)
  await expect(entries).toHaveCount(3)
  await expect(entries.nth(0)).toContainText(COMPANY.oo)
  await expect(entries.nth(0)).toContainText('서류합격')
  await expect(entries.nth(1)).toContainText(COMPANY.commerce)
  await expect(entries.nth(1)).toContainText('1차 합격')
  await expect(entries.nth(2)).toContainText(COMPANY.data)

  if (!isMobile) {
    const rows = dataRows(page)
    await expect(rows).toHaveCount(3)
    const result = await columnIndex(page, '지원결과')
    await expect(rowCells(rows.nth(0)).nth(result)).toHaveText('서류합격')
    await expect(rowCells(rows.nth(1)).nth(result)).toHaveText('1차 합격')
    await expect(rowCells(rows.nth(2)).nth(result)).toHaveText('-')
  }
})

test('S1-04 행마다 면접 준비 버튼: 1·3행 "면접 역질문 준비", 2행 "최종 면접 준비"', async ({ page }) => {
  await gotoApplications(page)
  const entries = applicationEntries(page)
  await expect(entries).toHaveCount(3)
  await expect(entries.nth(0).getByRole('button', { name: '면접 역질문 준비' })).toBeVisible()
  await expect(entries.nth(1).getByRole('button', { name: '최종 면접 준비' })).toBeVisible()
  await expect(entries.nth(2).getByRole('button', { name: '면접 역질문 준비' })).toBeVisible()
  await expect(entries.nth(0).getByRole('button', { name: '최종 면접 준비' })).toHaveCount(0)
  await expect(entries.nth(1).getByRole('button', { name: '면접 역질문 준비' })).toHaveCount(0)
})

test('S1-05 1행 버튼 → S4 ①(/mypage/applications/<id>/prep?step=1), 머리에 회사명·지원결과, "1차·기술 면접" 선택됨', async ({ page, isMobile }) => {
  await gotoApplications(page)
  const posting = isMobile ? '' : await applicationPostingTitle(page, 'oo')
  await applicationEntries(page).nth(0).getByRole('button', { name: '면접 역질문 준비' }).click()
  await expect(page).toHaveURL(/\/mypage\/applications\/[^/?#]+\/prep\?step=1(?:&|#|$)/)
  await expect(page.getByText(COMPANY.oo).first()).toBeVisible()
  await expect(page.getByText('서류합격').first()).toBeVisible()
  if (posting) await expect(page.getByText(posting).first(), `채용제목 "${posting}"`).toBeVisible()
  await expect(modeRadio(page, MODE_FIRST)).toBeChecked()
  await expect(modeRadio(page, MODE_FINAL)).not.toBeChecked()
})

test('S1-06 2행 "최종 면접 준비" → S4, "최종 면접·처우 협의" 선택됨, 단계 표시가 최종용', async ({ page }) => {
  await openPrep(page, 'commerce')
  await expect(modeRadio(page, MODE_FINAL)).toBeChecked()
  await expect(modeRadio(page, MODE_FIRST)).not.toBeChecked()
  const steps = stepList(page)
  for (const s of FINAL_STEPS) await expect(steps).toContainText(s)
  await expect(steps).not.toContainText('내 기대·걱정')
})

test('S1-07 처음 방문에 안내 띠가 보이고, "안내 닫기" 뒤 새로고침해도 다시 안 나온다', async ({ page }) => {
  await gotoApplications(page)
  await expect(guideBanner(page).first()).toBeVisible()
  await page.getByRole('button', { name: '안내 닫기' }).click()
  await expect(guideBanner(page)).toHaveCount(0)
  await page.reload()
  await expect(heading(page, S1_TITLE)).toBeVisible()
  await expect(applicationEntries(page).first()).toBeVisible()
  await expect(guideBanner(page)).toHaveCount(0)
})

test('S1-08 "검색어"에 "커머스" → "검색" → 1건', async ({ page }) => {
  await gotoApplications(page)
  await expect(applicationEntries(page)).toHaveCount(3)
  await page.getByLabel('검색어').fill('커머스')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(applicationEntries(page)).toHaveCount(1)
  await expect(applicationEntries(page).first()).toContainText(COMPANY.commerce)
})

type Ymd = [number, number, number]

function parseYmd(text: string): Ymd | null {
  const m = /(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(text)
  if (!m) return null
  const y = Number(m[1])
  return [y < 100 ? 2000 + y : y, Number(m[2]), Number(m[3])]
}

const dayNumber = ([y, m, d]: Ymd) => Date.UTC(y, m - 1, d) / 86_400_000

async function expectApplyDatesWithin30Days(page: Page) {
  const today = await page.evaluate((): [number, number, number] => {
    const d = new Date()
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
  })
  const col = await columnIndex(page, '지원일')
  const rows = dataRows(page)
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    const text = normalize(await rowCells(rows.nth(i)).nth(col).innerText())
    const date = parseYmd(text)
    expect(date, `${i + 1}행 지원일 "${text}"`).not.toBeNull()
    const diff = dayNumber(today) - dayNumber(date as Ymd)
    expect(diff, `${i + 1}행 지원일 "${text}" — 오늘(${today.join('-')})로부터 ${diff}일`).toBeGreaterThanOrEqual(0)
    expect(diff, `${i + 1}행 지원일 "${text}" — 오늘(${today.join('-')})로부터 ${diff}일`).toBeLessThanOrEqual(30)
  }
}

test('S1-09 지원일이 모두 오늘로부터 30일 안의 날짜다', async ({ page, isMobile }) => {
  test.skip(isMobile, '표의 지원일 칸을 읽으므로 데스크톱에서 본다')
  await gotoApplications(page)
  await expectApplyDatesWithin30Days(page)
})

test('S1-09 시계를 2027-03-15로 옮겨도 지원일이 그날로부터 30일 안이다(고정 날짜 아님)', async ({ page, isMobile }) => {
  test.skip(isMobile, '표의 지원일 칸을 읽으므로 데스크톱에서 본다')
  await page.clock.setFixedTime(new Date('2027-03-15T10:00:00+09:00'))
  await gotoApplications(page)
  await expectApplyDatesWithin30Days(page)
})
