/**
 * 6차 추가분(2026-10-26 밤샘) 시험 도우미. docs/ACCEPTANCE.md 「6차 추가분」만 보고 쓴다.
 * 화면은 역할·이름·글자(「정확한 문구」)로 찾고, 위치·높이·밝기처럼 재야 하는 것은 찾은 요소나 화면 캡처에서 계산한다.
 * CSS 클래스·data-testid·data-tour는 쓰지 않는다(ACCEPTANCE에 적힌 aria-*·role=dialog/status·<mark data-drawn>·data-active만).
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import {
  POSTING_LOADING_STEPS,
  POSTING_LOADING_TITLE,
  TOUR_STEP_RE,
  WHY_TEXT,
  cardGroups,
  demoItem,
  demoToolsButton,
  normalize,
  questionSentence,
  readClipboard,
  tourDialog,
} from './helpers'
import { listFiles, objectArrays, readRepoJson, readText, rectOf, repoPath, stringLeaves, textUnderBottomBar, valuesByKey, type Box } from './helpers2'

// ── 정확한 문구(6차) ───────────────────────────────────────────
export const COPY_ALL = '전체 복사'
export const PRINT_ONE = '면접에 들고 갈 한 장 인쇄'
export const WENT_BUTTON = '면접 다녀왔어요'
export const KEEP_PHRASE = '면접에서 쓸 것 같아요'
export const FEW_PHRASE = '면접에서는 보통 한두 개만 물을 수 있어요'
export const EXTRA_HEADING = '더 알아볼 질문'
export const EXTRA_LIST = '더 알아볼 질문 목록'
export const FINAL_GROUPS = ['최종 면접에서 물을 것', '처우 협의 때 물을 것'] as const
export const HELP_TEXT = '도움말'
export const LOADING_TITLE = POSTING_LOADING_TITLE
export const LOADING_STEPS = POSTING_LOADING_STEPS
export const TOUR_OFF_KEY = 'rq:test:tour-off'
/** TR 시험용: 시험 스위치(TR-09)를 뺀 빈 저장 상태 */
export const NO_TOUR_SWITCH = { cookies: [], origins: [] }
export const TOUR_BUTTONS = { prev: '이전', next: '다음', skip: '건너뛰기', startS1: '시작하기', close: '닫기' } as const
/** TR-01: S1 서비스 안내 설명 글에 모두 나와야 하는 낱말 */
export const SERVICE_TOUR_WORDS = ['채용정보', '지원 현황', '1차', '최종', '이력서', '시연 도구'] as const

// ── 작은 도구 ──────────────────────────────────────────────────
export type Rect = { left: number; top: number; right: number; bottom: number }

export const intersects = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** 두 상자 사이 거리(겹치면 0) */
export function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right)
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom)
  return Math.hypot(dx, dy)
}

/** 문서 기준 위치(스크롤과 상관없음) */
export async function docBox(target: Locator): Promise<Box> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left + window.scrollX, right: r.right + window.scrollX, width: r.width, height: r.height }
  })
}

export async function viewport(page: Page): Promise<{ vw: number; vh: number; scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    vh: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
}

/** 요소 가로 넘침(W-09와 같은 잣대: 안쪽 scrollWidth <= clientWidth, 오른쪽 끝 <= 화면 폭) */
export async function expectNoSideOverflow(target: Locator, label: string): Promise<void> {
  const o = await target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { inner: el.scrollWidth, outer: el.clientWidth, right: r.right, vw: document.documentElement.clientWidth }
  })
  expect(o.inner, `${label}: 안쪽 넘침(scrollWidth ${o.inner} > clientWidth ${o.outer})`).toBeLessThanOrEqual(o.outer + 1)
  expect(o.right, `${label}: 오른쪽 끝 ${Math.round(o.right)} > 화면 폭 ${o.vw}`).toBeLessThanOrEqual(o.vw + 1)
}

export async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  const v = await viewport(page)
  expect(v.scrollWidth, `${label}: 가로 넘침(scrollWidth ${v.scrollWidth} > clientWidth ${v.clientWidth})`).toBeLessThanOrEqual(v.clientWidth)
}

