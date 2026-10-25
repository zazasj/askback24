/**
 * W-01~09 — 보류 의견 안내·정책 문구 묶음(2026-10-25 세진 결정). ACCEPTANCE.md 「5차 추가분」만 보고 쓴다.
 * 화면은 역할·이름·글자로 찾고, 넘침·가림은 찾은 요소에서 잰다.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { join } from 'node:path'
import { ABOUT_TITLE, REPO_ROOT, bodyText, expectCurrentStep, heading, installPrintSpy, makeFinalQuestions, makeFirstQuestions, printCalls } from './helpers'
import { PRINT_BUTTON, pdfPageCount, scrollToBottom, settleScroll, textUnderBottomBar } from './helpers2'

test.use({ actionTimeout: 10_000 })
test.describe.configure({ timeout: 120_000 })

const CONTRACT_URL = 'https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20250300356'
const CONTRACT_LINK = /^고용노동부 표준근로계약서/
const PROMISE_WORDS = /보장|하겠습니다|약속/
const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim()

async function openAbout(page: Page): Promise<void> {
  await page.goto('/about-ai')
  await expect(heading(page, ABOUT_TITLE)).toBeVisible()
}

/** 제목(h2·h3)을 이름으로 가진 절 */
function sectionOf(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true })
}

async function textOf(target: Locator): Promise<string> {
  return normalize(await target.innerText())
}

/** 요소가 오른쪽으로 넘치지 않는가(안쪽 넘침·화면 밖) */
async function overflowOf(target: Locator): Promise<{ inner: number; outer: number; right: number; vw: number }> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { inner: el.scrollWidth, outer: el.clientWidth, right: r.right, vw: document.documentElement.clientWidth }
  })
}

async function expectNoOverflow(target: Locator, label: string): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  const o = await overflowOf(target)
  expect(o.inner, `${label}: 안쪽 넘침(scrollWidth ${o.inner} > clientWidth ${o.outer})`).toBeLessThanOrEqual(o.outer + 1)
  expect(o.right, `${label}: 오른쪽 끝 ${Math.round(o.right)} > 화면 폭 ${o.vw}`).toBeLessThanOrEqual(o.vw + 1)
}

// ── /about-ai ──────────────────────────────────────────────────

test('W-01 /about-ai 제목 아래 목적 상자: "이미 지원한 공고의 면접 준비" · "첫 직장 1년 안 이탈" 38.5% · 출처, 이탈을 줄인다는 말은 없음', async ({ page }) => {
  await openAbout(page)
  const box = sectionOf(page, '서비스 목적')
  await expect(box).toBeVisible()
  const text = await textOf(box)
  expect(text).toContain('이미 지원한 공고의 면접 준비')
  expect(text).toContain('첫 직장 1년 안 이탈')
  expect(text).toContain('38.5%')
  expect(text).toContain('국가데이터처 MDIS 경제활동인구조사 청년층 부가조사(2024~2026.5) 팀 자체 분석')
  expect(text, '인과처럼 읽히는 말 없음').not.toMatch(/줄여요|줄입니다|줄일|막아요|막습니다/)
  const titleBox = await heading(page, ABOUT_TITLE).boundingBox()
  const boxTop = (await box.boundingBox())?.y ?? 0
  const stepsTop = (await heading(page, '처리 단계').boundingBox())?.y ?? 0
  expect(boxTop, '제목 아래').toBeGreaterThan(titleBox?.y ?? 0)
  expect(boxTop, '처리 단계보다 위').toBeLessThan(stepsTop)
})

test('W-02 "처리 단계" 절 안 "고용24에 붙이면" 회색 상자: 3~4줄 + 채용정보 상세 확장 계획, 비용 숫자 없음', async ({ page }) => {
  await openAbout(page)
  const steps = sectionOf(page, '처리 단계')
  const plan = steps.getByRole('region', { name: '고용24에 붙이면', exact: true })
  await expect(plan).toBeVisible()
  const items = plan.getByRole('listitem')
  const n = await items.count()
  expect(n, '항목 수').toBeGreaterThanOrEqual(3)
  expect(n, '항목 수').toBeLessThanOrEqual(5)
  const text = await textOf(plan)
  expect(text).toContain('채용정보 상세에서도 면접을 준비하도록 넓힐 계획이에요.')
  expect(text, '계획 말투').toContain('계획이에요')
  expect(text, '비용 숫자 없음').not.toMatch(/\d[\d,.]*\s*(원|달러|\$)/)
  expect(text, '약속 말투 없음').not.toMatch(PROMISE_WORDS)
  const bg = await plan.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg, '회색 바탕').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  // 처리 단계 목록은 3개 그대로(S4-24)
  await expect(steps.getByRole('list').first().getByRole('listitem')).toHaveCount(3)
})

test('W-03·W-08 점검 숫자: 팀 실측 칸(50건 · 40건(80%) · 근무시간 37건 · 2026-10-05 팀 측정), 이용 기록은 모으지 않고 "팀 점검"', async ({ page }) => {
  await openAbout(page)
  const block = sectionOf(page, '점검 숫자')
  const text = await textOf(block)
  for (const t of ["고용24 '개발자' 공개 공고 50건", '40건(80%)', '근무시간 빈칸 37건', '2026-10-05 팀 측정']) expect(text, t).toContain(t)
  expect(text).toMatch(/임금 빈칸·협의 40건\(80%\)/)
  expect(text).toMatch(/이용 기록.*모으지 않아요/)
  expect(text).toContain('팀 점검')
  // 팀 실측 칸은 줄 전체 폭
  const wide = block.locator('dl > div').filter({ hasText: '팀 실측' })
  const others = block.locator('dl > div').filter({ hasNotText: '팀 실측' })
  const w = (await wide.boundingBox())?.width ?? 0
  const one = (await others.first().boundingBox())?.width ?? 0
  expect(w, '팀 실측 칸이 다른 칸보다 넓다(줄 전체)').toBeGreaterThan(one * 1.5)
})

