/**
 * Q-01~04 — 감사에서 남은 지적(DA-01~08). ACCEPTANCE.md 「2차 추가분 · Q」.
 */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BANNER_TEXTS,
  FINAL_TYPES,
  LOADING_TEXTS,
  PREP_BUTTON,
  REPO_ROOT,
  S3_TITLE,
  applicationEntries,
  copyQuestion,
  expectCurrentStep,
  fillPresetA,
  goToCardsStep,
  goToReviewStep,
  gotoApplications,
  heading,
  installPrintSpy,
  itemTexts,
  itemTypes,
  makeFinalQuestions,
  makeFirstQuestions,
  makeQuestionsButton,
  normalize,
  openPrep,
  printCalls,
  questionItems,
  rowCells,
  stepList,
  stepText,
  stepUrl,
} from './helpers'
import { FINAL_HEAD, PRINT_BUTTON, insideBand, pdfPageCount, precedes, rectOf, repoPath, settleScroll, visibleBand } from './helpers2'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })
test.describe.configure({ timeout: 120_000 })

const QUOTE_WORDS = /아까|하셨는데|말씀하신/

/** 앞에 붙은 완충 문장("…여쭤도 될까요?")을 뗀 질문 본문 */
function withoutBuffers(sentence: string): string {
  const parts = normalize(sentence).split(/(?<=[?!.])\s+/)
  while (parts.length > 1 && /여쭤도 될까요\?$/.test(parts[0] ?? '')) parts.shift()
  return parts.join(' ')
}

// ── Q-01 최종 "다시 확인" 문장 ─────────────────────────────────

test('Q-01 (주)OO소프트 + R-04 최종 1번 "다시 확인" 질문이 1차 질문을 이어 받는다: "상주" + "비율"·"기간", "투입되는 경우도 있나요"로 시작하지 않음, 인용 금지 유지', async ({ page }) => {
  await makeFinalQuestions(page)
  const items = questionItems(page)
  expect((await itemTypes(items, FINAL_TYPES))[0], '최종 1번 질문 유형').toBe('다시 확인')
  const first = normalize(await copyQuestion(page, items.first()))
  expect(first, '최종 1번 질문에 "상주"').toContain('상주')
  expect(first, '최종 1번 질문에 "비율" 또는 "기간"').toMatch(/비율|기간/)
  const body = withoutBuffers(first)
  const opening = body.split(/(?<=[?!.])\s+/)[0] ?? ''
  expect(body.startsWith('투입되는 경우도 있나요'), `최종 1번 질문이 "투입되는 경우도 있나요"로 시작하면 안 된다: ${first}`).toBe(false)
  expect(opening, `최종 1번 질문의 첫 물음이 "…투입되는 경우도 있나요?"(처음부터 다시 묻기)면 안 된다: ${first}`).not.toContain('투입되는 경우도 있나요')
  for (const [i, t] of (await itemTexts(items)).entries()) expect(t, `${i + 1}번 최종 질문: 1차 면접관 인용 표현`).not.toMatch(QUOTE_WORDS)
})

// ── Q-02 인쇄 1쪽 ─────────────────────────────────────────────

