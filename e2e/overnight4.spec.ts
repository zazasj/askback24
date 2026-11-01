/**
 * 4차 밤샘(PLAN-4) 새 동작 시험 — F4 단계 디자인 시안(T6 · C4-05 · COPY-4 A4-76).
 * 시연 도구 「단계 디자인 시안: 지금 · A · B · C」와 주소 ?look=a|b|c. 기본은 "지금"(바꾸지 않음), 고른 값은 같은 탭에 남고, "시연 초기화"하면 "지금".
 * A·C는 최종 단계에서만 강조색이 청록, B·C는 단계 표시줄 위 머리띠. 인쇄·가짜 응답 모드 영향 없음, 휴대폰 가로 넘침 없음, 움직임 없음, 글자 대비 4.5:1 이상.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  MODE_FINAL,
  MODE_FIRST,
  S1_URL,
  currentStep,
  demoToolsButton,
  expectCurrentStep,
  gotoApplications,
  horizontalOverflow,
  makeFinalQuestions,
  modeGroup,
  namedGroup,
  openPrep,
  pickRadio,
  questionItems,
  seriousAxeViolations,
  switchMode,
} from './helpers'
import { settleScroll } from './helpers2'
import { demoMenuClick } from './helpers3'

test.use({ actionTimeout: 15_000, navigationTimeout: 20_000 })
test.describe.configure({ timeout: 120_000 })

type LookLabel = '지금' | 'A' | 'B' | 'C'
const LOOK_LABELS: readonly LookLabel[] = ['지금', 'A', 'B', 'C']
const LOOK_KEY = 'rq:v1:look'

/** 지금 보라(--rq-accent #6645c0)와 최종 단계 청록(--rq-final #0b6b62) */
const PURPLE = 'rgb(102, 69, 192)'
const TEAL = 'rgb(11, 107, 98)'

/** COPY-4 A4-76 */
const BAND_TEXT = {
  first: '1차·기술 면접 준비 — 맡게 될 업무를 면접관에게 묻는 질문',
  final: '최종 면접·처우 협의 준비 — 1차에서 남은 것과 근무 조건을 확인하는 질문',
} as const

function lookGroup(page: Page): Locator {
  return namedGroup(page, '단계 디자인 시안')
}

/** 단계 머리띠(시안 B·C). 휴대폰·낮은 화면에서 단계를 옮길 때 스크롤하는 자리라 id가 있다 */
function band(page: Page): Locator {
  return page.locator('#prep-stage-band')
}

/** 시연 도구를 열어 시안을 고르고(라디오라 상자가 닫히지 않음) Esc로 닫는다 */
async function chooseLook(page: Page, label: LookLabel): Promise<void> {
  await demoToolsButton(page).click()
  const group = lookGroup(page)
  await pickRadio(group, label)
  await expect(group.getByRole('radio', { name: label, exact: true }), `"${label}"을 고른 뒤에도 상자는 열려 있고 그 칸이 골라져 있다`).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(group).toBeHidden()
}

