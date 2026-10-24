/**
 * 2차 추가분(2026-10-25) 시험 도우미. docs/ACCEPTANCE.md 「2차 추가분」만 보고 쓴다.
 * 기존 helpers.ts 는 고치지 않고, 새 시험이 같이 쓰는 것만 여기에 둔다.
 * 화면은 역할·이름·글자(「정확한 문구」)로만 찾는다. 위치·색·줄바꿈처럼 재야 하는 것은
 * 찾은 요소에서 계산한다(CSS 클래스·data-testid 없음).
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { REPO_ROOT, normalize } from './helpers'

// ── 정확한 문구(2차) ───────────────────────────────────────────
export const DEMO_OFF_BANNER = '흐린 메뉴는 시연 범위 밖이에요'
export const DEMO_OFF_TIP = '시연 범위 밖이에요'
/** 범위 밖 컨트롤을 눌렀을 때의 알림(G-03 "시연 범위 밖 메뉴예요", 이력서 화면의 "시연에서는 …" 꼴 포함) */
export const OUT_OF_SCOPE_NOTICE = /시연 범위 밖|시연에서는/
export const MAIN_MENU_OFF = ['취업지원', '실업급여', '직업 능력 개발', '출산휴가·육아휴직'] as const
export const ALL_MENU = '전체 메뉴'
export const LEFT_MENU_ON = ['이력서/자기소개서 관리', '알선/입사지원 내역'] as const
export const S1_TABS_OFF = ['관심기업 관리', '채용담당자와 한마디'] as const
export const S2_BUTTONS_OFF = ['이메일 보내기', '항목 순서변경', '수정'] as const
export const AI_SUMMARY_TITLE = 'AI 분석 요약'
export const AI_SUMMARY_COUNT = /확인할 곳\s*(\d+)\s*군데를 찾았어요/
export const JOB_INFO_SOURCE = '고용24 직업정보'
export const FINAL_HEAD = '준비 중: 최종 면접'
export const SOURCE_COLUMNS = ['데이터', '출처', '구분', '받은 날짜'] as const
export const PRINT_BUTTON = '면접에 들고 갈 한 장 인쇄'

// ── 컨트롤 찾기 ────────────────────────────────────────────────
/** 이름이 정확히 같은 링크·버튼·탭·메뉴 항목 */
export function control(scope: Page | Locator, name: string): Locator {
  const o = { name, exact: true } as const
  return scope
    .getByRole('link', o)
    .or(scope.getByRole('button', o))
    .or(scope.getByRole('tab', o))
    .or(scope.getByRole('menuitem', o))
}

export function mainMenuItem(page: Page, name: string): Locator {
  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  return nav.getByRole('link', { name, exact: true }).or(nav.getByRole('button', { name, exact: true })).first()
}

/** 보이는 "시연 범위 밖이에요" 설명(툴팁) */
export function demoOffTips(page: Page): Locator {
  return page.getByText(DEMO_OFF_TIP, { exact: true }).filter({ visible: true })
}

/** 보이는 시연 범위 밖 알림(role=status) */
export function outOfScopeNotices(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: OUT_OF_SCOPE_NOTICE })
}

/** 마우스를 빈 곳으로 치우고 초점을 푼다(툴팁을 닫은 상태에서 다음 확인을 시작하려고). */
export async function releasePointerAndFocus(page: Page): Promise<void> {
  await page.mouse.move(2, 2)
  await page.evaluate(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  })
}

/** 키보드로 옮긴 초점처럼 준다(크롬 :focus-visible 판단이 키보드 쪽이 되게 키를 한 번 누른 뒤 focus). */
export async function keyboardFocus(target: Locator): Promise<void> {
  await target.page().keyboard.press('Shift')
  await target.focus()
}

async function countGrows(page: Page, locator: Locator, from: number, ms: number): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if ((await locator.count()) > from) return true
    await page.waitForTimeout(100)
  }
  return (await locator.count()) > from
}