test('W-04 "기획안 뒤 달라진 점" 2~3줄: 차이 확인 · 실제/모의 · 1차 면접 정리, 강소기업 "15,282건"', async ({ page }) => {
  await openAbout(page)
  const block = sectionOf(page, '기획안 뒤 달라진 점')
  await expect(block).toBeVisible()
  const n = await block.getByRole('listitem').count()
  expect(n).toBeGreaterThanOrEqual(2)
  expect(n).toBeLessThanOrEqual(3)
  const text = await textOf(block)
  for (const t of ['차이 확인', '실제', '모의', '1차 면접 정리', '15,282건']) expect(text, t).toContain(t)
  expect(await bodyText(page), '"15,291곳" 표기 없음').not.toContain('15,291곳')
})

test('W-06 개인정보 절: "시연 초기화로 지워 주세요" · 고용24에 붙일 때 계획(위탁·남기지 않음·마이페이지 계정)은 "계획이에요"', async ({ page }) => {
  await openAbout(page)
  const block = sectionOf(page, '개인정보')
  const text = await textOf(block)
  expect(text).toContain('시연 초기화로 지워 주세요')
  expect(text).toContain('위탁으로 알리고, 보낸 글은 질문을 만든 뒤 남기지 않을 계획이에요.')
  expect(text).toContain('만든 질문은 마이페이지 계정에 저장할 계획이에요.')
  expect(text, '약속 말투 없음').not.toMatch(PROMISE_WORDS)
})

// ── 최종 ③ · 1차 면접 정리 ─────────────────────────────────────

test('W-05 최종 ③ 오른쪽 상자 "고용노동부 표준근로계약서" 링크(새 창, 확인한 주소) · 인쇄 화면에서는 안 보이고 A4 1쪽', async ({ page, isMobile }) => {
  await installPrintSpy(page)
  await makeFinalQuestions(page)
  const link = page.getByRole('link', { name: CONTRACT_LINK })
  await expect(link).toHaveCount(1)
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', CONTRACT_URL)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  const side = page.getByRole('complementary').filter({ has: link })
  expect(await textOf(side)).toContain('근로계약서')

  await page.emulateMedia({ media: 'print' })
  await expect(link, '인쇄 화면에서 링크 숨김').toBeHidden()
  expect(await bodyText(page), '인쇄 화면에 링크 주소 없음').not.toContain('moel.go.kr')
  await page.emulateMedia({ media: null })
  if (isMobile) return
  await page.getByRole('button', { name: PRINT_BUTTON }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
  const pdf = await page.pdf({ format: 'A4', path: join(REPO_ROOT, 'review', 'tmp', 'w05-final-print.pdf') })
  expect(pdfPageCount(pdf), '최종 ③ 인쇄 A4 1쪽(Q-02)').toBe(1)
})

test('W-07 최종 ③ 질문 아래 "최종 면접을 다녀오면" 상자: 인쇄 때 숨김, 맨 아래에서 고정 바에 가리지 않음', async ({ page }) => {
  await makeFinalQuestions(page)
  const box = page.getByRole('region', { name: '최종 면접을 다녀오면', exact: true })
  await expect(box).toBeVisible()
  expect(await textOf(box)).toContain('근로계약서')
  // 질문 목록보다 아래
  const lastList = page.getByRole('list', { name: /물을 것 목록$/ }).last()
  const listBottom = await lastList.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY)
  const boxTop = await box.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  expect(boxTop, '질문 아래').toBeGreaterThan(listBottom)
  await settleScroll(page)
  await scrollToBottom(page)
  expect((await textUnderBottomBar(page)).covered, '맨 아래에서 고정 바에 가린 글').toEqual([])
  await page.emulateMedia({ media: 'print' })
  await expect(box, '인쇄 화면에서 숨김').toBeHidden()
})

test('W-07 1차 면접 정리 "면접 분위기" 묶음에 일과 상관없는 개인정보 안내와 고용노동부 고객상담센터(국번 없이 1350)', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: '면접 다녀왔어요' }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  const mood = page.getByRole('group', { name: '면접 분위기' })
  await expect(mood).toBeVisible()
  const text = await textOf(mood)
  expect(text).toContain('고용노동부 고객상담센터(국번 없이 1350)')
  expect(text).toMatch(/가족·결혼 계획/)
  expect(text).toMatch(/일과 상관없는 개인정보/)
})

// ── 휴대폰 넘침 ────────────────────────────────────────────────

test('W-09 휴대폰 375: 목적 상자·"고용24에 붙이면"·팀 실측 칸·"최종 면접을 다녀오면"·표준근로계약서 링크가 넘치지 않는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 폭에서 잰다')
  await openAbout(page)
  await expectNoOverflow(sectionOf(page, '서비스 목적'), '목적 상자')
  await expectNoOverflow(sectionOf(page, '고용24에 붙이면'), '고용24에 붙이면')
  await expectNoOverflow(sectionOf(page, '점검 숫자').locator('dl > div').filter({ hasText: '팀 실측' }), '팀 실측 칸')
  await expectNoOverflow(sectionOf(page, '기획안 뒤 달라진 점'), '기획안 뒤 달라진 점')
  await expectNoOverflow(sectionOf(page, '개인정보'), '개인정보')
  await makeFinalQuestions(page)
  await expectNoOverflow(page.getByRole('region', { name: '최종 면접을 다녀오면', exact: true }), '최종 면접을 다녀오면')
  await expectNoOverflow(page.getByRole('link', { name: CONTRACT_LINK }), '표준근로계약서 링크')
})
