/** G — 공통. ACCEPTANCE.md 「G — 공통」. */
import { expect, test } from '@playwright/test'
import {
  BANNER_TEXTS,
  COMPANY,
  MAIN_MENU,
  MISSING_PATH,
  NOT_FOUND_TEXT,
  OUT_OF_SCOPE,
  S1_TITLE,
  S1_URL,
  S2_TITLE,
  S4_TITLE_TEXT,
  SCREEN_TITLES,
  TITLE_SUFFIX,
  acceptDialogs,
  applicationEntries,
  applyToPosting,
  blockStorage,
  currentStep,
  demoItem,
  demoToolsButton,
  experienceInput,
  govTextFound,
  gotoApplications,
  heading,
  horizontalOverflow,
  makeFirstQuestions,
  makeQuestionsButton,
  openPrep,
  piiProblems,
  postingTitle,
  questionItems,
  seriousAxeViolations,
  stepText,
  stepUrl,
  tourScreens,
  trackPageErrors,
} from './helpers'

test.use({ actionTimeout: 10_000 })

const TOUR_TIMEOUT = 240_000

test('G-01 모든 경로에 시연 띠 두 문구가 보인다', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    for (const text of BANNER_TEXTS) {
      await expect.soft(page.getByText(text).first(), `${name}: 시연 띠 "${text}"`).toBeVisible()
    }
  })
})

test('G-02 어느 화면에도 "공식 전자정부 누리집", "누리집입니다" 문구가 없다', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    expect.soft(await govTextFound(page), `${name}: 공식 누리집 문구`).toEqual([])
  })
  await demoToolsButton(page).click()
  expect.soft(await govTextFound(page), '시연 도구를 연 상태').toEqual([])
})