// ── 흐림 표시 색 ───────────────────────────────────────────────
let grayTokens: Map<string, string> | null = null

/**
 * KRDS 회색 글자 토큰 gray-30~70 → "rgb(r, g, b)". 값은 krds-uiux 패키지 토큰 파일에서 읽는다.
 * gray-80 이상은 본문 글자색(text-basic = gray-90)과 같은 계열이라 흐림으로 치지 않는다.
 */
export function krdsGrayTextTokens(): Map<string, string> {
  if (grayTokens) return grayTokens
  const css = readFileSync(join(REPO_ROOT, 'node_modules', 'krds-uiux', 'resources', 'css', 'token', 'krds_tokens.css'), 'utf8')
  const out = new Map<string, string>()
  for (const m of css.matchAll(/--krds-color-light-gray-(\d+)\s*:\s*#([0-9a-fA-F]{6})\b/g)) {
    const level = Number(m[1])
    const hex = m[2] ?? ''
    if (level < 30 || level > 70) continue
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
    out.set(`rgb(${r}, ${g}, ${b})`, `gray-${level}`)
  }
  grayTokens = out
  return out
}

/** 보이는 첫 글자의 색과, 그 글자에 걸린 투명도(조상까지 곱한 값) */
export async function visibleTextStyle(target: Locator): Promise<{ color: string; opacity: number }> {
  return target.evaluate((el) => {
    let holder: Element = el
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement
      if ((walker.currentNode.textContent ?? '').trim() && parent && parent.checkVisibility({ visibilityProperty: true })) {
        holder = parent
        break
      }
    }
    let opacity = 1
    for (let n: Element | null = holder; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity || '1')
    return { color: getComputedStyle(holder).color, opacity }
  })
}

export async function expectGrayToken(target: Locator, label: string): Promise<void> {
  const grays = krdsGrayTextTokens()
  expect(grays.size, 'krds-uiux 토큰 파일에서 회색 토큰(gray-30~70)을 읽어야 한다').toBeGreaterThan(0)
  const style = await visibleTextStyle(target)
  expect(grays.has(style.color), `${label}: 글자색 ${style.color}이 KRDS 회색 글자 토큰(${[...grays.values()].join(', ')}) 중 하나여야 한다`).toBe(true)
  expect(style.opacity, `${label}: 투명도로 흐리지 않고 글자색 자체가 회색 토큰이어야 한다(opacity ${style.opacity})`).toBe(1)
}

export type DemoOffCheck = { hover: boolean; click?: boolean }

/**
 * G-14 흐림 표시: aria-disabled="true" · 회색 토큰 글자 · 마우스(데스크톱)·키보드 초점에 "시연 범위 밖이에요" 설명 ·
 * 누르면 시연 범위 밖 알림이 뜨고 주소가 그대로(G-03). Playwright 는 aria-disabled 요소를 "비활성"으로 봐서 force 로 누른다.
 */
export async function expectDemoOff(page: Page, target: Locator, label: string, check: DemoOffCheck): Promise<void> {
  await expect(target, `${label}: 화면에 보여야 한다`).toBeVisible()
  await expect(target, `${label}: aria-disabled="true"`).toHaveAttribute('aria-disabled', 'true')
  await expectGrayToken(target, label)

  const tips = demoOffTips(page)
  await releasePointerAndFocus(page)
  const base = await tips.count()
  if (check.hover) {
    await target.hover()
    await expect.poll(() => tips.count(), { message: `${label}: 마우스를 올리면 "${DEMO_OFF_TIP}" 설명이 떠야 한다` }).toBeGreaterThan(base)
    await releasePointerAndFocus(page)
    await expect.poll(() => tips.count(), { message: `${label}: 마우스를 치우면 설명이 닫혀야 한다` }).toBe(base)
  }
  await keyboardFocus(target)
  await expect(target, `${label}: 키보드 초점을 받을 수 있어야 한다(disabled 대신 aria-disabled)`).toBeFocused()
  await expect.poll(() => tips.count(), { message: `${label}: 초점을 주면 "${DEMO_OFF_TIP}" 설명이 떠야 한다` }).toBeGreaterThan(base)
  await releasePointerAndFocus(page)

  if (check.click ?? true) {
    const before = page.url()
    const notices = outOfScopeNotices(page)
    const n0 = await notices.count()
    await target.click({ force: true })
    expect(await countGrows(page, notices, n0, 5_000), `${label}: 누르면 시연 범위 밖 알림(role=status)이 떠야 한다`).toBe(true)
    expect(page.url(), `${label}: 누른 뒤에도 주소가 그대로여야 한다`).toBe(before)
  }
}