/** 아래 고정 바(helpers2 textUnderBottomBar 와 같은 잣대)가 지금 화면에 있는가 */
export async function hasBottomBar(page: Page): Promise<boolean> {
  return (await textUnderBottomBar(page)).barTop !== null
}

/** 요소를 품은 고정(fixed·sticky) 띠 안의 보이는 버튼·링크 이름(띠가 없으면 null) */
export async function pinnedBarControls(target: Locator): Promise<string[] | null> {
  return target.evaluate((el) => {
    let bar: Element | null = null
    for (let n: Element | null = el; n; n = n.parentElement) {
      const p = getComputedStyle(n).position
      if (p === 'fixed' || p === 'sticky') {
        bar = n
        break
      }
    }
    if (!bar) return null
    return Array.from(bar.querySelectorAll('button, a[href], [role="button"], [role="link"]'))
      .filter((c) => (c as HTMLElement).checkVisibility({ visibilityProperty: true }) && c.getBoundingClientRect().width > 1)
      .map((c) => (c.getAttribute('aria-label') ?? c.textContent ?? '').replace(/\s+/g, ' ').trim())
  })
}

// ── ③ 결과 화면(RS) ────────────────────────────────────────────
export function copyAllButton(page: Page): Locator {
  return page.getByRole('button', { name: COPY_ALL, exact: true })
}

export function printButton(page: Page): Locator {
  return page.getByRole('button', { name: PRINT_ONE, exact: true })
}

/** ③ 오른쪽 상자(complementary) — "전체 복사"를 품은 것 */
export function resultSide(page: Page): Locator {
  return page.getByRole('complementary').filter({ has: copyAllButton(page) })
}

export function extraList(page: Page): Locator {
  return page.getByRole('list', { name: EXTRA_LIST })
}

/** "더 알아볼 질문" 문장들(항목마다 카드 이름·"탐색" 칩이 아닌 가장 긴 줄) */
export async function extraSentences(page: Page): Promise<string[]> {
  const items = extraList(page).getByRole('listitem')
  const n = await items.count()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const lines = (await items.nth(i).innerText()).split('\n').map(normalize).filter((l) => l && l !== '탐색')
    out.push([...lines].sort((a, b) => b.length - a.length)[0] ?? '')
  }
  return out
}

/** 최종 ③ 묶음(소제목 이름 + " 목록") 안의 질문 문장들(화면 순서) */
export async function groupSentences(page: Page, group: string): Promise<string[]> {
  const items = page.getByRole('list', { name: `${group} 목록` }).getByRole('listitem').filter({ has: page.getByText(WHY_TEXT) })
  const n = await items.count()
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(normalize(await questionSentence(items.nth(i))))
  return out
}

/** "전체 복사"를 눌러 클립보드 글을 돌려준다(권한 clipboard-read·write 필요) */
export async function copyAllText(page: Page): Promise<string> {
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await copyAllButton(page).click()
  await expect.poll(() => readClipboard(page), { message: '"전체 복사" 뒤 클립보드가 비어 있다' }).not.toBe('')
  return readClipboard(page)
}

/** 글 안에서 조각들이 이 순서로(뒤로만) 나오는지. 못 찾은 조각은 -1 */
export function positionsInOrder(text: string, pieces: readonly string[], from = 0): number[] {
  const out: number[] = []
  let at = from
  for (const p of pieces) {
    const i = text.indexOf(p, at)
    out.push(i)
    if (i >= 0) at = i + p.length
  }
  return out
}

/** 질문 카드 안의 보이는 버튼·링크 이름 */
export async function itemControls(item: Locator): Promise<string[]> {
  return item
    .getByRole('button')
    .or(item.getByRole('link'))
    .filter({ visible: true })
    .evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()))
}

