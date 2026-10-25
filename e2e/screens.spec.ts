/**
 * 화면 캡처(디자인 검토용, docs/DESIGN-REVIEW.md). 단정은 넣지 않는다.
 * 화면마다 전체 페이지를 review/screens/<이름>-<프로젝트>.png 로 저장한다(desktop·mobile).
 * 준비 동작이 막혀도 그때 화면을 그대로 찍고, 막힌 까닭은 annotation 으로 남긴다.
 */
import { test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { join } from 'node:path'
import {
  ABOUT_TITLE,
  MISSING_PATH,
  NOT_FOUND_TEXT,
  REPO_ROOT,
  S2_TITLE,
  demoToolsButton,
  expectCurrentStep,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  gotoApplications,
  heading,
  jobDetailPaths,
  makeFinalQuestions,
  makeFirstQuestions,
  makeQuestionsButton,
  openPrep,
  questionItems,
  stepText,
  stepUrl,
  waitFirstResults,
} from './helpers'
import { AI_SUMMARY_COUNT, AI_SUMMARY_TITLE, MAIN_MENU_OFF, S2_BUTTONS_OFF, control, keyboardFocus, mainMenuItem, scrollToTop, settleScroll } from './helpers2'

test.use({ actionTimeout: 15_000, navigationTimeout: 20_000 })
test.describe.configure({ timeout: 120_000 })

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.screenshot({
    path: join(REPO_ROOT, 'review', 'screens', `${name}-${testInfo.project.name}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

const SCREENS: ReadonlyArray<{ name: string; setup: (page: Page) => Promise<void> }> = [
  { name: 's1-applications', setup: (page) => gotoApplications(page) },
  {
    name: 's2-resume',
    setup: async (page) => {
      await page.goto('/mypage/resume')
      await heading(page, S2_TITLE).waitFor()
    },
  },
  {
    name: 's3-jobs',
    setup: async (page) => {
      await jobDetailPaths(page)
    },
  },
  {
    name: 's3-job-detail',
    setup: async (page) => {
      const [first] = await jobDetailPaths(page)
      await page.goto(first ?? '/jobs')
      await heading(page, '모집요강').waitFor()
    },
  },
  {
    name: 's4-first-1-posting',
    setup: async (page) => {
      await openPrep(page, 'oo')
      await expectCurrentStep(page, '공고 확인')
    },
  },
  {
    name: 's4-first-2-cards',
    setup: async (page) => {
      const base = await openPrep(page, 'oo')
      await goToCardsStep(page, base)
    },
  },
  {
    name: 's4-first-2-demo-tools-open',
    setup: async (page) => {
      const base = await openPrep(page, 'oo')
      await goToCardsStep(page, base)
      await demoToolsButton(page).click()
    },
  },
  { name: 's4-first-3-questions-A', setup: async (page) => void (await makeFirstQuestions(page, 'oo')) },
  {
    name: 's4-first-3-why-open',
    setup: async (page) => {
      await makeFirstQuestions(page, 'oo')
      await questionItems(page).first().getByText('왜 이 질문인가요').first().click()
    },
  },
  { name: 's4-first-3-fallback', setup: async (page) => void (await makeFirstQuestions(page, 'oo', { apiFail: true })) },
  {
    name: 's4-final-2-review-R04',
    setup: async (page) => {
      await makeFirstQuestions(page, 'oo')
      await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
      await expectCurrentStep(page, '1차 면접 정리')
      await fillReviewR04(page)
    },
  },
  { name: 's4-final-3-questions', setup: async (page) => void (await makeFinalQuestions(page)) },
  {
    name: 'about-ai',
    setup: async (page) => {
      await page.goto('/about-ai')
      await heading(page, ABOUT_TITLE).waitFor()
    },
  },
  {
    name: 'not-found',
    setup: async (page) => {
      await page.goto(MISSING_PATH)
      await page.getByText(NOT_FOUND_TEXT).first().waitFor()
    },
  },
]

for (const screen of SCREENS) {
  test(`SCREENS ${screen.name}`, async ({ page }, testInfo) => {
    try {
      await screen.setup(page)
    } catch (e) {
      testInfo.annotations.push({ type: 'screen-setup-failed', description: String(e).slice(0, 800) })
    }
    await capture(page, testInfo, screen.name)
  })
}

// ── 2차 화면(2026-10-25): 흐림 표시·첫 화면·AI 분석 요약·긴 글 공고·출처 표 ──────────
// shot: full = 전체 페이지, view = 지금 보이는 첫 화면(스크롤 전), element = 그 부분만

type Shot2 = {
  name: string
  shot: 'full' | 'view' | 'element'
  setup: (page: Page, isMobile: boolean) => Promise<Locator | void>
}

/** 데스크톱은 스크롤 맨 위, 휴대폰은 이동 직후 그대로를 "첫 화면"으로 본다(F-02와 같음). */
async function firstView(page: Page, isMobile: boolean): Promise<void> {
  await settleScroll(page)
  if (!isMobile) await scrollToTop(page)
}

/** 흐린 컨트롤에 마우스(데스크톱)나 초점(휴대폰)을 줘서 "시연 범위 밖이에요" 설명을 띄운다. */
async function showTip(page: Page, target: Locator, isMobile: boolean): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  if (isMobile) await keyboardFocus(target)
  else await target.hover()
  await page.waitForTimeout(400)
}

const SCREENS_2: ReadonlyArray<Shot2> = [
  {
    name: '2-demo-off-main-menu-tip',
    shot: 'view',
    setup: async (page, isMobile) => {
      await gotoApplications(page)
      await showTip(page, mainMenuItem(page, MAIN_MENU_OFF[0]), isMobile)
    },
  },
  {
    name: '2-demo-off-resume-tip',
    shot: 'view',
    setup: async (page, isMobile) => {
      await page.goto('/mypage/resume')
      await heading(page, S2_TITLE).waitFor()
      await showTip(page, control(page, S2_BUTTONS_OFF[2]).filter({ visible: true }).first(), isMobile)
    },
  },
  {
    name: '2-s4-first-1-first-view',
    shot: 'view',
    setup: async (page, isMobile) => {
      await openPrep(page, 'oo')
      await expectCurrentStep(page, '공고 확인')
      await firstView(page, isMobile)
    },
  },
  {
    name: '2-s4-first-2-first-view',
    shot: 'view',
    setup: async (page, isMobile) => {
      const base = await openPrep(page, 'oo')
      await goToCardsStep(page, base)
      await firstView(page, isMobile)
    },
  },
  {
    name: '2-s4-first-3-first-view',
    shot: 'view',
    setup: async (page, isMobile) => {
      await makeFirstQuestions(page, 'oo')
      await firstView(page, isMobile)
    },
  },
  {
    name: '2-s4-final-3-first-view',
    shot: 'view',
    setup: async (page, isMobile) => {
      await makeFinalQuestions(page)
      await firstView(page, isMobile)
    },
  },
  {
    name: '2-s4-first-1-ai-summary',
    shot: 'element',
    setup: async (page) => {
      await openPrep(page, 'oo')
      await expectCurrentStep(page, '공고 확인')
      return page
        .locator('*')
        .filter({ has: page.getByText(AI_SUMMARY_TITLE, { exact: true }) })
        .filter({ hasText: AI_SUMMARY_COUNT })
        .last()
    },
  },
  {
    name: '2-s4-first-1-posting-data',
    shot: 'full',
    setup: async (page) => {
      await openPrep(page, 'data')
      await expectCurrentStep(page, '공고 확인')
    },
  },
  {
    name: '2-s4-final-1-posting-commerce',
    shot: 'full',
    setup: async (page) => {
      const base = await openPrep(page, 'commerce')
      if (!(await stepText(page)).includes('공고 확인')) await page.goto(stepUrl(base, 1))
      await expectCurrentStep(page, '공고 확인')
    },
  },
  ...Array.from({ length: 7 }, (_v, i): Shot2 => ({
    name: `2-s3-job-detail-${i + 1}`,
    shot: 'full',
    setup: async (page) => {
      const paths = await jobDetailPaths(page)
      const path = paths[i]
      if (!path) throw new Error(`상세 링크가 ${paths.length}개뿐이다`)
      await page.goto(path)
      await heading(page, '모집요강').waitFor()
    },
  })),
  {
    name: '2-about-ai-sources',
    shot: 'element',
    setup: async (page) => {
      await page.goto('/about-ai')
      await heading(page, ABOUT_TITLE).waitFor()
      return page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: '받은 날짜' }) }).first()
    },
  },
]

for (const screen of SCREENS_2) {
  test(`SCREENS ${screen.name}`, async ({ page, isMobile }, testInfo) => {
    let part: Locator | void = undefined
    try {
      part = await screen.setup(page, isMobile)
    } catch (e) {
      testInfo.annotations.push({ type: 'screen-setup-failed', description: String(e).slice(0, 800) })
    }
    const path = join(REPO_ROOT, 'review', 'screens', `${screen.name}-${testInfo.project.name}.png`)
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    if (screen.shot === 'element' && part) {
      try {
        await part.screenshot({ path, animations: 'disabled', timeout: 10_000 })
        return
      } catch (e) {
        testInfo.annotations.push({ type: 'screen-element-failed', description: String(e).slice(0, 800) })
      }
    }
    await page.screenshot({ path, fullPage: screen.shot !== 'view', animations: 'disabled' })
  })
}

// ── 낮은 노트북 화면·브라우저 확대(V-06, 2026-10-25 H1-02·H2-12): 데스크톱만, 첫 화면 그대로 ──────────
const LOW_SCREENS = [
  { width: 1366, height: 657 },
  { width: 1152, height: 720 },
  { width: 960, height: 600 },
] as const

for (const size of LOW_SCREENS) {
  const tag = `3-low-${size.width}x${size.height}`
  test(`SCREENS ${tag} S1 → ② → ③ 첫 화면`, async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, '노트북·확대 폭은 데스크톱 프로젝트에서')
    const shot = (name: string) =>
      page.screenshot({ path: join(REPO_ROOT, 'review', 'screens', `${tag}-${name}.png`), animations: 'disabled' })
    await page.setViewportSize({ width: size.width, height: size.height })
    try {
      await gotoApplications(page)
      await shot('s1')
      await page.getByRole('button', { name: '바로 해 보기' }).click()
      await expectCurrentStep(page, '공고 확인')
      await settleScroll(page)
      await shot('s4-first-1')
      await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
      await expectCurrentStep(page, '내 기대·걱정')
      await settleScroll(page)
      await shot('s4-first-2')
      await fillPresetA(page)
      await makeQuestionsButton(page).click()
      await waitFirstResults(page)
      await settleScroll(page)
      await shot('s4-first-3')
    } catch (e) {
      testInfo.annotations.push({ type: 'screen-setup-failed', description: String(e).slice(0, 800) })
      await shot('failed')
    }
  })
}
