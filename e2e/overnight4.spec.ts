/**
 * 4차 밤샘(PLAN-4) 새 동작 시험 — F4 단계 디자인(T6 · C4-05 · COPY-4 A4-76). 11-02 세진이 시안 C로 정함(D-394).
 * 최종 단계 화면은 강조색이 청록(--rq-final*), 1차는 보라 그대로. 두 단계 모두 단계 표시줄 위에 얇은 단계 머리띠.
 * 시안 바꾸기(시연 도구 「단계 디자인 시안」·주소 ?look=·sessionStorage rq:v1:look)는 지웠다.
 * 인쇄·가짜 응답 모드 영향 없음, 휴대폰 가로 넘침 없음, 움직임 없음, 글자 대비 4.5:1 이상.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  MODE_FINAL,
  MODE_FIRST,
  currentStep,
  demoToolsButton,
  expectCurrentStep,
  fillReviewR04,
  horizontalOverflow,
  makeFinalQuestions,
  makeFirstQuestions,
  modeGroup,
  namedGroup,
  openPrep,
  questionItems,
  seriousAxeViolations,
  switchMode,
  waitFinalResults,
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

/** 지운 시안 스위치가 쓰던 탭 저장 키 */
const OLD_LOOK_KEY = 'rq:v1:look'

/** 단계 머리띠. 휴대폰·낮은 화면에서 단계를 옮길 때 스크롤하는 자리라 id가 있다 */
function band(page: Page): Locator {
  return page.locator('#prep-stage-band')
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

/** 머리띠 위끝이 화면 맨 위 근처(0~40px)인지 */
async function expectBandAtTop(page: Page, label: string): Promise<void> {
  await settleScroll(page)
  const box = await band(page).boundingBox()
  expect(box && box.y >= 0 && box.y <= 40, `${label}: 머리띠 위끝 y=${box?.y}(화면 맨 위 근처)`).toBe(true)
}

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  const o = await horizontalOverflow(page)
  expect(o.scrollWidth, `${label} 가로 넘침`).toBeLessThanOrEqual(o.innerWidth)
}

test('C4-05 1차는 보라 머리띠와 보라 강조색, 최종은 청록 머리띠와 청록 단계 번호·고른 「최종 면접·처우 협의」. 단계를 바꾸면 바로 바뀐다', async ({
  page,
  isMobile,
}) => {
  const base = await openPrep(page, 'oo')
  await expect(band(page), '1차 ① 머리띠').toHaveText(BAND_TEXT.first)
  expect(await accentOf(page), '1차 ① 단계 표시줄').toBe(PURPLE)
  expect(await backgroundOf(stepNo(page)), '1차 ① 지금 단계 번호').toBe(PURPLE)
  expect(await backgroundOf(selectedMode(page)), '고른 「1차·기술 면접」').toBe(PURPLE)
  expect(await backgroundOf(band(page)), '1차 머리띠 바탕(보라 옅은 색)').toBe(BAND_BG.first)

  await switchMode(page, MODE_FINAL)
  await expect(band(page), '최종 ① 머리띠').toHaveText(BAND_TEXT.final)
  expect(await accentOf(page), '최종 ① 단계 표시줄').toBe(TEAL)
  expect(await backgroundOf(stepNo(page)), '최종 ① 지금 단계 번호').toBe(TEAL)
  expect(await backgroundOf(selectedMode(page)), '고른 「최종 면접·처우 협의」').toBe(TEAL)
  expect(await backgroundOf(band(page)), '최종 머리띠 바탕(청록 옅은 색)').toBe(BAND_BG.final)
  if (!isMobile) {
    const box = await band(page).boundingBox()
    expect(box && box.height < 40, `데스크톱 머리띠는 얇다(높이 ${box?.height}px)`).toBe(true)
  }

  await switchMode(page, MODE_FIRST)
  await expect(band(page), '다시 1차').toHaveText(BAND_TEXT.first)
  expect(await accentOf(page)).toBe(PURPLE)

  // 주소로 최종 ①을 열어도 같다
  await openStep1(page, base, '&mode=final')
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  expect(await accentOf(page)).toBe(TEAL)
})