/** 질문 문장 요소와 「왜 이 질문인가요」 사이 틈·사이 글·펼침 아래 남는 높이(RS-06) */
export async function sentenceToWhyGeometry(item: Locator, sentence: string): Promise<{ gap: number; between: string[]; tail: number } | null> {
  return item.evaluate(
    (root, [s, why]) => {
      const norm = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim()
      const all = [root, ...Array.from(root.querySelectorAll('*'))]
      const smallest = (needle: string) =>
        all.filter((e) => norm(e.textContent).includes(needle)).sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0] ?? null
      const holder = smallest(s)
      const toggle = smallest(why)
      if (!holder || !toggle) return null
      const between: string[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        const text = norm(node.textContent)
        const parent = node.parentElement
        if (!text || !parent || holder.contains(node) || toggle.contains(node)) continue
        const afterHolder = (holder.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        const beforeToggle = (toggle.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
        if (afterHolder && beforeToggle && parent.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && parent.getBoundingClientRect().width > 1) between.push(text)
      }
      const h = holder.getBoundingClientRect()
      const t = toggle.getBoundingClientRect()
      return { gap: t.top - h.bottom, between, tail: root.getBoundingClientRect().bottom - t.bottom }
    },
    [sentence, WHY_TEXT] as const,
  )
}

// ── ② 카드와 도움말(HP) ───────────────────────────────────────
/** 카드 radiogroup 들의 이름(카드 이름) — 화면 순서 */
export async function cardNames(page: Page): Promise<string[]> {
  return cardGroups(page).evaluateAll((groups) =>
    groups.map((g) => {
      const label =
        g.getAttribute('aria-label') ??
        (g.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
      return label.replace(/\s+/g, ' ').trim()
    }),
  )
}

export function helpButton(page: Page, card: string): Locator {
  return page.getByRole('button', { name: `${card} ${HELP_TEXT}`, exact: true })
}

export function helpDialog(page: Page, card: string): Locator {
  return page.getByRole('dialog', { name: `${card} ${HELP_TEXT}`, exact: true })
}

/** 보이는 도움말 팝업 전부 */
export function openHelpDialogs(page: Page): Locator {
  return page.getByRole('dialog', { name: new RegExp(`\\s${HELP_TEXT}$`) }).filter({ visible: true })
}

/** 카드 상자: 그 카드 radiogroup 과 그 카드 "도움말" 버튼을 함께 품은 가장 안쪽 요소 */
export function cardBox(page: Page, card: string): Locator {
  return page
    .locator('*')
    .filter({ has: page.getByRole('radiogroup', { name: card, exact: true }) })
    .filter({ has: helpButton(page, card) })
    .last()
}

/**
 * 카드마다 보이는 카드 상자(카드 radiogroup 하나만 품은 조상 가운데 테두리·바탕·그림자가 있는 가장 바깥 것, 없으면 가장 바깥)의 위치와,
 * 그 안 보이는 글·컨트롤 중 가장 아래끝(제 내용 높이 확인용).
 */
export async function cardVisualBoxes(page: Page): Promise<Array<Box & { contentBottom: number }>> {
  return cardGroups(page).evaluateAll((groups) =>
    groups.map((g) => {
      const chain: Element[] = [g]
      while (chain[chain.length - 1]!.parentElement && chain[chain.length - 1]!.parentElement!.querySelectorAll('[role="radiogroup"]').length === 1) {
        chain.push(chain[chain.length - 1]!.parentElement!)
      }
      const painted = (el: Element) => {
        const cs = getComputedStyle(el)
        const border = ['Top', 'Right', 'Bottom', 'Left'].some(
          (s) => parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.getPropertyValue(`border-${s.toLowerCase()}-color`)),
        )
        const bg = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
        return border || bg || cs.boxShadow !== 'none'
      }
      const box = [...chain].reverse().find(painted) ?? chain[chain.length - 1]!
      const r = box.getBoundingClientRect()
      let contentBottom = r.top
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const p = walker.currentNode.parentElement
        if (!p || !(walker.currentNode.textContent ?? '').trim() || !p.checkVisibility({ visibilityProperty: true })) continue
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const rr of Array.from(range.getClientRects())) if (rr.height > 0) contentBottom = Math.max(contentBottom, rr.bottom)
      }
      for (const c of Array.from(box.querySelectorAll('button, input, a[href], [role="radio"], [role="button"]'))) {
        const rr = c.getBoundingClientRect()
        if (rr.height > 0 && (c as HTMLElement).checkVisibility({ visibilityProperty: true })) contentBottom = Math.max(contentBottom, rr.bottom)
      }
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, contentBottom }
    }),
  )
}

