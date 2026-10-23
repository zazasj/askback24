/**
 * 화면 캡처(디자인 검토용, docs/DESIGN-REVIEW.md). 단정은 넣지 않는다.
 * 화면마다 전체 페이지를 review/screens/<이름>-<프로젝트>.png 로 저장한다(desktop·mobile).
 * 준비 동작이 막혀도 그때 화면을 그대로 찍고, 막힌 까닭은 annotation 으로 남긴다.
 */
import { test, type Page, type TestInfo } from '@playwright/test'
import { join } from 'node:path'
import {
  ABOUT_TITLE,
  MISSING_PATH,
  NOT_FOUND_TEXT,
  REPO_ROOT,
  S2_TITLE,
  demoToolsButton,
  expectCurrentStep,
  fillReviewR04,
  goToCardsStep,
  gotoApplications,
  heading,
  jobDetailPaths,
  makeFinalQuestions,
  makeFirstQuestions,
  openPrep,
  questionItems,
} from './helpers'

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