test('C4-05 시연 도구에 「단계 디자인 시안」이 없고, 주소 ?look= 를 붙여도 아무것도 바뀌지 않는다(data-look 없음)', async ({ page }) => {
  const base = await openPrep(page, 'oo')

  await demoToolsButton(page).click()
  const panel = page.locator('#demo-tools-panel')
  await expect(panel).toBeVisible()
  for (const name of ['안내 다시 보기', '시연 초기화']) await expect(panel.getByRole('button', { name, exact: true }), `공통 버튼 「${name}」은 그대로`).toBeVisible()
  await expect(namedGroup(page, '단계 디자인 시안'), '시안 묶음 없음').toHaveCount(0)
  await expect(panel.getByText('단계 디자인 시안'), '시안 글자 없음').toHaveCount(0)
  await expect(panel.getByRole('radio'), '시연 도구에 라디오 없음').toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // 지운 시안 값마다 "그 시안이었다면 달랐을 것"을 본다: a는 띠 없음 · b는 최종도 보라 · now는 띠 없고 보라
  for (const look of ['a', 'b', 'now', 'C']) {
    await openStep1(page, base, `&mode=final&look=${look}`)
    await expect(band(page), `?look=${look} · 최종 머리띠 그대로`).toHaveText(BAND_TEXT.final)
    expect(await accentOf(page), `?look=${look} · 최종 청록 그대로`).toBe(TEAL)
    expect(await page.locator('.s4').getAttribute('data-look'), `?look=${look} · data-look 없음`).toBeNull()
  }
  await openStep1(page, base, '&look=a')
  await expect(band(page), '?look=a · 1차 머리띠 그대로').toHaveText(BAND_TEXT.first)
  expect(await accentOf(page), '?look=a · 1차 보라 그대로').toBe(PURPLE)
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

test('C4-05 글자 대비: 1차·최종에서 머리띠 이름·목적, 단계 번호·이름, 고른 "준비할 면접"이 4.5:1 이상', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  for (const mode of ['first', 'final'] as const) {
    await openStep1(page, base, `&mode=${mode}`)
    await expect(band(page)).toHaveText(BAND_TEXT[mode])
    const step = currentStep(page).first()
    const targets: Array<[string, Locator]> = [
      ['머리띠 이름', band(page).locator('strong')],
      ['머리띠 목적', band(page).getByText(BAND_TEXT[mode].split(' — ')[1] ?? '')],
      ['지금 단계 번호', step.locator('.no')],
      ['지금 단계 이름', step.locator('.label')],
      ['고른 "준비할 면접"', selectedMode(page)],
    ]
    for (const [name, t] of targets) {
      const ratio = await contrastOf(t)
      expect(ratio, `${mode} · ${name} 대비 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  }
})

test('C4-05 접근성: 머리띠가 있는 최종 ③에 axe 심각 위반이 없다', async ({ page }) => {
  await makeFinalQuestions(page)
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  expect(await seriousAxeViolations(page)).toEqual([])
})

test('C4-05 휴대폰 375px: 가로로 넘치지 않고, 단계를 옮기면 머리띠부터 보인다(1차 ② · 최종 ②)', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 프로젝트만')
  const base = await openPrep(page, 'oo')
  await openStep1(page, base, '')
  await expectNoOverflow(page, '1차 ①')
  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expectCurrentStep(page, '내 기대·걱정')
  await expectBandAtTop(page, '1차 ②로 옮긴 뒤')
  await expect(band(page)).toHaveText(BAND_TEXT.first)
  await expectNoOverflow(page, '1차 ②')

  await makeFirstQuestions(page, 'oo')
  await expectNoOverflow(page, '1차 ③')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await expectBandAtTop(page, '최종 ②로 옮긴 뒤')
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  await expectNoOverflow(page, '최종 ②')

  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
  await settleScroll(page)
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  await expectNoOverflow(page, '최종 ③')
})

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' })

  test('C4-05 움직임 줄이기 설정에서 1차·최종을 오가도 머리띠·단계 표시에 움직임(애니메이션·전환)이 없다', async ({ page }) => {
    const base = await openPrep(page, 'oo')
    await openStep1(page, base, '&mode=final')
    for (const [label, mode] of [
      ['최종', null],
      ['1차', MODE_FIRST],
      ['다시 최종', MODE_FINAL],
    ] as const) {
      if (mode) await switchMode(page, mode)
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
  })
})