test('G-03 주 메뉴 다섯 항목 · "채용정보"는 /jobs · 나머지는 범위 밖 알림이 뜨고 주소가 그대로', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 폭은 주 메뉴가 접혀 모양이 정해져 있지 않아 데스크톱에서 본다')
  await gotoApplications(page)
  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  const item = (name: string) => nav.getByRole('link', { name, exact: true }).or(nav.getByRole('button', { name, exact: true })).first()
  for (const name of MAIN_MENU) await expect(item(name), `주 메뉴 "${name}"`).toBeVisible()

  for (const name of MAIN_MENU.slice(1)) {
    const before = page.url()
    await item(name).click()
    await expect(page.getByRole('status').filter({ hasText: OUT_OF_SCOPE }).first(), `"${name}" → 알림`).toBeVisible()
    expect(page.url(), `"${name}" 뒤 주소`).toBe(before)
  }

  await item('채용정보').click()
  await expect(page).toHaveURL(/\/jobs(?:[?#].*)?$/)
})

test('G-04 마이페이지 왼쪽 메뉴 두 링크가 동작하고 현재 화면 링크에 aria-current="page"', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 폭은 왼쪽 메뉴가 선택 상자로 바뀌므로(PLAN M6) 데스크톱에서 본다')
  await gotoApplications(page)
  const nav = page.getByRole('navigation', { name: '마이페이지 메뉴' })
  const apps = nav.getByRole('link', { name: '알선/입사지원 내역' })
  const resume = nav.getByRole('link', { name: '이력서/자기소개서 관리' })
  await expect(apps).toHaveAttribute('aria-current', 'page')
  await expect(resume).not.toHaveAttribute('aria-current', 'page')

  await resume.click()
  await expect(page).toHaveURL(/\/mypage\/resume(?:[?#].*)?$/)
  await expect(heading(page, S2_TITLE)).toBeVisible()
  await expect(resume).toHaveAttribute('aria-current', 'page')
  await expect(apps).not.toHaveAttribute('aria-current', 'page')

  await apps.click()
  await expect(page).toHaveURL(S1_URL)
  await expect(heading(page, S1_TITLE)).toBeVisible()
  await expect(apps).toHaveAttribute('aria-current', 'page')
})

test('G-05 경로 표시의 마지막 항목이 화면 제목과 같다(S1·S2·S4)', async ({ page }) => {
  const lastCrumb = () => page.getByRole('navigation', { name: '현재 위치' }).getByRole('listitem').last()

  await gotoApplications(page)
  await expect(lastCrumb(), 'S1').toContainText(S1_TITLE)

  await page.goto('/mypage/resume')
  await expect(heading(page, S2_TITLE)).toBeVisible()
  await expect(lastCrumb(), 'S2').toContainText(S2_TITLE)

  await openPrep(page, 'oo')
  await expect(lastCrumb(), 'S4').toContainText(S4_TITLE_TEXT)
})

test('G-06 문서 제목이 "<화면 제목> | 고용24 (시연)" 형식이다', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    const title = name === 's3-job-detail' ? await postingTitle(page) : SCREEN_TITLES[name]
    await expect.soft(page, `${name}: 문서 제목`).toHaveTitle(`${title}${TITLE_SUFFIX}`)
  })
})

test('G-07 모든 경로에 가로 스크롤이 없다(scrollWidth <= innerWidth)', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    const { scrollWidth, innerWidth } = await horizontalOverflow(page)
    expect.soft(scrollWidth, `${name}: scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(innerWidth)
  })
})

test('G-08 모든 경로를 주소로 바로 열거나 새로고침해도 같은 화면이 나온다', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    const url = page.url()
    const title = await page.title()
    const step = (await currentStep(page).count()) > 0 ? await stepText(page) : null
    for (const how of ['주소로 열기', '새로고침'] as const) {
      if (how === '주소로 열기') await page.goto(url)
      else await page.reload()
      const label = `${name} ${how}`
      await expect.soft(page.getByText(BANNER_TEXTS[0]).first(), `${label}: 시연 띠`).toBeVisible()
      await expect.soft(page, `${label}: 문서 제목`).toHaveTitle(title)
      if (step !== null) {
        await expect.soft(currentStep(page), `${label}: 현재 단계`).toHaveText(step, { useInnerText: true })
      }
      if (name !== 'not-found') {
        await expect.soft(page.getByText(NOT_FOUND_TEXT), `${label}: 404가 아니어야`).toHaveCount(0)
      }
    }
  })
})

test('G-08 없는 주소는 404 화면이고 "알선/입사지원 내역으로" 링크로 돌아간다', async ({ page }) => {
  for (const path of [MISSING_PATH, '/mypage/no-such-menu']) {
    await page.goto(path)
    await expect(page.getByText(NOT_FOUND_TEXT).first(), path).toBeVisible()
    for (const text of BANNER_TEXTS) await expect(page.getByText(text).first()).toBeVisible()
  }
  await page.getByRole('link', { name: '알선/입사지원 내역으로' }).click()
  await expect(page).toHaveURL(S1_URL)
  await expect(heading(page, S1_TITLE)).toBeVisible()
})

test('G-09 모든 경로에서 콘솔 오류·처리 안 된 예외가 0건', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  const errors = trackPageErrors(page)
  await tourScreens(page, async () => {})
  expect(errors).toEqual([])
})

test('G-10 모든 경로에서 axe critical·serious 위반 0건', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    expect.soft(await seriousAxeViolations(page), `${name}: axe`).toEqual([])
  })
})

test('G-11 화면에 실제 개인정보 모양이 없다(이메일 @example.com, 전화 010-0000-0000만)', async ({ page }) => {
  test.setTimeout(TOUR_TIMEOUT)
  await tourScreens(page, async (name) => {
    expect.soft(await piiProblems(page), `${name}: 개인정보 모양`).toEqual([])
  })
})

test('G-12 "시연 도구" → "시연 초기화"로 지원 내역·선택·결과·안내 띠가 처음으로 돌아간다', async ({ page }) => {
  test.setTimeout(120_000)
  acceptDialogs(page)
  const guide = () => page.getByText(/면접에서 물어볼 질문/).filter({ visible: true })

  // 바꿔 놓기: 안내 띠 닫기 · 입사지원 1건 · S4 선택·결과
  await gotoApplications(page)
  await expect(guide().first()).toBeVisible()
  await page.getByRole('button', { name: '안내 닫기' }).click()
  await expect(guide()).toHaveCount(0)
  await applyToPosting(page)
  await gotoApplications(page)
  await expect(applicationEntries(page)).toHaveCount(4)
  await makeFirstQuestions(page, 'oo')
  await expect(questionItems(page)).toHaveCount(5)

  // 시연 도구에 두 버튼이 있고, "시연 초기화"를 누른다
  await demoToolsButton(page).click()
  await expect(demoItem(page, '안내 다시 보기')).toBeVisible()
  await expect(demoItem(page, '시연 초기화')).toBeVisible()
  await demoItem(page, '시연 초기화').click()

  // 처음 상태
  await gotoApplications(page)
  await expect(applicationEntries(page)).toHaveCount(3)
  await expect(applicationEntries(page).first()).toContainText(COMPANY.oo)
  await expect(guide().first()).toBeVisible()

  const base = await openPrep(page, 'oo')
  await page.goto(stepUrl(base, 3))
  await expect(currentStep(page)).toHaveCount(1)
  await expect(questionItems(page), '결과가 지워져야 한다').toHaveCount(0)

  await page.goto(stepUrl(base, 2))
  await expect(currentStep(page)).toContainText('내 기대·걱정')
  await expect(makeQuestionsButton(page), '선택이 지워져 "질문 만들기"가 비활성').toBeDisabled()
  await expect(experienceInput(page)).toHaveValue('')
})

test('G-13 localStorage 가 막혀도 화면이 깨지지 않고 S1 → S4 ③ 흐름이 돈다', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackPageErrors(page, false)
  await blockStorage(page)
  await gotoApplications(page)
  await expect(applicationEntries(page)).toHaveCount(3)
  await makeFirstQuestions(page, 'oo')
  await expect(questionItems(page)).toHaveCount(5)
  expect(errors, '처리 안 된 예외').toEqual([])
})