/** data/cards.backend.json 에서 그 카드의 examples(글 값) — 카드 이름이 글 값으로 든 객체 */
export function cardExamples(card: string): string[] {
  const file = readRepoJson('data/cards.backend.json')
  for (const arr of objectArrays(file)) {
    for (const o of arr) {
      if (!('examples' in o)) continue
      const own = Object.values(o).filter((v): v is string => typeof v === 'string').map(normalize)
      if (own.includes(card)) return stringLeaves(o.examples).map(normalize).filter(Boolean)
    }
  }
  return []
}

/** 카드 안에서 잘린(말줄임) 글 — 카드 이름은 뺀다(HP-06) */
export async function truncatedTexts(box: Locator, card: string): Promise<string[]> {
  return box.evaluate((root, name) => {
    const out: string[] = []
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const cs = getComputedStyle(el)
      const clamp = cs.getPropertyValue('-webkit-line-clamp')
      const clamped = (clamp && clamp !== 'none') || cs.textOverflow === 'ellipsis'
      if (!clamped) continue
      const cut = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (cut && text && text !== name) out.push(text)
    }
    return out
  }, card)
}

/** 초점이 이 요소 안에 있는가 */
export async function focusInside(target: Locator): Promise<boolean> {
  return target.evaluate((el) => el.contains(document.activeElement)).catch(() => false)
}

// ── ① 공고 분석 로딩·형광펜(LD) ───────────────────────────────
/** (주)OO소프트(K-MOCK-0001) 공고 분석의 근거 인용들(data/analysis 의 quote 값) */
export function analysisQuotes(wantedAuthNo = 'K-MOCK-0001'): string[] {
  const file = readRepoJson(`data/analysis/${wantedAuthNo}.json`)
  const quotes = valuesByKey(file, /^quote$/)
    .map((q) => q.value)
    .filter((v): v is string => typeof v === 'string')
    .map(normalize)
    .filter(Boolean)
  return [...new Set(quotes)]
}

export function loadingStatus(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: LOADING_TITLE })
}

export type LdRecord = {
  /** 로딩(role=status, 제목 포함)이 처음 보인 때·사라진 때(performance.now) */
  shown: number | null
  hidden: number | null
  /** 단계 3줄·근거 인용이 로딩 안에서 처음 보인 때 */
  steps: Array<number | null>
  quotes: Array<number | null>
  /** data-drawn="false" 로 보인 형광펜 수 */
  falseSeen: number
  /** 로딩이 끝나고 150ms 뒤 화면 안에 있던 형광펜(문서 순서 번호) */
  firstView: number[] | null
}

export type LdMark = { i: number; text: string; drawn: string | null; t: number | null; top: number; bottom: number; vh: number }

/**
 * 페이지 안에서 매 프레임 로딩과 형광펜을 기록한다(페이지를 열기 전에 부른다).
 * window.__ld(기록) · __ldReset() · __ldMarks()(지금 형광펜과 칠해진 때).
 */
