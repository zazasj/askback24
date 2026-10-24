/**
 * G-14~16 — 시연 범위 흐림 표시. ACCEPTANCE.md 「2차 추가분 · G — 흐림 표시」.
 * 흐림 = aria-disabled="true" · KRDS 회색 글자 토큰 · 마우스(데스크톱)·초점에 "시연 범위 밖이에요" 설명 · 누르면 알림(G-03 그대로).
 * Playwright 는 aria-disabled 요소를 비활성으로 봐서, 흐린 컨트롤은 force 로 누른다.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import {
  ABOUT_TITLE,
  BANNER_TEXTS,
  PREP_BUTTON,
  S2_TITLE,
  S3_TITLE,
  acceptDialogs,
  applyButton,
  demoToolsButton,
  expectCurrentStep,
  findUnappliedPosting,
  goToCardsStep,
  gotoApplications,
  heading,
  installPrintSpy,
  jobDetailPaths,
  makeFirstQuestions,
  openPrep,
  tourScreens,
  waitFirstResults,
} from './helpers'
import {
  ALL_MENU,
  DEMO_OFF_BANNER,
  LEFT_MENU_ON,
  MAIN_MENU_OFF,
  S1_TABS_OFF,
  S2_BUTTONS_OFF,
  control,
  expectDemoOff,
  expectNotDemoOff,
  mainMenuItem,
  pinStorage,
  repoPath,
  sweepOutOfScope,
  visibleTextStyle,
} from './helpers2'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })

const isOn = (name: string): boolean => (LEFT_MENU_ON as readonly string[]).includes(name)

async function gotoResume(page: Page): Promise<void> {
  await page.goto('/mypage/resume')
  await expect(heading(page, S2_TITLE)).toBeVisible()
}

/**
 * 이름이 같은 보이는 컨트롤을 하나씩(매번 화면을 새로 열고) 흐림 표시인지 본다.
 * 휴대폰에서 그 컨트롤이 아예 없으면(다른 모양으로 바뀐 화면) 건너뛰고 적어 둔다.
 */
async function expectEachDemoOff(page: Page, open: () => Promise<void>, find: () => Locator, label: string, isMobile: boolean): Promise<void> {
  await open()
  const n = await find().filter({ visible: true }).count()
  if (n === 0 && isMobile) {
    test.info().annotations.push({ type: '휴대폰에서 없음', description: label })
    return
  }
  expect(n, `${label}: 화면에 있어야 한다`).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    await open()
    await expectDemoOff(page, find().filter({ visible: true }).nth(i), n > 1 ? `${label} ${i + 1}` : label, { hover: !isMobile })
  }
}

// ── G-14 최소 목록 ─────────────────────────────────────────────

test('G-14 주 메뉴 "취업지원" "실업급여" "직업 능력 개발" "출산휴가·육아휴직"은 흐림 표시(aria-disabled·회색 토큰·설명·누르면 알림)', async ({ page, isMobile }) => {
  test.setTimeout(120_000)
  for (const name of MAIN_MENU_OFF) {
    await gotoApplications(page)
    await expectDemoOff(page, mainMenuItem(page, name), `주 메뉴 "${name}"`, { hover: !isMobile })
  }
})

test('G-14 "전체 메뉴"는 흐림 표시', async ({ page, isMobile }) => {
  await expectEachDemoOff(page, () => gotoApplications(page), () => control(page, ALL_MENU), `"${ALL_MENU}"`, isMobile)
})

test('G-14 왼쪽 메뉴에서 "이력서/자기소개서 관리" "알선/입사지원 내역" 말고는 모두 흐림 표시', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 폭은 왼쪽 메뉴가 선택 상자로 바뀌므로(G-04와 같음) 데스크톱에서 본다')
  test.setTimeout(240_000)
  const items = () => {
    const nav = page.getByRole('navigation', { name: '마이페이지 메뉴' })
    return nav.getByRole('link').or(nav.getByRole('button')).filter({ visible: true })
  }
  await gotoApplications(page)
  await expect(page.getByRole('navigation', { name: '마이페이지 메뉴' })).toBeVisible()
  const infos = await items().evaluateAll((els) =>
    els.map((el) => ({
      name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      disclosure: el.hasAttribute('aria-expanded'),
    })),
  )
  for (const name of LEFT_MENU_ON) expect(infos.map((x) => x.name), `왼쪽 메뉴 "${name}"`).toContain(name)
  // 펼침 단추(aria-expanded)는 동작하는 컨트롤이라 뺀다
  const off = infos.map((x, index) => ({ ...x, index })).filter((x) => !isOn(x.name) && !x.disclosure)
  test.info().annotations.push({ type: '왼쪽 메뉴 흐림 대상', description: off.map((x) => x.name).join(', ') || '(없음)' })
  for (const x of off) {
    await gotoApplications(page)
    await expectDemoOff(page, items().nth(x.index), `왼쪽 메뉴 "${x.name}"`, { hover: true })
  }
})