/** G-16 동작하는 컨트롤: aria-disabled 없음 · 눌러서 쓸 수 있음 · 마우스·초점에 "시연 범위 밖이에요" 설명이 안 뜬다. */
export async function expectNotDemoOff(page: Page, target: Locator, label: string, check: { hover: boolean }): Promise<void> {
  await expect(target, `${label}: 화면에 보여야 한다`).toBeVisible()
  await expect(target, `${label}: aria-disabled 가 없어야 한다`).not.toHaveAttribute('aria-disabled', 'true')
  await expect(target, `${label}: 눌러서 쓸 수 있어야 한다`).toBeEnabled()
  const tips = demoOffTips(page)
  await releasePointerAndFocus(page)
  const base = await tips.count()
  if (check.hover) {
    await target.hover()
    await page.waitForTimeout(500)
    expect(await tips.count(), `${label}: 마우스를 올려도 "${DEMO_OFF_TIP}" 설명이 없어야 한다`).toBe(base)
    await releasePointerAndFocus(page)
  }
  await keyboardFocus(target)
  await page.waitForTimeout(500)
  expect(await tips.count(), `${label}: 초점을 줘도 "${DEMO_OFF_TIP}" 설명이 없어야 한다`).toBe(base)
  await releasePointerAndFocus(page)
}

// ── G-14 화면 훑기 ─────────────────────────────────────────────
export const SWEEP_ROLES = ['link', 'button', 'tab', 'menuitem'] as const
type SweepRole = (typeof SWEEP_ROLES)[number]

async function controlsOf(page: Page, role: SweepRole): Promise<Array<{ name: string; off: boolean }>> {
  return page
    .getByRole(role)
    .filter({ visible: true })
    .evaluateAll((els) =>
      els.map((el) => ({
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        off: el.closest('[aria-disabled="true"]') !== null || (el instanceof HTMLButtonElement && el.disabled),
      })),
    )
}

export type SweepResult = { offenders: string[]; skipped: string[]; checked: number }

/**
 * 화면의 보이는 링크·버튼·탭을 하나씩 눌러 본다(누를 때마다 open 으로 같은 화면을 새로 연다).
 * 흐림 표시(aria-disabled)가 아닌데 누르면 시연 범위 밖 알림이 뜨는 것을 offenders 로 돌려준다.
 */
