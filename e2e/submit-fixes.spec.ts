/**
 * SF — 제출일(2026-11-05) 고친 것: AI를 누를 때만, 한 번만 부르는지(F1·F2·F5)와 최종 만드는 중 떠날 때 확인 창(F3).
 * 가짜 응답 모드는 서버를 부르지 않아, 두 번 만들었는지는 문장으로 본다: 가짜 공급자는 같은 화면에서 두 번째로 만들면
 * 다른 문장을 낸다("AI로 다시 만들기"와 같음). 만드는 중 상태는 page.clock 을 멈춰 붙잡는다.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  expectCurrentStep,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  makeFirstQuestions,
  makeQuestionsButton,
  openPrep,
  questionItems,
  questionSentences,
  stepUrl,
  waitFinalResults,
  waitFirstResults,
} from './helpers'

const FIRST_GENERATING = '고른 카드와 공고를 맞춰 보고 있어요.'
const FINAL_GENERATING = '1차 면접에서 정리한 것을 내 기대와 맞춰 보고 있어요.'
const READY_TEXT = '아직 질문을 만들지 않았어요'
const finalButton = (page: Page) => page.getByRole('button', { name: '최종 질문 만들기', exact: true })

/** 시계를 멈춰 만드는 중(가짜 공급자 1.5초 기다림)을 붙잡는다 */
async function pauseClock(page: Page): Promise<void> {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
}

/** 이 지원 건의 1차 결과가 브라우저에 저장됐는지 */
async function savedFirst(page: Page, applyPath: string): Promise<boolean> {
  const id = applyPath.split('/').at(-2) ?? ''
  return page.evaluate((k) => {
    try {
      const book = JSON.parse(localStorage.getItem('rq:v1:questions') ?? '{}') as Record<string, unknown>
      return k in book
    } catch {
      return false
    }
  }, id)
}

test('SF-01 1차 ② → "질문 만들기"는 한 번 만든다. 만드는 중 뒤로 가면 "질문 만들기"가 눌리지 않고, 다 만든 뒤 눌러도 다시 만들지 않는다', async ({ page }) => {
  await page.clock.install()
  // 기준: 이 화면에서 처음 한 번 만든 문장
  const base = await makeFirstQuestions(page, 'oo')
  const once = await questionSentences(page)
  expect(once).toHaveLength(5)

  // 결과를 지우고 새로 연 화면에서(가짜 공급자 횟수도 처음부터) 만드는 중 뒤로 가기
  await page.evaluate(() => localStorage.removeItem('rq:v1:questions'))
  await page.goto(stepUrl(base, 2))
  await expectCurrentStep(page, '내 기대·걱정')
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await expect(page.getByText(FIRST_GENERATING)).toBeVisible()
  await pauseClock(page)
  await page.goBack()
  await expectCurrentStep(page, '내 기대·걱정')
  await expect(makeQuestionsButton(page), '만드는 중에는 "질문 만들기"를 누르지 못한다').toBeDisabled()

  await page.clock.resume()
  await expect(makeQuestionsButton(page), '다 만들면 다시 누를 수 있다').toBeEnabled({ timeout: 15_000 })
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  expect(await questionSentences(page), '한 번만 만들었으면 기준과 같은 문장(두 번 만들면 문장이 바뀐다)').toEqual(once)

  // 대조: "AI로 다시 만들기"는 그대로 다시 만들어 문장이 바뀐다
  await page.getByRole('button', { name: 'AI로 다시 만들기' }).click()
  await expect(page.getByText(FIRST_GENERATING)).toBeVisible()
  await expect(page.getByText(FIRST_GENERATING)).toHaveCount(0, { timeout: 15_000 })
  await expect(questionItems(page)).toHaveCount(5)
  expect(await questionSentences(page), '다시 만들면 다른 문장').not.toEqual(once)
})

test('SF-02 고른 카드는 있고 결과는 없는 채 ③ 주소로 바로 열면 만들지 않고 "질문 만들기"를 보인다. 누르면 만든다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await fillPresetA(page)
  await page.goto(stepUrl(base, 3))
  await expectCurrentStep(page, '질문 받기')
  await expect(page.getByText(READY_TEXT)).toBeVisible()
  await expect(page.getByText(FIRST_GENERATING), '저절로 만들지 않는다').toHaveCount(0)
  // 가짜 공급자가 다 만들 시간(1.5초)이 지나도 결과가 없다
  await page.waitForTimeout(2_500)
  await expect(questionItems(page)).toHaveCount(0)
  expect(await savedFirst(page, base), '저장된 결과 없음').toBe(false)

  await makeQuestionsButton(page).click()
  await expect(page.getByText(FIRST_GENERATING)).toBeVisible()
  await waitFirstResults(page)
  await expect(questionItems(page)).toHaveCount(5)
  expect(await savedFirst(page, base)).toBe(true)
})

test('SF-03 1차 만드는 중 새로고침하면 다시 만들지 않고 "질문 만들기"를 보인다', async ({ page }) => {
  await page.clock.install()
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await expect(page.getByText(FIRST_GENERATING)).toBeVisible()
  await pauseClock(page)
  await page.reload()
  await page.clock.resume()
  await expectCurrentStep(page, '질문 받기')
  await expect(page.getByText(READY_TEXT)).toBeVisible()
  await page.waitForTimeout(2_500)
  await expect(page.getByText(FIRST_GENERATING), '새로고침 뒤 저절로 만들지 않는다').toHaveCount(0)
  await expect(questionItems(page)).toHaveCount(0)
  expect(await savedFirst(page, base)).toBe(false)
  await expect(makeQuestionsButton(page)).toBeEnabled()
})

test('SF-04 최종 만드는 중: 뒤로 가면 "최종 질문 만들기"가 눌리지 않고, ③에서 떠나면 확인 창(beforeunload). 다 만든 뒤에는 확인 창 없음', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.type())
    void d.accept()
  })
  await page.clock.install()
  const base = await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)

  await finalButton(page).click()
  await expect(page.getByText(FINAL_GENERATING)).toBeVisible()
  await pauseClock(page)
  await page.goBack()
  await expectCurrentStep(page, '1차 면접 정리')
  await expect(finalButton(page), '만드는 중에는 "최종 질문 만들기"를 누르지 못한다').toBeDisabled()
  await page.goForward()
  await expectCurrentStep(page, '최종 질문 받기')
  await expect(page.getByText(FINAL_GENERATING)).toBeVisible()
  expect(dialogs, '앱 안 이동에는 확인 창 없음').toEqual([])

  // 만드는 중 새로고침 → 확인 창(정리 입력과 만들던 질문이 사라진다)
  await page.reload()
  await expect.poll(() => dialogs, { message: '만드는 중 떠날 때 확인 창' }).toContain('beforeunload')
  await page.clock.resume()

  // 다 만든 뒤에는 결과가 저장되어 확인 창 없음(정리 입력은 새로고침으로 지워져 다시 채운다)
  await page.goto(stepUrl(base, 2, '&mode=final'))
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)
  await finalButton(page).click()
  await waitFinalResults(page)
  const before = dialogs.length
  await page.reload()
  await waitFinalResults(page)
  expect(dialogs.length, '다 만든 뒤 새로고침에는 확인 창 없음').toBe(before)
})