export async function installLdRecorder(page: Page, quotes: readonly string[] = []): Promise<void> {
  await page.addInitScript(
    ({ title, steps, quotes: qs }) => {
      type Rec = { shown: number | null; hidden: number | null; steps: Array<number | null>; quotes: Array<number | null>; falseSeen: number; firstView: number[] | null }
      const w = window as unknown as { __ld: Rec; __ldReset: () => void; __ldMarks: () => unknown[] }
      const fresh = (): Rec => ({ shown: null, hidden: null, steps: steps.map(() => null), quotes: qs.map(() => null), falseSeen: 0, firstView: null })
      let seenFalse = new WeakSet<Element>()
      let drawnAt = new WeakMap<Element, number>()
      w.__ld = fresh()
      w.__ldReset = () => {
        w.__ld = fresh()
        seenFalse = new WeakSet()
        drawnAt = new WeakMap()
      }
      const norm = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim()
      const visibleHolder = (root: Element, text: string): boolean => {
        const all = [root, ...Array.from(root.querySelectorAll('*'))]
        return all.some(
          (el) =>
            norm(el.textContent).includes(text) &&
            !Array.from(el.children).some((c) => norm(c.textContent).includes(text)) &&
            el.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        )
      }
      const tick = () => {
        const rec = w.__ld
        const now = performance.now()
        const statuses = Array.from(document.querySelectorAll('[role="status"]')).filter(
          (el) => (el.textContent ?? '').includes(title) && el.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        )
        if (statuses.length > 0) {
          if (rec.shown === null) rec.shown = now
          steps.forEach((s, i) => {
            if (rec.steps[i] === null && statuses.some((st) => visibleHolder(st, s))) rec.steps[i] = now
          })
          qs.forEach((q, i) => {
            if (rec.quotes[i] === null && statuses.some((st) => visibleHolder(st, q))) rec.quotes[i] = now
          })
        } else if (rec.shown !== null && rec.hidden === null) {
          rec.hidden = now
        }
        const marks = Array.from(document.querySelectorAll('mark'))
        for (const m of marks) {
          const v = m.getAttribute('data-drawn')
          if (v === 'false' && !seenFalse.has(m)) {
            seenFalse.add(m)
            rec.falseSeen += 1
          }
          if (v === 'true' && !drawnAt.has(m)) drawnAt.set(m, now)
        }
        if (rec.hidden !== null && rec.firstView === null && now - rec.hidden >= 150) {
          rec.firstView = marks
            .map((m, i) => {
              const r = m.getBoundingClientRect()
              return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? i : -1
            })
            .filter((i) => i >= 0)
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      w.__ldMarks = () =>
        Array.from(document.querySelectorAll('mark')).map((m, i) => {
          const r = m.getBoundingClientRect()
          return { i, text: norm(m.textContent), drawn: m.getAttribute('data-drawn'), t: drawnAt.get(m) ?? null, top: r.top, bottom: r.bottom, vh: window.innerHeight }
        })
    },
    { title: LOADING_TITLE, steps: [...LOADING_STEPS] as string[], quotes: [...quotes] },
  )
}

export async function ldRecord(page: Page): Promise<LdRecord> {
  return page.evaluate(() => (window as unknown as { __ld: LdRecord }).__ld)
}

export async function ldReset(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __ldReset: () => void }).__ldReset())
}

export async function ldMarks(page: Page): Promise<LdMark[]> {
  return page.evaluate(() => (window as unknown as { __ldMarks: () => LdMark[] }).__ldMarks())
}

/** 지금 초점이 간 제목(h1~h6·role=heading)과 그것이 단계 표시보다 뒤(① 내용 안)인지 */
export async function focusedHeading(page: Page): Promise<{ text: string; afterSteps: boolean } | null> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const isHeading = /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading'
    if (!isHeading) return null
    const step = document.querySelector('[aria-current="step"]')
    const afterSteps = step ? (step.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 : false
    return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), afterSteps }
  })
}

/** 보이는 형광펜의 칠한 모양(LD-03: 다 칠한 모양 = 지금 형광펜) */
export async function markLook(mark: Locator): Promise<Record<string, string>> {
  return mark.evaluate((el) => {
    const cs = getComputedStyle(el)
    const keys = ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'color'] as const
    const out: Record<string, string> = {}
    for (const k of keys) out[k] = cs[k]
    return out
  })
}

// ── 처음 온 사람 안내(TR) ─────────────────────────────────────
export type TourStep = { n: number; m: number; text: string; buttons: string[]; box: Box; vw: number; vh: number; scrollWidth: number; clientWidth: number }

export async function tourStepNumber(page: Page): Promise<{ n: number; m: number } | null> {
  const d = tourDialog(page).filter({ visible: true }).first()
  if (!(await d.isVisible().catch(() => false))) return null
  const m = TOUR_STEP_RE.exec(normalize(await d.innerText().catch(() => '')))
  return m ? { n: Number(m[1]), m: Number(m[2]) } : null
}