async function checkedLook(page: Page): Promise<LookLabel | undefined> {
  await demoToolsButton(page).click()
  const group = lookGroup(page)
  await expect(group).toBeVisible()
  let found: LookLabel | undefined
  for (const l of LOOK_LABELS) if (await group.getByRole('radio', { name: l, exact: true }).isChecked()) found = l
  await page.keyboard.press('Escape')
  await expect(group).toBeHidden()
  return found
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

async function sessionLook(page: Page): Promise<string | null> {
  return page.evaluate((k) => sessionStorage.getItem(k), LOOK_KEY)
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

test('C4-05 기본은 "지금": 머리띠가 없고 1차·최종 모두 지금 보라. 시연 도구에 「단계 디자인 시안: 지금 · A · B · C」가 있고 "지금"이 골라져 있다', async ({
  page,
}) => {
  const base = await openPrep(page, 'oo')
  await expect(band(page), '1차 ①: 머리띠 없음').toHaveCount(0)
  expect(await accentOf(page), '1차 ① 강조색').toBe(PURPLE)

  await openStep1(page, base, '&mode=final')
  await expect(band(page), '최종 ①: 머리띠 없음').toHaveCount(0)
  expect(await accentOf(page), '최종 ① 강조색(지금 그대로)').toBe(PURPLE)
  expect(await backgroundOf(modeGroup(page).locator('input:checked + .chip')), '고른 "준비할 면접" 칸').toBe(PURPLE)

  await demoToolsButton(page).click()
  const group = lookGroup(page)
  await expect(group, '시연 도구 공통 묶음 「단계 디자인 시안」').toBeVisible()
  await expect(group.getByRole('radio')).toHaveCount(4)
  for (const l of LOOK_LABELS) await expect(group.getByRole('radio', { name: l, exact: true })).toHaveCount(1)
  await expect(group.getByRole('radio', { name: '지금', exact: true })).toBeChecked()
  expect(await sessionLook(page), '"지금"은 저장하지 않는다').toBeNull()
})

test('C4-05 시연 도구로 고르면 A는 최종 단계만 청록, B는 색은 그대로 두고 단계 머리띠, C는 둘 다(띠는 B보다 얇게). 같은 탭에서 다른 화면을 다녀와도 남는다', async ({
  page,
}) => {
  const base = await openPrep(page, 'oo')

  await chooseLook(page, 'A')
  expect(await accentOf(page), 'A · 1차는 지금 보라').toBe(PURPLE)
  await expect(band(page), 'A에는 머리띠 없음').toHaveCount(0)
  await switchMode(page, MODE_FINAL)
  expect(await accentOf(page), 'A · 최종 단계 표시줄').toBe(TEAL)
  expect(await backgroundOf(modeGroup(page).locator('input:checked + .chip')), 'A · 고른 "준비할 면접" 칸').toBe(TEAL)
  expect(await backgroundOf(currentStep(page).first().locator('.no')), 'A · 지금 단계 번호 배지').toBe(TEAL)
  await expect(band(page)).toHaveCount(0)

  await chooseLook(page, 'B')
  expect(await accentOf(page), 'B · 최종도 강조색은 지금 보라').toBe(PURPLE)
  await expect(band(page), 'B · 최종 머리띠').toHaveText(BAND_TEXT.final)
  const bBox = await band(page).boundingBox()
  await switchMode(page, MODE_FIRST)
  await expect(band(page), 'B · 1차 머리띠').toHaveText(BAND_TEXT.first)
  expect(await accentOf(page)).toBe(PURPLE)
  const firstBandBg = await backgroundOf(band(page))

  await chooseLook(page, 'C')
  expect(await accentOf(page), 'C · 1차는 지금 보라').toBe(PURPLE)
  await expect(band(page), 'C · 1차 머리띠(같은 말)').toHaveText(BAND_TEXT.first)
  await switchMode(page, MODE_FINAL)
  expect(await accentOf(page), 'C · 최종 단계 표시줄').toBe(TEAL)
  await expect(band(page), 'C · 최종 머리띠(같은 말)').toHaveText(BAND_TEXT.final)
  expect(await backgroundOf(band(page)), '머리띠 바탕이 단계마다 다르다').not.toBe(firstBandBg)
  const cBox = await band(page).boundingBox()
  expect(cBox && bBox && cBox.height < bBox.height, `C 머리띠(${cBox?.height}px)는 B(${bBox?.height}px)보다 얇다`).toBe(true)

  // 같은 탭: 새로 불러온 화면에서도 C
  await gotoApplications(page)
  expect(await sessionLook(page)).toBe('c')
  await openStep1(page, base, '&mode=final')
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  expect(await accentOf(page)).toBe(TEAL)
  expect(await checkedLook(page)).toBe('C')

  // "지금"으로 되돌리면 처음과 같다
  await chooseLook(page, '지금')
  await expect(band(page)).toHaveCount(0)
  expect(await accentOf(page)).toBe(PURPLE)
  expect(await sessionLook(page)).toBeNull()
})

test('C4-05 주소 ?look=b 로 열면 B, 알맞지 않은 값은 무시하고 고른 시안을 둔다. "시연 초기화"하면 "지금"으로 돌아간다', async ({ page }) => {
  const base = await openPrep(page, 'oo')

  await openStep1(page, base, '&look=b')
  await expect(band(page), '?look=b → 1차 머리띠').toHaveText(BAND_TEXT.first)
  expect(await accentOf(page)).toBe(PURPLE)
  expect(await sessionLook(page)).toBe('b')

  await openStep1(page, base, '&look=zz')
  await expect(band(page), '?look=zz는 무시(B 그대로)').toHaveText(BAND_TEXT.first)

  await openStep1(page, base, '&mode=final&look=A')
  await expect(band(page), '?look=A(대문자) → A, 머리띠 없음').toHaveCount(0)
  expect(await accentOf(page)).toBe(TEAL)

  await demoMenuClick(page, '시연 초기화')
  await expect(page).toHaveURL(S1_URL)
  expect(await sessionLook(page), '초기화하면 저장도 지운다').toBeNull()
  await openPrep(page, 'oo')
  await expect(band(page), '초기화 뒤 머리띠 없음').toHaveCount(0)
  await openStep1(page, base, '&mode=final')
  expect(await accentOf(page), '초기화 뒤 최종도 지금 보라').toBe(PURPLE)
  expect(await checkedLook(page)).toBe('지금')
})

test('C4-05 최종 ③ 시안 C: 화면은 청록·얇은 머리띠, "기대와 다름" 점은 보라, 가짜 응답 모드 태그 그대로. 인쇄에는 머리띠가 없고 색은 지금 보라', async ({
  page,
}) => {
  await page.goto('/mypage/applications?look=c')
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
  expect(await backgroundOf(rank), '인쇄: 질문 번호는 지금 보라').toBe(PURPLE)
  expect(await page.locator('.s4').evaluate((el) => getComputedStyle(el).getPropertyValue('--rq-accent').trim()), '인쇄: 강조색 토큰').toBe('#6645c0')

  await page.emulateMedia({ media: 'screen' })
  await expect(band(page)).toBeVisible()
  expect(await backgroundOf(rank)).toBe(TEAL)
})

test('C4-05 글자 대비: 시안 A·B·C × 1차·최종에서 단계 번호·단계 이름·고른 "준비할 면접"·머리띠 글자가 4.5:1 이상', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  for (const look of ['a', 'b', 'c'] as const) {
    for (const mode of ['first', 'final'] as const) {
      await openStep1(page, base, `&mode=${mode}&look=${look}`)
      const step = currentStep(page).first()
      const targets: Array<[string, Locator]> = [
        ['지금 단계 번호', step.locator('.no')],
        ['지금 단계 이름', step.locator('.label')],
        ['고른 "준비할 면접"', modeGroup(page).locator('input:checked + .chip')],
      ]
      if (look !== 'a') {
        await expect(band(page)).toBeVisible()
        targets.push(['머리띠 이름', band(page).locator('strong')], ['머리띠 목적', band(page).getByText(BAND_TEXT[mode].split(' — ')[1] ?? '')])
      }
      for (const [name, t] of targets) {
        const ratio = await contrastOf(t)
        expect(ratio, `${look.toUpperCase()} · ${mode} · ${name} 대비 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('C4-05 접근성: 시안 C 머리띠와 열린 시연 도구(단계 디자인 시안)에 axe 심각 위반이 없다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await openStep1(page, base, '&mode=final&look=c')
  await demoToolsButton(page).click()
  await expect(lookGroup(page)).toBeVisible()
  expect(await seriousAxeViolations(page)).toEqual([])
})

test('C4-05 휴대폰 375px: 시안 B·C에서 가로로 넘치지 않고, 단계를 옮기면 머리띠부터 보인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 프로젝트만')
  const base = await openPrep(page, 'oo')
  for (const look of ['b', 'c'] as const) {
    await openStep1(page, base, `&look=${look}`)
    const o1 = await horizontalOverflow(page)
    expect(o1.scrollWidth, `${look} · 1차 ① 가로 넘침`).toBeLessThanOrEqual(o1.innerWidth)
    await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
    await expectCurrentStep(page, '내 기대·걱정')
    await settleScroll(page)
    const box = await band(page).boundingBox()
    expect(box && box.y >= 0 && box.y <= 40, `${look} · ②로 옮긴 뒤 머리띠 위끝 y=${box?.y}(화면 맨 위 근처)`).toBe(true)
    const o2 = await horizontalOverflow(page)
    expect(o2.scrollWidth, `${look} · 1차 ② 가로 넘침`).toBeLessThanOrEqual(o2.innerWidth)
  }
  await gotoApplications(page)
  await makeFinalQuestions(page)
  await expect(band(page)).toHaveText(BAND_TEXT.final)
  const o3 = await horizontalOverflow(page)
  expect(o3.scrollWidth, 'c · 최종 ③ 가로 넘침').toBeLessThanOrEqual(o3.innerWidth)
})

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' })

  test('C4-05 움직임 줄이기 설정에서 시안을 바꿔도 머리띠·단계 표시에 움직임(애니메이션·전환)이 없다', async ({ page }) => {
    const base = await openPrep(page, 'oo')
    await openStep1(page, base, '&mode=final')
    for (const l of ['C', 'B', 'A'] as const) {
      await chooseLook(page, l)
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
      expect(moving, `${l}: 움직임 없음`).toEqual({ anim: 0, trans: 0 })
    }
  })
})