test('Q-02 최종 ③ "면접에 들고 갈 한 장 인쇄"가 A4 1쪽(page.pdf)', async ({ page, isMobile }) => {
  test.skip(isMobile, '인쇄는 화면 폭과 상관없이 A4라 데스크톱에서 한 번')
  await installPrintSpy(page)
  await makeFinalQuestions(page)
  await page.getByRole('button', { name: PRINT_BUTTON }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
  const pdf = await page.pdf({ format: 'A4', path: join(REPO_ROOT, 'review', 'tmp', 'q02-final-print.pdf') })
  expect(pdfPageCount(pdf), '최종 ③ 인쇄 쪽수(review/tmp/q02-final-print.pdf)').toBe(1)
})

test('Q-02 1차 ③ "면접에 들고 갈 한 장 인쇄"도 A4 1쪽 유지(page.pdf)', async ({ page, isMobile }) => {
  test.skip(isMobile, '인쇄는 화면 폭과 상관없이 A4라 데스크톱에서 한 번')
  await installPrintSpy(page)
  await makeFirstQuestions(page, 'oo')
  await page.getByRole('button', { name: PRINT_BUTTON }).click()
  await expect.poll(() => printCalls(page)).toBeGreaterThanOrEqual(1)
  const pdf = await page.pdf({ format: 'A4', path: join(REPO_ROOT, 'review', 'tmp', 'q02-first-print.pdf') })
  expect(pdfPageCount(pdf), '1차 ③ 인쇄 쪽수(review/tmp/q02-first-print.pdf)').toBe(1)
})

// ── Q-03 README·최종 머리 ─────────────────────────────────────

test('Q-03 README 의 대체 경로 안내가 "&apiFail=1" 꼴이다("?apiFail=1" 없음)', async ({ isMobile }) => {
  test.skip(isMobile, '파일 검사는 데스크톱 프로젝트에서 한 번')
  const readme = readFileSync(repoPath('README.md'), 'utf8')
  expect(readme, 'README 에 "&apiFail=1" 안내').toContain('&apiFail=1')
  const wrong = readme.split(/\r?\n/).filter((l) => l.includes('?apiFail=1'))
  expect(wrong, 'S4 주소에는 이미 ?step= 이 있어 "?apiFail=1"로 붙이면 안 된다').toEqual([])
})

test('Q-03 최종 흐름 머리 요약에 "준비 중: 최종 면접"이 보인다(최종 ①②③), 1차 흐름에는 없다', async ({ page }) => {
  const head = () => page.getByText(FINAL_HEAD).filter({ visible: true }).first()
  const expectHead = async (step: string) => {
    await expect(head(), `${step}: "${FINAL_HEAD}"`).toBeVisible()
    expect(await precedes(head(), stepList(page)), `${step}: "${FINAL_HEAD}"는 머리 요약(단계 표시보다 위)에`).toBe(true)
  }

  await openPrep(page, 'oo')
  await expectCurrentStep(page, '공고 확인')
  await expect(page.getByText(FINAL_HEAD).filter({ visible: true }), `1차 흐름 ①에는 "${FINAL_HEAD}"가 없다`).toHaveCount(0)

  const base = await openPrep(page, 'commerce')
  if (!(await stepText(page)).includes('공고 확인')) await page.goto(stepUrl(base, 1))
  await expectCurrentStep(page, '공고 확인')
  await expectHead('최종 ①((주)△△커머스)')
  await goToReviewStep(page)
  await expectHead('최종 ②((주)△△커머스)')

  // 서류합격 건이 1차를 다녀와 최종으로 넘어간 경우(DA-04)
  await makeFinalQuestions(page)
  await expectHead('최종 ③((주)OO소프트)')
})

// ── Q-04 낮은 지적 4건 ────────────────────────────────────────

test('Q-04 (DA-05) 만드는 중 화면에 가짜 응답 모드 태그가 1번만', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  const loading = page.getByText(LOADING_TEXTS[2]).filter({ visible: true }).first()
  await expect(loading, `만드는 중 "${LOADING_TEXTS[2]}"`).toBeVisible()
  const tags = await page.getByText(/가짜 응답 모드/).filter({ visible: true }).count()
  const stillLoading = await loading.isVisible()
  expect(stillLoading, '만드는 중 화면에서 센 값이어야 한다').toBe(true)
  expect(tags, '만드는 중 화면의 "가짜 응답 모드" 태그 수').toBe(1)
})