export async function sweepOutOfScope(page: Page, open: () => Promise<void>): Promise<SweepResult> {
  await open()
  const plan: Array<{ role: SweepRole; index: number; name: string }> = []
  for (const role of SWEEP_ROLES) {
    const list = await controlsOf(page, role)
    list.forEach((c, index) => {
      if (!c.off) plan.push({ role, index, name: c.name })
    })
  }
  const result: SweepResult = { offenders: [], skipped: [], checked: 0 }
  for (const c of plan) {
    const label = `${c.role} "${c.name || '(이름 없음)'}"`
    await open()
    const target = page.getByRole(c.role).filter({ visible: true }).nth(c.index)
    const now = await target
      .evaluate((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(), undefined, { timeout: 2_000 })
      .catch(() => null)
    if (now !== c.name) {
      result.skipped.push(`${label}: 다시 열었을 때 같은 자리에 없음`)
      continue
    }
    const notices = outOfScopeNotices(page)
    const n0 = await notices.count()
    try {
      await target.click({ timeout: 3_000 })
    } catch (e) {
      result.skipped.push(`${label}: 누르지 못함(${String(e).split('\n')[0]})`)
      continue
    }
    result.checked += 1
    if (await countGrows(page, notices, n0, 900)) result.offenders.push(label)
  }
  return result
}

/** 지금 브라우저 저장소를 떠 두고, 이후 문서를 열 때마다 그 상태로 되돌린다(훑기에서 누른 것이 다음 확인에 남지 않게). */
export async function pinStorage(page: Page): Promise<void> {
  const snapshot = await page.evaluate(() => {
    const out: Array<[string, string]> = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k !== null) out.push([k, localStorage.getItem(k) ?? ''])
    }
    return out
  })
  await page.addInitScript((snap: Array<[string, string]>) => {
    try {
      localStorage.clear()
      for (const [k, v] of snap) localStorage.setItem(k, v)
    } catch {
      // 저장소가 막힌 환경이면 그대로 둔다
    }
  }, snapshot)
}

// ── 화면에서 재기 ──────────────────────────────────────────────
export type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number }

export async function rectOf(target: Locator): Promise<Box> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }
  })
}

/** 아래 고정 바가 화면 아래끝에서 띄워져 있을 수 있는 틈(px). 실측: ① 바가 아래끝 8px 위(sticky). */
export const BAR_GAP = 24

/** 고정(fixed·sticky)된 위·아래 띠를 뺀, 지금 실제로 보이는 세로 범위 */
export async function visibleBand(page: Page): Promise<{ top: number; bottom: number; viewport: number }> {
  return page.evaluate((BAR_GAP) => {
    const vh = window.innerHeight
    let top = 0
    let bottom = vh
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el)
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.height > vh / 2) continue
      if (r.bottom >= vh - BAR_GAP && r.top > vh / 2) bottom = Math.min(bottom, r.top)
      else if (r.top <= 2 && r.bottom > 0 && r.bottom < vh / 2) top = Math.max(top, r.bottom)
    }
    return { top, bottom, viewport: vh }
  }, BAR_GAP)
}

export function insideBand(box: Box, band: { top: number; bottom: number }): boolean {
  return box.height > 0 && box.top >= band.top - 1 && box.bottom <= band.bottom + 1
}

/** 이 요소가 화면 아래에 붙은 고정 바(fixed·sticky, 아래끝이 화면 아래끝 근처) 안에 있는가 */
export async function inBottomBar(target: Locator): Promise<boolean> {
  return target.evaluate((el, gap) => {
    const vh = window.innerHeight
    for (let n: Element | null = el; n; n = n.parentElement) {
      const p = getComputedStyle(n).position
      if (p === 'fixed' || p === 'sticky') {
        const r = n.getBoundingClientRect()
        return r.bottom >= vh - gap && r.bottom <= vh + 2 && r.top > vh / 2
      }
    }
    return false
  }, BAR_GAP)
}

export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
}

export async function scrollToBottom(page: Page): Promise<void> {
  let last = -1
  for (let i = 0; i < 20; i++) {
    const y = await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: 'instant' })
      return window.scrollY
    })
    if (y === last) return
    last = y
    await page.waitForTimeout(150)
  }
}

/** 스크롤이 멈출 때까지 기다린다(이동 직후 부드러운 스크롤이 끝난 화면을 재려고). */
export async function settleScroll(page: Page): Promise<void> {
  let last = -1
  for (let i = 0; i < 30; i++) {
    const y = await page.evaluate(() => window.scrollY)
    if (y === last) return
    last = y
    await page.waitForTimeout(150)
  }
}