test('G-14 지원 내역의 탭 "관심기업 관리" "채용담당자와 한마디"는 흐림 표시', async ({ page, isMobile }) => {
  test.setTimeout(90_000)
  for (const name of S1_TABS_OFF) {
    await expectEachDemoOff(page, () => gotoApplications(page), () => control(page, name), `탭 "${name}"`, isMobile)
  }
})

test('G-14 이력서 화면의 "이메일 보내기" "항목 순서변경" "수정"은 흐림 표시', async ({ page, isMobile }) => {
  test.setTimeout(150_000)
  for (const name of S2_BUTTONS_OFF) {
    await expectEachDemoOff(page, () => gotoResume(page), () => control(page, name), `이력서 "${name}"`, isMobile)
  }
})

test('G-14 docs/DEMO-SCOPE.md 에 "동작함"·"시연 범위 밖" 목록과 최소 목록이 적혀 있다', async ({ isMobile }) => {
  test.skip(isMobile, '파일 검사는 데스크톱 프로젝트에서 한 번')
  const p = repoPath('docs/DEMO-SCOPE.md')
  expect(existsSync(p), 'docs/DEMO-SCOPE.md 가 있어야 한다').toBe(true)
  const text = readFileSync(p, 'utf8')
  expect(text, '"동작함" 칸').toContain('동작함')
  expect(text, '"시연 범위 밖" 칸').toContain('시연 범위 밖')
  for (const name of [...MAIN_MENU_OFF, ALL_MENU, ...S1_TABS_OFF, ...S2_BUTTONS_OFF]) expect(text, `목록에 "${name}"`).toContain(name)
})

// ── G-14 화면 훑기: 누르면 "시연 범위 밖" 알림이 뜨는 것은 빠짐없이 흐림 ─────────

type SweepScreen = { name: string; prepare: (page: Page) => Promise<() => Promise<void>> }

/** 지금 주소를 다시 열고 ready 가 보일 때까지 기다리는 open 을 만든다. */
function reopen(page: Page, ready: () => Promise<void>): () => Promise<void> {
  const url = page.url()
  return async () => {
    await page.goto(url)
    await ready()
  }
}

const SWEEP_SCREENS: SweepScreen[] = [
  {
    name: 'S1 알선/입사지원 내역',
    prepare: async (page) => {
      await gotoApplications(page)
      return () => gotoApplications(page)
    },
  },
  {
    name: 'S2 이력서/자기소개서 관리',
    prepare: async (page) => {
      await gotoResume(page)
      return () => gotoResume(page)
    },
  },
  {
    name: 'S3 채용정보 목록',
    prepare: async (page) => {
      await jobDetailPaths(page)
      return reopen(page, () => expect(heading(page, S3_TITLE)).toBeVisible())
    },
  },
  {
    name: 'S3 채용정보 상세',
    prepare: async (page) => {
      const [first] = await jobDetailPaths(page)
      await page.goto(first ?? '/jobs')
      await expect(heading(page, '모집요강')).toBeVisible()
      return reopen(page, () => expect(heading(page, '모집요강')).toBeVisible())
    },
  },
  {
    name: '/about-ai',
    prepare: async (page) => {
      await page.goto('/about-ai')
      await expect(heading(page, ABOUT_TITLE)).toBeVisible()
      return reopen(page, () => expect(heading(page, ABOUT_TITLE)).toBeVisible())
    },
  },
  {
    name: 'S4 ① 공고 확인',
    prepare: async (page) => {
      await openPrep(page, 'oo')
      await expectCurrentStep(page, '공고 확인')
      return reopen(page, () => expectCurrentStep(page, '공고 확인'))
    },
  },
  {
    name: 'S4 ② 내 기대·걱정',
    prepare: async (page) => {
      const base = await openPrep(page, 'oo')
      await goToCardsStep(page, base)
      return reopen(page, () => expectCurrentStep(page, '내 기대·걱정'))
    },
  },
  {
    name: 'S4 ③ 질문 받기',
    prepare: async (page) => {
      await makeFirstQuestions(page, 'oo')
      return reopen(page, () => waitFirstResults(page))
    },
  },
]

for (const screen of SWEEP_SCREENS) {
  test(`G-14 화면 훑기 ${screen.name}: 누르면 "시연 범위 밖" 알림이 뜨는 컨트롤은 모두 흐림 표시`, async ({ page }) => {
    test.setTimeout(480_000)
    acceptDialogs(page)
    await installPrintSpy(page)
    page.context().on('page', (p) => void p.close())
    const open = await screen.prepare(page)
    // 누를 때마다 같은 저장 상태로 연다(안내 닫기·선택 같은 것이 다음 확인에 남지 않게)
    await pinStorage(page)
    const r = await sweepOutOfScope(page, open)
    test.info().annotations.push({ type: '훑기', description: `${screen.name}: 눌러 본 컨트롤 ${r.checked}개` })
    if (r.skipped.length > 0) test.info().annotations.push({ type: '훑기에서 건너뜀', description: r.skipped.join('\n').slice(0, 4000) })
    expect(r.checked, '눌러 본 컨트롤이 있어야 한다').toBeGreaterThan(0)
    expect(r.offenders, '흐림 표시(aria-disabled) 없이 누르면 "시연 범위 밖" 알림이 뜨는 컨트롤').toEqual([])
  })
}