export async function readTourStep(page: Page): Promise<TourStep> {
  const d = tourDialog(page).filter({ visible: true }).first()
  await expect(d, '안내 설명 상자').toBeVisible()
  const text = normalize(await d.innerText())
  const m = TOUR_STEP_RE.exec(text)
  if (!m) throw new Error(`안내 설명 상자에서 "N/M"을 찾지 못했다: ${text}`)
  const buttons = await d
    .getByRole('button')
    .filter({ visible: true })
    .evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()))
  const box = await rectOf(d)
  return { n: Number(m[1]), m: Number(m[2]), text, buttons, box, ...(await viewport(page)) }
}

/** 안내를 "다음"으로 끝 단계까지 넘기며 단계마다 onStep 을 부른다(끝 단계 버튼은 누르지 않는다). */
export async function walkTour(page: Page, onStep?: (s: TourStep) => Promise<void>): Promise<TourStep[]> {
  const steps: TourStep[] = []
  for (let guard = 0; guard < 12; guard++) {
    await page.waitForTimeout(400) // 비춤 이동·스크롤이 멈춘 뒤 잰다
    const s = await readTourStep(page)
    steps.push(s)
    if (onStep) await onStep(s)
    if (s.n >= s.m) return steps
    await tourDialog(page).getByRole('button', { name: TOUR_BUTTONS.next, exact: true }).click()
    await expect.poll(async () => (await tourStepNumber(page))?.n, { message: `"다음" 뒤 ${s.n + 1}/${s.m}` }).toBe(s.n + 1)
  }
  throw new Error('안내 단계가 12개를 넘는다')
}

export async function skipTour(page: Page): Promise<void> {
  const d = tourDialog(page).filter({ visible: true }).first()
  await d.getByRole('button', { name: TOUR_BUTTONS.skip, exact: true }).click()
  await expect(tourDialog(page).filter({ visible: true }), '건너뛰기 뒤 안내가 닫혀야 한다').toHaveCount(0)
}

/** ms 동안 안내가 한 번도 뜨지 않는지 */
export async function expectNoTour(page: Page, label: string, ms = 2_500): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    expect(await tourDialog(page).filter({ visible: true }).count(), `${label}: 안내가 뜨면 안 된다`).toBe(0)
    await page.waitForTimeout(150)
  }
}

export async function waitTour(page: Page, label: string, timeout = 15_000): Promise<void> {
  await expect(tourDialog(page).filter({ visible: true }).first(), `${label}: 안내가 저절로 시작돼야 한다`).toBeVisible({ timeout })
}

/** 시연 도구 메뉴를 열어 항목 하나를 누른다(안내가 떠 있지 않을 때). */
export async function demoMenuClick(page: Page, name: string): Promise<void> {
  await demoToolsButton(page).click()
  await demoItem(page, name).click()
}

/** 시연 도구 메뉴를 열어 그 이름의 항목이 보이는지 보고 닫는다. */
export async function demoMenuHas(page: Page, name: string): Promise<boolean> {
  await demoToolsButton(page).click()
  const shown = await demoItem(page, name)
    .isVisible()
    .catch(() => false)
  await page.keyboard.press('Escape')
  if (await demoItem(page, '시연 초기화').isVisible().catch(() => false)) await demoToolsButton(page).click()
  return shown
}

// ── 화면 캡처 밝기(비춤 확인) ─────────────────────────────────
export type Png = { width: number; height: number; rgba: Uint8Array }