test('Q-04 (DA-06) 채용정보 표 임금 칸이 단위·괄호 중간에서 줄이 바뀌지 않는다', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰 채용정보는 표가 아니라 카드라 데스크톱 표에서 본다')
  await page.goto('/jobs')
  await expect(heading(page, S3_TITLE)).toBeVisible()
  const table = page.getByRole('table').first()
  await expect(table).toBeVisible()
  const headers = (await table.getByRole('columnheader').allInnerTexts()).map(normalize)
  const col = headers.findIndex((h) => /임금|급여/.test(h))
  expect(col, `임금 열(열: ${headers.join(' | ')})`).toBeGreaterThanOrEqual(0)
  const rows = table.getByRole('row').filter({ has: page.getByRole('cell') })
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  const problems: string[] = []
  for (let i = 0; i < n; i++) {
    const lines = await rowCells(rows.nth(i))
      .nth(col)
      .evaluate((cell) => {
        const out: Array<{ top: number; text: string }> = []
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          for (let k = 0; k < node.length; k++) {
            const ch = node.data[k] ?? ''
            if (/\s/.test(ch)) {
              const last = out[out.length - 1]
              if (last) last.text += ' '
              continue
            }
            const range = document.createRange()
            range.setStart(node, k)
            range.setEnd(node, k + 1)
            const rect = range.getClientRects()[0]
            if (!rect) continue
            const last = out[out.length - 1]
            if (!last || Math.abs(rect.top - last.top) > 3) out.push({ top: rect.top, text: ch })
            else last.text += ch
          }
        }
        return out.map((l) => l.text.replace(/\s+/g, ' ').trim()).filter(Boolean)
      })
    let open = 0
    lines.forEach((line, k) => {
      if (k > 0 && /^(?:원|만\s?원)/.test(line)) problems.push(`${i + 1}행: 단위가 따로 줄바꿈 "${lines.join(' ⏎ ')}"`)
      if (k > 0 && open > 0) problems.push(`${i + 1}행: 괄호 안에서 줄바꿈 "${lines.join(' ⏎ ')}"`)
      open += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length
    })
  }
  expect([...new Set(problems)]).toEqual([])
})

test('Q-04 (DA-07) 휴대폰 S1 첫 화면에 1행 면접 준비 버튼이 보인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 폭 항목')
  await gotoApplications(page)
  await settleScroll(page)
  const button = applicationEntries(page).first().getByRole('button', { name: PREP_BUTTON })
  await expect(button).toBeVisible()
  const band = await visibleBand(page)
  const box = await rectOf(button)
  expect(insideBand(box, band), `1행 면접 준비 버튼(${Math.round(box.top)}~${Math.round(box.bottom)}px)이 첫 화면(${Math.round(band.top)}~${Math.round(band.bottom)}px) 안에`).toBe(true)
})

test('Q-04 (DA-08) 1차 ③의 채운(배경색 있는) 버튼은 1개(주 행동만)', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await settleScroll(page)
  const controls = page.getByRole('button').or(page.getByRole('link')).filter({ visible: true })
  // 머리(banner)·메뉴(navigation)·바닥글(contentinfo)은 고용24 틀이라 뺀다(화면 아래 고정 바는 바닥글이어도 센다)
  const frame = await page.getByRole('banner').or(page.getByRole('contentinfo')).or(page.getByRole('navigation')).elementHandles()
  const filled = await controls.evaluateAll(
    (els, [bannerText, roots]) => {
      const innermost = Array.from(document.body.querySelectorAll('*')).find(
        (el) => (el.textContent ?? '').includes(bannerText) && !Array.from(el.children).some((c) => (c.textContent ?? '').includes(bannerText)),
      )
      let band: Element | null = innermost ?? null
      while (band?.parentElement && !band.parentElement.querySelector('h1, main')) band = band.parentElement
      const frameRoots = roots.filter((r): r is Element => r instanceof Element && !['fixed', 'sticky'].includes(getComputedStyle(r).position))
      const parse = (c: string): number[] => (/rgba?\(([^)]+)\)/.exec(c)?.[1] ?? '0 0 0 0').split(/[\s,/]+/).filter(Boolean).map(Number)
      // 초점을 받을 때만 나타나는 "본문 바로가기" 같은 페이지 밖 요소는 뺀다
      const onPage = (el: Element): boolean => {
        const r = el.getBoundingClientRect()
        return r.width >= 2 && r.height >= 2 && r.bottom + window.scrollY > 0 && r.right + window.scrollX > 0
      }
      return els
        .filter((el) => onPage(el) && !frameRoots.some((r) => r.contains(el)) && !(band && band.contains(el)))
        .map((el) => {
          const [r = 0, g = 0, b = 0, a = 1] = parse(getComputedStyle(el).backgroundColor)
          const max = Math.max(r, g, b)
          const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max
          const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          return { name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(), filled: a >= 0.5 && (sat > 0.04 || lum < 0.8) }
        })
        .filter((x) => x.filled)
        .map((x) => x.name)
    },
    [BANNER_TEXTS[0], frame] as const,
  )
  expect(filled, `1차 ③의 채운 버튼(시연 띠·헤더·메뉴 제외): ${filled.join(' / ')}`).toHaveLength(1)
})