// ── G-15 ──────────────────────────────────────────────────────

/** 띠 두 문구(기존 "해커톤 시연용 모의 서비스"와 새 문구)가 같은 띠 안에 있는지: 공통 조상이 본문(h1·main)을 품지 않아야 한다. */
async function demoOffBannerProblem(page: Page): Promise<string> {
  return page.evaluate(
    ([a, b]) => {
      const innermost = (text: string): Element | null => {
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          if (!(el.textContent ?? '').includes(text)) continue
          if (Array.from(el.children).some((c) => (c.textContent ?? '').includes(text))) continue
          if (el.checkVisibility({ visibilityProperty: true })) return el
        }
        return null
      }
      const ea = innermost(a)
      const eb = innermost(b)
      if (!ea || !eb) return `보이는 "${ea ? b : a}" 글을 찾지 못함`
      const up = new Set<Element>()
      for (let n: Element | null = ea; n; n = n.parentElement) up.add(n)
      let common: Element | null = eb
      while (common && !up.has(common)) common = common.parentElement
      if (!common || common === document.body || common === document.documentElement || common.querySelector('h1, main')) {
        return `두 문구의 공통 조상 <${common?.tagName.toLowerCase() ?? '없음'}>이 본문까지 품는다(띠 밖에 있음)`
      }
      return ''
    },
    [BANNER_TEXTS[0], DEMO_OFF_BANNER] as const,
  )
}

test('G-15 모든 화면의 시연 띠에 "흐린 메뉴는 시연 범위 밖이에요"', async ({ page }) => {
  test.setTimeout(240_000)
  await tourScreens(page, async (name) => {
    await expect.soft(page.getByText(DEMO_OFF_BANNER).first(), `${name}: "${DEMO_OFF_BANNER}"`).toBeVisible()
    expect.soft(await demoOffBannerProblem(page), `${name}: 새 문구가 시연 띠 안에 있어야 한다`).toBe('')
  })
})

// ── G-16 ──────────────────────────────────────────────────────

test('G-16 지원 내역 화면의 동작하는 컨트롤에는 흐림 표시가 없다: 채용정보·왼쪽 메뉴 두 링크·면접 준비 버튼·검색·시연 도구', async ({ page, isMobile }) => {
  test.setTimeout(120_000)
  const hover = !isMobile
  await gotoApplications(page)

  await expectNotDemoOff(page, mainMenuItem(page, '채용정보'), '주 메뉴 "채용정보"', { hover })
  const on = await visibleTextStyle(mainMenuItem(page, '채용정보'))
  const off = await visibleTextStyle(mainMenuItem(page, MAIN_MENU_OFF[0]))
  expect(on.color, `"채용정보"(${on.color})와 흐린 "${MAIN_MENU_OFF[0]}"(${off.color}) 글자색이 달라야 한다`).not.toBe(off.color)

  if (!isMobile) {
    const nav = page.getByRole('navigation', { name: '마이페이지 메뉴' })
    const links = nav.getByRole('link').or(nav.getByRole('button')).filter({ visible: true })
    const names = (await links.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
    const offIndex = names.findIndex((n) => !isOn(n))
    for (const name of LEFT_MENU_ON) {
      const link = nav.getByRole('link', { name, exact: true })
      await expectNotDemoOff(page, link, `왼쪽 메뉴 "${name}"`, { hover })
      if (offIndex >= 0) {
        const greyed = await visibleTextStyle(links.nth(offIndex))
        const mine = await visibleTextStyle(link)
        expect(mine.color, `왼쪽 메뉴 "${name}"(${mine.color})와 흐린 "${names[offIndex]}"(${greyed.color}) 글자색이 달라야 한다`).not.toBe(greyed.color)
      }
    }
  }

  const prep = page.getByRole('button', { name: PREP_BUTTON })
  await expect(prep).toHaveCount(3)
  for (let i = 0; i < 3; i++) await expectNotDemoOff(page, prep.nth(i), `면접 준비 버튼 ${i + 1}("면접 역질문 준비"·"최종 면접 준비")`, { hover })
  await expectNotDemoOff(page, page.getByRole('button', { name: '검색', exact: true }), '"검색"', { hover })
  await expectNotDemoOff(page, demoToolsButton(page), '"시연 도구"', { hover })
})

test('G-16 채용정보 상세의 "입사지원"에는 흐림 표시가 없다', async ({ page, isMobile }) => {
  await findUnappliedPosting(page)
  await expectNotDemoOff(page, applyButton(page).first(), '"입사지원"', { hover: !isMobile })
})

test('G-16 이력서 화면의 "이력서 출력"에는 흐림 표시가 없다', async ({ page, isMobile }) => {
  await gotoResume(page)
  await expectNotDemoOff(page, page.getByRole('button', { name: '이력서 출력' }), '"이력서 출력"', { hover: !isMobile })
})