/** 8비트·비인터레이스 RGB/RGBA PNG 풀기(Playwright 캡처용, 새 의존성 없이 zlib 만) */
export function decodePng(buf: Buffer): Png {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('PNG 가 아니다')
  let off = 8
  let width = 0
  let height = 0
  let depth = 0
  let color = 0
  let interlace = 0
  const idat: Buffer[] = []
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      depth = data[8] ?? 0
      color = data[9] ?? 0
      interlace = data[12] ?? 0
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) throw new Error(`풀 수 없는 PNG(깊이 ${depth}, 색 ${color}, 인터레이스 ${interlace})`)
  const bpp = color === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const rgba = new Uint8Array(width * height * 4)
  let prev = new Uint8Array(stride)
  let cur = new Uint8Array(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++] ?? 0
    for (let x = 0; x < stride; x++) {
      const r = raw[p++] ?? 0
      const a = x >= bpp ? (cur[x - bpp] ?? 0) : 0
      const b = prev[x] ?? 0
      const c = x >= bpp ? (prev[x - bpp] ?? 0) : 0
      let v: number
      switch (filter) {
        case 0:
          v = r
          break
        case 1:
          v = r + a
          break
        case 2:
          v = r + b
          break
        case 3:
          v = r + ((a + b) >> 1)
          break
        case 4: {
          const pa = Math.abs(b - c)
          const pb = Math.abs(a - c)
          const pc = Math.abs(a + b - 2 * c)
          v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default:
          throw new Error(`PNG 필터 ${filter}`)
      }
      cur[x] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      rgba[o] = cur[x * bpp] ?? 0
      rgba[o + 1] = cur[x * bpp + 1] ?? 0
      rgba[o + 2] = cur[x * bpp + 2] ?? 0
      rgba[o + 3] = bpp === 4 ? (cur[x * bpp + 3] ?? 255) : 255
    }
    const t = prev
    prev = cur
    cur = t
  }
  return { width, height, rgba }
}

/** spansScreen: 화면 양옆 끝(또는 위아래 끝)에 다 닿는 밝은 덩어리 — 막이 없어 화면 전체가 밝은 경우이지 비춘 대상이 아니다 */
export type SpotCluster = { cells: number; bbox: Rect; minLum: number; spansScreen: boolean }
export type SpotAnalysis = { vw: number; vh: number; dimFraction: number; clusters: SpotCluster[] }

/**
 * 안내가 떠 있는 지금 화면을 캡처해 밝기로 비춤을 읽는다.
 * 8px 칸마다 가장 밝은 점이 0.92 이상이면 "밝은 칸"(어두운 막이 덮이지 않은 흰 바탕). 설명 상자(+16px)는 뺀다.
 * 밝은 칸이 이어진 덩어리(3칸 이상)가 비춘 대상이고, 그 밖(대상 상자 +8px 밖)에서 밝지 않은 칸의 비율이 dimFraction 이다.
 */
export async function analyzeSpotlight(page: Page, dialog: Rect): Promise<SpotAnalysis> {
  const CELL = 8
  const LIT = 0.92
  const png = decodePng(await page.screenshot({ scale: 'css', animations: 'disabled' }))
  const cols = Math.floor(png.width / CELL)
  const rows = Math.floor(png.height / CELL)
  const maxL = new Float32Array(cols * rows)
  const minL = new Float32Array(cols * rows).fill(1)
  for (let y = 0; y < rows * CELL; y++) {
    for (let x = 0; x < cols * CELL; x++) {
      const o = (y * png.width + x) * 4
      const lum = (0.2126 * (png.rgba[o] ?? 0) + 0.7152 * (png.rgba[o + 1] ?? 0) + 0.0722 * (png.rgba[o + 2] ?? 0)) / 255
      const k = Math.floor(y / CELL) * cols + Math.floor(x / CELL)
      if (lum > (maxL[k] ?? 0)) maxL[k] = lum
      if (lum < (minL[k] ?? 1)) minL[k] = lum
    }
  }
  const cellRect = (k: number): Rect => {
    const cx = k % cols
    const cy = Math.floor(k / cols)
    return { left: cx * CELL, top: cy * CELL, right: (cx + 1) * CELL, bottom: (cy + 1) * CELL }
  }
  const grow = (r: Rect, g: number): Rect => ({ left: r.left - g, top: r.top - g, right: r.right + g, bottom: r.bottom + g })
  const dlg = grow(dialog, 16)
  const inDialog = new Uint8Array(cols * rows)
  const lit = new Uint8Array(cols * rows)
  for (let k = 0; k < cols * rows; k++) {
    inDialog[k] = intersects(cellRect(k), dlg) ? 1 : 0
    lit[k] = !inDialog[k] && (maxL[k] ?? 0) >= LIT ? 1 : 0
  }
  const seen = new Uint8Array(cols * rows)
  const clusters: SpotCluster[] = []
  for (let k = 0; k < cols * rows; k++) {
    if (!lit[k] || seen[k]) continue
    const queue = [k]
    seen[k] = 1
    const members: number[] = []
    while (queue.length > 0) {
      const c = queue.pop() as number
      members.push(c)
      const cx = c % cols
      const cy = Math.floor(c / cols)
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const nk = ny * cols + nx
        if (lit[nk] && !seen[nk]) {
          seen[nk] = 1
          queue.push(nk)
        }
      }
    }
    if (members.length < 3) continue
    const rects = members.map(cellRect)
    const bbox = {
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      right: Math.max(...rects.map((r) => r.right)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    }
    let minLum = 1
    for (let q = 0; q < cols * rows; q++) if (!inDialog[q] && intersects(cellRect(q), bbox)) minLum = Math.min(minLum, minL[q] ?? 1)
    const spansScreen = (bbox.left <= 0 && bbox.right >= cols * CELL) || (bbox.top <= 0 && bbox.bottom >= rows * CELL)
    clusters.push({ cells: members.length, bbox, minLum, spansScreen })
  }
  let outside = 0
  let dark = 0
  for (let k = 0; k < cols * rows; k++) {
    if (inDialog[k]) continue
    if (clusters.some((c) => intersects(cellRect(k), grow(c.bbox, 8)))) continue
    outside += 1
    if (!lit[k]) dark += 1
  }
  // 잴 칸이 없으면(밝은 덩어리가 화면을 다 덮음) 어둡다고 치지 않는다
  return { vw: png.width, vh: png.height, dimFraction: outside === 0 ? 0 : dark / outside, clusters }
}