/** 아래 고정 바 밑에 깔린(겹친) 글자. 바가 없으면 barTop null. */
export async function textUnderBottomBar(page: Page): Promise<{ barTop: number | null; covered: string[] }> {
  return page.evaluate((BAR_GAP) => {
    const vh = window.innerHeight
    const pinned = (el: Element | null): boolean => {
      for (let n = el; n; n = n.parentElement) {
        const p = getComputedStyle(n).position
        if (p === 'fixed' || p === 'sticky') return true
      }
      return false
    }
    const bars: DOMRect[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el)
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.height > vh / 2) continue
      if (r.bottom >= vh - BAR_GAP && r.top > vh / 2) bars.push(r)
    }
    if (bars.length === 0) return { barTop: null, covered: [] }
    const covered: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = (node.textContent ?? '').trim()
      const el = node.parentElement
      if (!text || !el || pinned(el)) continue
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 2 || r.height < 2) continue
        if (bars.some((b) => r.bottom > b.top + 1 && r.top < b.bottom - 1 && r.right > b.left && r.left < b.right)) {
          covered.push(text.slice(0, 40))
          break
        }
      }
    }
    return { barTop: Math.min(...bars.map((b) => b.top)), covered }
  }, BAR_GAP)
}

/** 요소 a 가 문서 순서로 b 보다 앞인가 */
export async function precedes(a: Locator, b: Locator): Promise<boolean> {
  const hb = await b.elementHandle()
  return a.evaluate((el, other) => other !== null && (el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, hb)
}

/**
 * 공고 원문 글 블록: 첫 줄과 끝 줄을 함께 품은 가장 작은 요소를 찾아, 그 안의 줄(innerText 줄)과
 * 그 안 <mark>마다 같은 줄 안에 다른 글이 붙어 있는지(문단 안 형광펜)를 돌려준다. 못 찾으면 null.
 */
export async function postingBlock(
  page: Page,
  sourceLines: string[],
): Promise<{ lines: string[]; marks: Array<{ text: string; inline: boolean }> } | null> {
  return page.evaluate((src) => {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    const first = src[0] ?? ''
    const last = src[src.length - 1] ?? ''
    const probe = first.slice(0, 12)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let block: HTMLElement | null = null
    let blockSize = Infinity
    while (walker.nextNode()) {
      if (!norm(walker.currentNode.textContent ?? '').includes(probe)) continue
      for (let n = walker.currentNode.parentElement; n && n !== document.body; n = n.parentElement) {
        if (!n.checkVisibility({ visibilityProperty: true })) break
        const t = norm(n.innerText)
        if (t.includes(first) && t.includes(last)) {
          if (t.length < blockSize) {
            block = n
            blockSize = t.length
          }
          break
        }
      }
    }
    if (!block) return null
    const root: HTMLElement = block
    // 화면낭독기 전용 글(1px 상자)은 보이는 줄이 아니므로 잠깐 빼고 줄을 읽는다
    const srOnly: Array<[HTMLElement, string]> = []
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect()
      if (getComputedStyle(el).position === 'absolute' && r.width <= 1 && r.height <= 1) {
        srOnly.push([el, el.style.display])
        el.style.display = 'none'
      }
    }
    const lines = root.innerText.split('\n').map(norm).filter(Boolean)
    for (const [el, display] of srOnly) el.style.display = display
    const isInline = (el: Element) => {
      const d = getComputedStyle(el).display
      return d.startsWith('inline') || d === 'contents'
    }
    const sideText = (node: Node | null, dir: 'prev' | 'next'): string => {
      for (let n = node; n; n = dir === 'prev' ? n.previousSibling : n.nextSibling) {
        if (n.nodeType === Node.TEXT_NODE) {
          const raw = n.textContent ?? ''
          const piece = dir === 'prev' ? (raw.split('\n').pop() ?? '') : (raw.split('\n')[0] ?? '')
          if (piece.trim()) return piece
          if (raw.includes('\n')) return ''
          continue
        }
        if (n instanceof Element) {
          if (n.tagName === 'BR' || !isInline(n)) return ''
          if ((n.textContent ?? '').trim()) return n.textContent ?? ''
        }
      }
      return ''
    }
    const marks = Array.from(root.querySelectorAll('mark')).map((m) => {
      let anchor: Element = m
      while (anchor.parentElement && anchor.parentElement !== root && isInline(anchor.parentElement) && norm(anchor.parentElement.textContent ?? '') === norm(m.textContent ?? '')) {
        anchor = anchor.parentElement
      }
      const inline = !!(sideText(anchor.previousSibling, 'prev').trim() || sideText(anchor.nextSibling, 'next').trim())
      return { text: norm(m.textContent ?? ''), inline }
    })
    return { lines, marks }
  }, sourceLines)
}

