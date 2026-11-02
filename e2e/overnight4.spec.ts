/**
 * 4차 밤샘(PLAN-4) 새 동작 시험 — F4 단계 디자인(T6 · C4-05 · COPY-4 A4-76). 11-02 세진이 시안 C로 정함(D-408).
 * 최종 단계는 ①②③ 모두 강조색이 청록(--rq-final*), 1차는 보라 그대로. 얇은 단계 머리띠는 ③ 질문 화면에만(①②는 첫 화면 기준 V-06·F-03 때문에 없음).
 * 휴대폰에서 ③으로 옮기면 머리띠부터, ①②로 옮기면 단계 표시부터 보인다.
 * 시안 바꾸기(시연 도구 「단계 디자인 시안」·주소 ?look=·sessionStorage rq:v1:look)는 지웠다.
 * 인쇄·가짜 응답 모드 영향 없음, 휴대폰 가로 넘침 없음, 움직임 없음, 글자 대비 4.5:1 이상.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  MODE_FINAL,
  currentStep,
  demoToolsButton,
  expectCurrentStep,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  horizontalOverflow,
  makeFinalQuestions,
  makeFirstQuestions,
  makeQuestionsButton,
  modeGroup,
  namedGroup,
  openPrep,
  questionItems,
  seriousAxeViolations,
  stepUrl,
  switchMode,
  waitFinalResults,
  waitFirstResults,
} from './helpers'
import { settleScroll } from './helpers2'

test.use({ actionTimeout: 15_000, navigationTimeout: 20_000 })
test.describe.configure({ timeout: 120_000 })

/** 1차 보라(--rq-accent #6645c0)와 최종 단계 청록(--rq-final #0b6b62) */
const PURPLE = 'rgb(102, 69, 192)'
const TEAL = 'rgb(11, 107, 98)'
/** 머리띠 바탕: 1차 --rq-accent-subtle #f3effc · 최종 --rq-final-subtle #e0f3f0 */
const BAND_BG = { first: 'rgb(243, 239, 252)', final: 'rgb(224, 243, 240)' } as const

/** COPY-4 A4-76 */
const BAND_TEXT = {
  first: '1차·기술 면접 준비 — 맡게 될 업무를 면접관에게 묻는 질문',
  final: '최종 면접·처우 협의 준비 — 1차에서 남은 것과 근무 조건을 확인하는 질문',
} as const

type Stage = keyof typeof BAND_TEXT

/** 지운 시안 스위치가 쓰던 탭 저장 키 */
const OLD_LOOK_KEY = 'rq:v1:look'

/** 단계 머리띠(③에만). 휴대폰에서 ③으로 옮길 때 스크롤하는 자리라 id가 있다 */
function band(page: Page): Locator {
  return page.locator('#prep-stage-band')
}

/** 단계 표시(StepNav). ①②로 옮길 때 스크롤하는 자리 */
function steps(page: Page): Locator {
  return page.locator('#prep-steps')
}

function selectedMode(page: Page): Locator {
  return modeGroup(page).locator('input:checked + .chip')
}

function stepNo(page: Page): Locator {
  return currentStep(page).first().locator('.no')
}

/** 지금 단계의 아래 줄 색 = 강조색 */
async function accentOf(page: Page): Promise<string> {
  return currentStep(page)
    .first()
    .evaluate((el) => getComputedStyle(el).borderBottomColor)
}

async function backgroundOf(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).backgroundColor)
}

/** 글자색과 (자신이나 조상의) 바탕색으로 WCAG 대비를 잰다 */
async function contrastOf(target: Locator): Promise<number> {
  return target.evaluate((el) => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const [r = 0, g = 0, b = 0, a = 1] = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number)
      return { r, g, b, a }
    }
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 }
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0) {
        bg = c
        break
      }
    }
    const fg = parse(getComputedStyle(el).color) ?? { r: 0, g: 0, b: 0, a: 1 }
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  })
}

async function openStep1(page: Page, base: string, query: string): Promise<void> {
  await page.goto(`${base}?step=1${query}`)
  await expectCurrentStep(page, '공고 확인')
}

/** 최종 ②(1차 면접 정리)에서 예시로 채우고 최종 ③까지 */
async function makeFinalFromReview(page: Page): Promise<void> {
  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
}

/** 머리띠(bandOf: 그 단계 띠, null: 띠 없음)와 강조색(단계 표시줄·지금 단계 번호·고른 "준비할 면접") */
async function expectStage(page: Page, label: string, bandOf: Stage | null, color: string): Promise<void> {
  if (bandOf) {
    await expect(band(page), `${label} 머리띠`).toHaveText(BAND_TEXT[bandOf])
    expect(await backgroundOf(band(page)), `${label} 머리띠 바탕`).toBe(BAND_BG[bandOf])
  } else {
    await expect(band(page), `${label}: 머리띠 없음`).toHaveCount(0)
  }
  expect(await accentOf(page), `${label} 단계 표시줄`).toBe(color)
  expect(await backgroundOf(stepNo(page)), `${label} 지금 단계 번호`).toBe(color)
  expect(await backgroundOf(selectedMode(page)), `${label} 고른 "준비할 면접"`).toBe(color)
}