// ── 문서(md) 읽기 ─────────────────────────────────────────────
export type MdSection = { level: number; title: string; body: string }

/** 제목(#)마다 그 아래(같거나 높은 제목 전까지) 글. 코드 울타리 안의 #은 제목으로 보지 않는다. */
export function mdSections(md: string): MdSection[] {
  const lines = md.split(/\r?\n/)
  const heads: Array<{ level: number; title: string; line: number }> = []
  let fence = false
  lines.forEach((l, i) => {
    if (/^\s*(?:```|~~~)/.test(l)) {
      fence = !fence
      return
    }
    if (fence) return
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l)
    if (m) heads.push({ level: (m[1] ?? '#').length, title: m[2] ?? '', line: i })
  })
  return heads.map((h, k) => {
    let end = lines.length
    for (let j = k + 1; j < heads.length; j++) {
      const next = heads[j]
      if (next && next.level <= h.level) {
        end = next.line
        break
      }
    }
    return { level: h.level, title: h.title, body: lines.slice(h.line + 1, end).join('\n') }
  })
}

export function mdSection(md: string, title: RegExp): MdSection | undefined {
  return mdSections(md).find((s) => title.test(s.title))
}

/** 문서 맨 위: "흐름" 제목 전까지(없으면 처음 60줄), 최대 80줄 */
export function mdHead(md: string): string {
  const lines = md.split(/\r?\n/)
  const flow = lines.findIndex((l) => /^#{2,6}\s+.*흐름/.test(l))
  const end = Math.min(flow > 0 ? flow : 60, 80)
  return lines.slice(0, end).join('\n')
}

export function readRepoText(rel: string): string | null {
  const p = repoPath(rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** dist/ 안 글 파일(지도 파일 제외)에서 낱말을 찾는다. JS 의 \uXXXX 풀어 쓴 글자도 풀어서 본다. */
export function distFilesContaining(word: string): { files: number; hits: string[] } {
  const unescape = (s: string) =>
    s
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
  const files = listFiles(repoPath('dist')).filter((f) => /\.(?:m?js|css|html|json|txt|svg|webmanifest)$/.test(f))
  const hits: string[] = []
  for (const f of files) {
    const text = readText(f)
    if (text !== null && unescape(text).includes(word)) hits.push(f)
  }
  return { files: files.length, hits }
}