/** 원문을 줄로 나눈다(빈 줄 제외, 띄어쓰기 정리). */
export function sourceLinesOf(text: string): string[] {
  return text.split(/\r?\n/).map(normalize).filter(Boolean)
}

// ── 파일·명령 ─────────────────────────────────────────────────
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export const isObject = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)
export const repoPath = (rel: string): string => join(REPO_ROOT, ...rel.split('/'))
export const repoRel = (p: string): string => relative(REPO_ROOT, p).split(sep).join('/')

export function readRepoJson(rel: string): Json {
  return JSON.parse(readFileSync(repoPath(rel), 'utf8').replace(/^﻿/, '')) as Json
}

export function stringLeaves(v: Json | undefined, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => stringLeaves(x, out))
  else if (isObject(v)) Object.values(v).forEach((x) => stringLeaves(x, out))
  return out
}

export function numberLeaves(v: Json | undefined, path = '', out: Array<{ path: string; value: number }> = []): Array<{ path: string; value: number }> {
  if (typeof v === 'number') out.push({ path, value: v })
  else if (Array.isArray(v)) v.forEach((x, i) => numberLeaves(x, `${path}[${i}]`, out))
  else if (isObject(v)) Object.entries(v).forEach(([k, x]) => numberLeaves(x, path ? `${path}.${k}` : k, out))
  return out
}

/** 파일 안의 "객체만 든 배열"을 모두 찾는다(깊이 상관없이). */
export function objectArrays(v: Json | undefined, out: JsonObject[][] = []): JsonObject[][] {
  if (Array.isArray(v)) {
    const objs = v.filter(isObject)
    if (objs.length > 0 && objs.length === v.length) out.push(objs)
    v.forEach((x) => objectArrays(x, out))
  } else if (isObject(v)) Object.values(v).forEach((x) => objectArrays(x, out))
  return out
}

/** 키 이름이 re 에 맞는 값들(깊이 상관없이). */
export function valuesByKey(v: Json | undefined, re: RegExp, out: Array<{ key: string; value: Json }> = []): Array<{ key: string; value: Json }> {
  if (Array.isArray(v)) v.forEach((x) => valuesByKey(x, re, out))
  else if (isObject(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (re.test(k)) out.push({ key: k, value: x })
      valuesByKey(x, re, out)
    }
  }
  return out
}

/** 파일 "머리": 맨 위 객체에서 큰 배열(6개 이상)을 뺀 나머지를 글로 */
export function headerText(v: Json): string {
  if (!isObject(v)) return ''
  const head: JsonObject = {}
  for (const [k, x] of Object.entries(v)) if (!(Array.isArray(x) && x.length > 5)) head[k] = x
  return JSON.stringify(head)
}

export function datesIn(text: string): string[] {
  return [...new Set([...text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)].map((m) => `${m[1]}-${m[2]}-${m[3]}`))]
}

/** "2026.10.25" "2026-10-25" "2026년 10월 25일" → "2026-10-25" */
export function parseDisplayedDate(text: string): string | null {
  const m = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(text)
  if (!m) return null
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
}

export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...listFiles(p))
    else if (st.isFile()) out.push(p)
  }
  return out
}