/** 위끝이 화면 맨 위 근처(0~40px)인지 */
async function expectAtTop(page: Page, target: Locator, label: string): Promise<void> {
  await settleScroll(page)
  const box = await target.boundingBox()
  expect(box && box.y >= 0 && box.y <= 40, `${label} 위끝 y=${box?.y}(화면 맨 위 근처)`).toBe(true)
}

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  const o = await horizontalOverflow(page)
  expect(o.scrollWidth, `${label} 가로 넘침`).toBeLessThanOrEqual(o.innerWidth)
}

test('C4-05 머리띠는 ③ 질문 화면에만: 1차 ①·②는 띠 없이 보라, 1차 ③ 보라 띠. 최종 ①·②도 띠는 없지만 단계 표시·번호·고른 「최종 면접·처우 협의」가 청록, 최종 ③ 청록 띠', async ({
  page,
  isMobile,
}) => {
  const base = await openPrep(page, 'oo')
  await expectStage(page, '1차 ①', null, PURPLE)
  await goToCardsStep(page, base)
  await expectStage(page, '1차 ②', null, PURPLE)
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expectStage(page, '1차 ③', 'first', PURPLE)

  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await expectStage(page, '최종 ②', null, TEAL)
  await openStep1(page, base, '&mode=final')
  await expectStage(page, '최종 ①', null, TEAL)
  await page.getByRole('button', { name: '1차 면접 정리하기' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await makeFinalFromReview(page)
  await expectStage(page, '최종 ③', 'final', TEAL)
  if (!isMobile) {
    const box = await band(page).boundingBox()
    expect(box && box.height < 40, `데스크톱 머리띠는 얇다(높이 ${box?.height}px)`).toBe(true)
  }

  // "준비할 면접"을 바꾸면 색이 바로 바뀐다(① · 띠 없음)
  await openStep1(page, base, '&mode=first')
  expect(await accentOf(page), '다시 1차 ①').toBe(PURPLE)
  await switchMode(page, MODE_FINAL)
  await expect(band(page)).toHaveCount(0)
  expect(await accentOf(page), '최종으로 바꾼 즉시').toBe(TEAL)
})

test('C4-05 시연 도구에 「단계 디자인 시안」이 없고, 주소 ?look= 를 붙여도 아무것도 바뀌지 않는다(data-look 없음)', async ({ page }) => {
  const base = await makeFirstQuestions(page, 'oo')

  await demoToolsButton(page).click()
  const panel = page.locator('#demo-tools-panel')
  await expect(panel).toBeVisible()
  for (const name of ['안내 다시 보기', '시연 초기화']) await expect(panel.getByRole('button', { name, exact: true }), `공통 버튼 「${name}」은 그대로`).toBeVisible()
  await expect(namedGroup(page, '단계 디자인 시안'), '시안 묶음 없음').toHaveCount(0)
  await expect(panel.getByText('단계 디자인 시안'), '시안 글자 없음').toHaveCount(0)
  await expect(panel.getByRole('radio'), '시연 도구에 라디오 없음').toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // 지운 시안 값마다 "그 시안이었다면 달랐을 것"을 본다: a·now는 띠 없음, b는 최종도 보라
  for (const look of ['a', 'b', 'now', 'C']) {
    await page.goto(stepUrl(base, 3, `&mode=first&look=${look}`))
    await expect(band(page), `?look=${look} · 1차 ③ 머리띠 그대로`).toHaveText(BAND_TEXT.first)
    expect(await accentOf(page), `?look=${look} · 1차 보라 그대로`).toBe(PURPLE)
    expect(await page.locator('.s4').getAttribute('data-look'), `?look=${look} · data-look 없음`).toBeNull()
  }
  await openStep1(page, base, '&mode=final&look=b')
  await expect(band(page), '?look=b · 최종 ① 띠 없음 그대로').toHaveCount(0)
  expect(await accentOf(page), '?look=b · 최종 청록 그대로').toBe(TEAL)
  expect(await page.locator('.s4').getAttribute('data-look')).toBeNull()
  expect(await page.evaluate((k) => sessionStorage.getItem(k), OLD_LOOK_KEY), '탭 저장 키를 쓰지 않는다').toBeNull()
})

test('C4-05 최종 ③: 화면은 청록·머리띠, "기대와 다름" 점은 보라, 가짜 응답 모드 태그 그대로. 인쇄에는 머리띠가 없고 색은 보라', async ({ page }) => {
  await makeFinalQuestions(page)

  await expect(band(page)).toHaveText(BAND_TEXT.final)
  const printBtn = page.getByRole('button', { name: '면접에 들고 갈 한 장 인쇄' })
  expect(await backgroundOf(printBtn), '인쇄 버튼').toBe(TEAL)
  const rank = questionItems(page).first().locator('.num')
  expect(await backgroundOf(rank), '질문 번호(화면)').toBe(TEAL)
  const mismatch = page.locator('.stat').filter({ hasText: '기대와 다름' }).first()
  expect(await mismatch.evaluate((el) => getComputedStyle(el, '::before').backgroundColor), '"기대와 다름" 점은 우리 기능 보라 그대로').toBe(PURPLE)
  await expect(page.getByText('가짜 응답 모드 · AI 대신 규칙과 예시 문장').first(), '가짜 응답 모드 태그').toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(band(page), '인쇄: 머리띠 없음').toBeHidden()
  expect(await backgroundOf(rank), '인쇄: 질문 번호는 보라').toBe(PURPLE)
  expect(await page.locator('.s4').evaluate((el) => getComputedStyle(el).getPropertyValue('--rq-accent').trim()), '인쇄: 강조색 토큰').toBe('#6645c0')

  await page.emulateMedia({ media: 'screen' })
  await expect(band(page)).toBeVisible()
  expect(await backgroundOf(rank)).toBe(TEAL)
})

test('C4-05 글자 대비: 1차 ③ · 최종 ② · 최종 ③에서 머리띠 이름·목적, 단계 번호·이름, 고른 "준비할 면접"이 4.5:1 이상', async ({ page }) => {
  const check = async (label: string, bandOf: Stage | null) => {
    const step = currentStep(page).first()
    const targets: Array<[string, Locator]> = [
      ['지금 단계 번호', step.locator('.no')],
      ['지금 단계 이름', step.locator('.label')],
      ['고른 "준비할 면접"', selectedMode(page)],
    ]
    if (bandOf) {
      await expect(band(page)).toHaveText(BAND_TEXT[bandOf])
      targets.push(['머리띠 이름', band(page).locator('strong')], ['머리띠 목적', band(page).getByText(BAND_TEXT[bandOf].split(' — ')[1] ?? '')])
    }
    for (const [name, t] of targets) {
      const ratio = await contrastOf(t)
      expect(ratio, `${label} · ${name} 대비 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  }
  await makeFirstQuestions(page, 'oo')
  await check('1차 ③', 'first')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await check('최종 ②', null)
  await makeFinalFromReview(page)
  await check('최종 ③', 'final')
})

test('C4-05 접근성: 머리띠가 있는 최종 ③에 axe 심각 위반이 없다', async ({ page }) => {
  await makeFinalQuestions(page)
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  expect(await seriousAxeViolations(page)).toEqual([])
})

test('C4-05 휴대폰 375px: 가로로 넘치지 않고, ③으로 옮기면 머리띠부터, ②로 옮기면 단계 표시부터 보인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 프로젝트만')
  const base = await openPrep(page, 'oo')
  await openStep1(page, base, '')
  await expect(band(page), '1차 ① 띠 없음').toHaveCount(0)
  await expectNoOverflow(page, '1차 ①')

  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expectCurrentStep(page, '내 기대·걱정')
  await expectAtTop(page, steps(page), '1차 ②로 옮긴 뒤 단계 표시')
  await expect(band(page), '1차 ② 띠 없음').toHaveCount(0)
  await expectNoOverflow(page, '1차 ②')

  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expectAtTop(page, band(page), '1차 ③으로 옮긴 뒤 머리띠')
  await expect(band(page)).toHaveText(BAND_TEXT.first)
  await expectNoOverflow(page, '1차 ③')

  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await expectAtTop(page, steps(page), '최종 ②로 옮긴 뒤 단계 표시')
  await expect(band(page), '최종 ② 띠 없음').toHaveCount(0)
  await expectNoOverflow(page, '최종 ②')

  await makeFinalFromReview(page)
  await expectAtTop(page, band(page), '최종 ③으로 옮긴 뒤 머리띠')
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  await expectNoOverflow(page, '최종 ③')
})

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' })

  test('C4-05 움직임 줄이기 설정에서 1차 ③ · 최종 ② · 최종 ③으로 옮겨도 머리띠·단계 표시에 움직임(애니메이션·전환)이 없다', async ({ page }) => {
    const measure = async (label: string) => {
      const moving = await page.locator('.s4').evaluate((root) => {
        const els = [root, ...root.querySelectorAll('#prep-stage-band, #prep-stage-band *, #prep-steps, #prep-steps *')]
        const anim = root.getAnimations({ subtree: true }).length
        // base.css 움직임 줄이기 규칙이 남기는 0.01ms는 움직임으로 보지 않는다
        const seconds = (d: string) => parseFloat(d) * (d.trim().endsWith('ms') ? 0.001 : 1)
        const trans = els.filter((el) => {
          const s = getComputedStyle(el)
          return s.transitionDuration.split(',').some((d) => seconds(d) > 0.001) || s.animationName !== 'none'
        }).length
        return { anim, trans }
      })
      expect(moving, `${label}: 움직임 없음`).toEqual({ anim: 0, trans: 0 })
    }
    await makeFirstQuestions(page, 'oo')
    await expect(band(page)).toHaveText(BAND_TEXT.first)
    await measure('1차 ③')
    await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
    await expectCurrentStep(page, '1차 면접 정리')
    await measure('최종 ②')
    await makeFinalFromReview(page)
    await expect(band(page)).toHaveText(BAND_TEXT.final)
    await measure('최종 ③')
  })
})