export function readText(p: string, maxBytes = 20_000_000): string | null {
  try {
    if (statSync(p).size > maxBytes) return null
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** 명령을 레포(또는 cwd)에서 돌린다. Playwright 가 심은 NODE_OPTIONS 는 넘기지 않는다. */
export function runCommand(
  command: string,
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
): { ok: boolean; status: number | null; output: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', CI: '1', npm_config_update_notifier: 'false', ...opts.env }
  if (!opts.env?.NODE_OPTIONS) delete env.NODE_OPTIONS
  const r = spawnSync(command, { cwd: opts.cwd ?? REPO_ROOT, shell: true, encoding: 'utf8', timeout: opts.timeout ?? 300_000, env, maxBuffer: 64 * 1024 * 1024 })
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`
  return { ok: r.status === 0, status: r.status, output: output.slice(-6000) }
}

export function git(args: string[]): string {
  const r = spawnSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${r.stderr}`)
  return r.stdout
}

// ── .env · 받아 둔 원본(.cache/work24) ─────────────────────────
const SECRET_NAME = /KEY|TOKEN|SECRET|PASS/i

/** .env 줄(이름·값). 값은 시험 안에서 비교에만 쓰고 출력하지 않는다. 파일이 없으면 null. */
export function envEntries(): Array<{ name: string; value: string }> | null {
  const p = join(REPO_ROOT, '.env')
  if (!existsSync(p)) return null
  const out: Array<{ name: string; value: string }> = []
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    let value = m[2] ?? ''
    const quoted = /^(['"])(.*)\1$/.exec(value)
    if (quoted) value = quoted[2] ?? ''
    else value = value.replace(/\s+#.*$/, '')
    out.push({ name: m[1] ?? '', value })
  }
  return out
}

export const isSecretName = (name: string): boolean => SECRET_NAME.test(name)

export function envSecretValues(): string[] | null {
  const entries = envEntries()
  if (!entries) return null
  return entries.filter((e) => isSecretName(e.name) && e.value.length >= 8).map((e) => e.value)
}

export const CACHE_DIR = join(REPO_ROOT, '.cache', 'work24')
export const hasCache = (): boolean => listFiles(CACHE_DIR).length > 0

export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export type CacheIndex = { files: number; texts: string[]; leaves: Set<string> }

/** 받아 둔 원본의 글(XML 은 풀어서)과 JSON 값들. pick 으로 파일을 고를 수 있다. */
export function cacheIndex(pick: (rel: string, text: string) => boolean = () => true): CacheIndex {
  const index: CacheIndex = { files: 0, texts: [], leaves: new Set() }
  for (const f of listFiles(CACHE_DIR)) {
    const text = readText(f, 200_000_000)
    if (text === null || !pick(repoRel(f), text)) continue
    index.files += 1
    try {
      for (const s of stringLeaves(JSON.parse(text.replace(/^﻿/, '')) as Json)) index.leaves.add(normalize(s))
      index.texts.push(normalize(text))
    } catch {
      const decoded = decodeXml(text)
      index.texts.push(normalize(decoded))
      for (const m of decoded.matchAll(/>([^<>]+)</g)) {
        const v = normalize(m[1] ?? '')
        if (v) index.leaves.add(v)
      }
    }
  }
  return index
}

export function inCache(index: CacheIndex, value: string): boolean {
  const v = normalize(value)
  return index.leaves.has(v) || index.texts.some((t) => t.includes(v))
}

// ── 모의 공고 ─────────────────────────────────────────────────
export type Posting = JsonObject

/** data/postings.json 의 공고들(jobCont 가 든 객체 배열 중 가장 긴 것) */
export function loadPostings(): Posting[] {
  const arrays = objectArrays(readRepoJson('data/postings.json')).filter((a) => a.some((o) => typeof o.jobCont === 'string'))
  return arrays.sort((a, b) => b.length - a.length)[0] ?? []
}

export const str = (v: Json | undefined): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** PDF 쪽수(/Type /Pages 의 /Count, 없으면 /Type /Page 개수) */
export function pdfPageCount(pdf: Buffer): number {
  const s = pdf.toString('latin1')
  const counts = [...s.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)/g)].map((m) => Number(m[1]))
  if (counts.length > 0) return Math.max(...counts)
  return (s.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
}
