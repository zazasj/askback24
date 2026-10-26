/**
 * 6차 추가분(2026-10-26 밤샘) — AS · RS · HP · LD · TR. ACCEPTANCE.md 「6차 추가분」만 보고 쓴 독립 시험(구현은 보지 않았다).
 * AS-03·AS-07은 단위 시험(개발자 몫)이라 여기 없다. 파일 검사(AS·RS-05 빌드 결과물)는 데스크톱 프로젝트에서 한 번만 돈다.
 * TR 시험만 시험 스위치(rq:test:tour-off, TR-09)를 뺀 새 context로 돈다. 나머지는 playwright.config.ts 의 스위치를 켠 채 돈다.
 * axe "위반이 없다"는 G-10과 같은 기준(critical·serious 0건)으로 본다.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  BANNER_TEXTS,
  COMPANY,
  MISSING_PATH,
  NOT_FOUND_TEXT,
  NOT_ASKED_REASONS,
  PREP_BUTTON,
  PREP_URL,
  S1_TITLE,
  S1_URL,
  S2_TITLE,
  S3_TITLE,
  S4_TITLE,
  STEP_RE,
  WHY_TEXT,
  acceptDialogs,
  applicationEntries,
  bodyText,
  cardGroup,
  cardGroups,
  currentStep,
  demoAction,
  demoItem,
  demoToolsButton,
  expectCurrentStep,
  fillPresetA,
  fillReviewR04,
  goToCardsStep,
  gotoApplications,
  heading,
  jobDetailPaths,
  makeFinalQuestions,
  makeFirstQuestions,
  makeQuestionsButton,
  normalize,
  openPrep,
  pickRadio,
  questionItems,
  questionSentence,
  questionSentences,
  seriousAxeViolations,
  showAllCards,
  stepList,
  tourDialog,
  waitFinalResults,
  waitFirstResults,
  waitPostingReady,
} from './helpers'
import { inBottomBar, insideBand, mainMenuItem, rectOf, scrollToBottom, scrollToTop, settleScroll, visibleBand } from './helpers2'
import {
  COPY_ALL,
  EXTRA_HEADING,
  FEW_PHRASE,
  FINAL_GROUPS,
  HELP_TEXT,
  KEEP_PHRASE,
  LOADING_STEPS,
  NO_TOUR_SWITCH,
  PRINT_ONE,
  SERVICE_TOUR_WORDS,
  TOUR_OFF_KEY,
  WENT_BUTTON,
  analysisQuotes,
  analyzeSpotlight,
  cardBox,
  cardExamples,
  cardNames,
  cardVisualBoxes,
  copyAllButton,
  copyAllText,
  demoMenuClick,
  demoMenuHas,
  distFilesContaining,
  docBox,
  expectNoPageOverflow,
  expectNoSideOverflow,
  expectNoTour,
  extraList,
  extraSentences,
  focusInside,
  focusedHeading,
  gapBetween,
  groupSentences,
  hasBottomBar,
  helpButton,
  helpDialog,
  installLdRecorder,
  intersects,
  itemControls,
  ldMarks,
  ldRecord,
  ldReset,
  loadingStatus,
  markLook,
  mdHead,
  mdSection,
  openHelpDialogs,
  pinnedBarControls,
  positionsInOrder,
  printButton,
  readRepoText,
  readTourStep,
  resultSide,
  sentenceToWhyGeometry,
  skipTour,
  truncatedTexts,
  viewport,
  waitTour,
  walkTour,
  type Rect,
  type SpotAnalysis,
  type TourStep,
} from './helpers3'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })
test.describe.configure({ timeout: 120_000 })

const FILE_ONCE = '파일 검사는 데스크톱 프로젝트에서 한 번'

// ═══ AS — AI API 명세와 연결(docs/API-SPEC.md · README) ═══════════════

const SPEC = 'docs/API-SPEC.md'
const CALLS = ['first-questions', 'final-judgements', 'final-questions'] as const
/** "POST /v1/…" — 앞에 {AI_ENDPOINT}가 붙거나 `…`로 감싸도 된다 */
const callRe = (name: string): RegExp => new RegExp(`POST\\s+\`?\\s*(?:\\{AI_ENDPOINT\\}|\\$\\{?AI_ENDPOINT\\}?)?/v1/${name}\\b`)

function readSpec(): string {
  const md = readRepoText(SPEC)
  expect(md, `${SPEC} 가 있어야 한다`).not.toBeNull()
  return md ?? ''
}

function sectionBody(md: string, title: RegExp, label: string): string {
  const s = mdSection(md, title)
  expect(s, `「${label}」 절(제목)이 있어야 한다`).toBeDefined()
  return s?.body ?? ''
}

function expectAll(text: string, checks: ReadonlyArray<readonly [RegExp, string]>, where: string): void {
  for (const [re, what] of checks) expect(text, `${where}: ${what}`).toMatch(re)
}

test('AS-01 docs/API-SPEC.md 맨 위: 할 일(호출 3가지)·시간 제한·가장 큰 위험(근거 인용), 읽는 사람은 AI 담당', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const head = mdHead(readSpec())
  for (const c of CALLS) expect(head, `맨 위 할 일에 "POST /v1/${c}"`).toMatch(callRe(c))
  expectAll(
    head,
    [
      [/\d+(?:\.\d+)?\s*초/, '시간 제한(…초)'],
      [/위험/, '가장 큰 위험'],
      [/인용/, '가장 큰 위험 = 근거 인용 규칙'],
      [/AI\s*(?:파이프라인\s*)?담당/, '읽는 사람 = AI 담당(우리 레포 코드를 모르는 사람)'],
    ],
    '맨 위',
  )
})

test('AS-02 화면 입력 → 요청 값 표(1차·최종)와 우리 서버가 AI 요청(posting·items)으로 바꾸는 방법', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const md = readSpec()
  const rows = md.split(/\r?\n/).filter((l) => /^\s*\|/.test(l))
  expect(rows.length, '표(| … |) 줄').toBeGreaterThan(0)
  const pairs: ReadonlyArray<readonly [RegExp, RegExp, string]> = [
    [/지원/, /\bwantedAuthNo\b/, '지원 건 → wantedAuthNo'],
    [/기대돼요/, /\bwant\b/, '"기대돼요" → want'],
    [/걱정돼요/, /\bavoid\b/, '"걱정돼요" → avoid'],
    [/모르겠어요/, /\bunsure\b/, '"모르겠어요" → unsure'],
    [/경험 한 줄/, /\bexperience\b/, '경험 한 줄 → experience'],
    [/경험/, /\bhas_exp\b/, '경험을 붙일 카드 → picks[].has_exp'],
    [/물어봤어요/, /\basked\b/, '"물어봤어요" → review.asked'],
    [/못 물어봤어요/, /\bnot_asked\b/, '"못 물어봤어요" → review.not_asked'],
    [/들은 답/, /\bheard\b/, '들은 답 → heard'],
    [/구체적이었어요|모호했어요/, /\bclarity\b/, '"구체적이었어요"·"모호했어요" → clarity'],
    [/못 물은 이유/, /\breason\b/, '못 물은 이유 → reason'],
    [/회사가 물어본 업무/, /\breceived\b/, '회사가 물어본 업무 → received'],
    [/면접 분위기/, /\bmood\b/, '면접 분위기 → impression.mood'],
  ]
  for (const [screen, field, what] of pairs) expect(rows.some((r) => screen.test(r) && field.test(r)), `표에 ${what}이 한 줄로`).toBe(true)
  expect(rows.some((r) => /\bexperience\b/.test(r) && /100/.test(r)), '경험 한 줄(100자)').toBe(true)
  expect(rows.some((r) => /\bheard\b/.test(r) && /100/.test(r)), '들은 답(100자)').toBe(true)
  expectAll(
    md,
    [
      [/\bpicks\b/, 'picks'],
      [/\bpref\b/, 'picks[].pref'],
      [/\breview\b/, 'review'],
      [/\bimpression\b/, 'impression'],
      [/\bposting\b/, 'AI 요청의 공고 원문 posting'],
      [/\bitems\b/, 'AI 요청의 질문 항목 items'],
    ],
    SPEC,
  )
  for (const r of NOT_ASKED_REASONS) expect(md, `못 물은 이유 "${r}"`).toContain(r)
})

test('AS-04 「응답 규칙」(JSON만·card_id·key·순서·개수·인용 글자 그대로·없는 업무·금지어·인용 금지·길이·문체·basis)과 「실패 처리」(그 문항만·전체 대체·단순 규칙·오류 형식·HTTP 상태)', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const md = readSpec()
  const rules = sectionBody(md, /응답 규칙/, '응답 규칙')
  expectAll(
    rules,
    [
      [/JSON\s*만|JSON\s*(?:하나|외|밖)|설명\s*글/, 'JSON만(설명 글 없음)'],
      [/\bcard_id\b/, 'card_id'],
      [/\bkey\b/, 'key'],
      [/그대로/, '항목의 card_id·key를 그대로 돌려줌'],
      [/순서/, '순서를 바꾸지 않음'],
      [/개수/, '개수를 바꾸지 않음'],
      [/evidence\.quote|\bquote\b/, '근거 인용(evidence.quote)'],
      [/글자 그대로/, '공고 원문 글자 그대로'],
      [/공고에 없는/, '공고에 없는 업무를 있다고 전제하지 않음'],
      [/금지어/, '금지어'],
      [/나이/, '금지어 나이'],
      [/결혼/, '금지어 결혼'],
      [/출신/, '금지어 출신'],
      [/아까/, '1차 면접관 인용 금지 "아까"'],
      [/하셨는데/, '1차 면접관 인용 금지 "하셨는데"'],
      [/말씀하신/, '1차 면접관 인용 금지 "말씀하신"'],
      [/길이|\d+\s*자/, '길이'],
      [/습니다/, '서술 문체 "…습니다"'],
      [/인가요/, '질문 문체 "…인가요?"'],
      [/\bbasis\b/, '판정 basis'],
      [/들은 답/, 'basis에 들은 답을 옮기지 않음'],
    ],
    '「응답 규칙」',
  )
  const fail = sectionBody(md, /실패 처리/, '실패 처리')
  expectAll(
    fail,
    [
      [/검수 문장/, '검수 문장으로 대신'],
      [/(?:문항|항목|질문)\s*만/, '문항 하나가 틀리면 그 문항만'],
      [/시간 초과/, '시간 초과면 모두 검수 문장'],
      [/단순 규칙/, '최종 판정은 단순 규칙'],
    ],
    '「실패 처리」',
  )
  expectAll(
    `${rules}\n${fail}`,
    [
      [/"error"/, '오류 응답 형식 { "error": … }'],
      [/"code"/, '오류 code'],
      [/"message"/, '오류 message'],
      [/HTTP|\b[45]xx\b|\b[45]\d\d\b/, 'HTTP 상태'],
    ],
    '「응답 규칙」·「실패 처리」',
  )
})

test('AS-05 「공통」: Authorization Bearer AI_API_KEY · AI_ENDPOINT · 시간 제한(9초에 끊음, 1차 8초·최종 판정+문장 9초) · 개인정보 · UTF-8 JSON · /v1', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const common = sectionBody(readSpec(), /공통/, '공통')
  expectAll(
    common,
    [
      [/Authorization:\s*`?\s*Bearer/, '인증 머리글 Authorization: Bearer'],
      [/AI_API_KEY/, 'AI_API_KEY'],
      [/AI_ENDPOINT/, '주소 환경변수 AI_ENDPOINT'],
      [/9\s*초/, '우리 서버는 9초에 끊음'],
      [/8\s*초/, '1차는 8초 안'],
      [/판정/, '최종 판정'],
      [/문장/, '최종 문장'],
      [/경험 한 줄/, '개인정보: 경험 한 줄'],
      [/들은 답/, '개인정보: 들은 답'],
      [/저장|기록/, 'AI 쪽에서도 저장·기록하지 않음'],
      [/UTF-8/i, 'UTF-8'],
      [/JSON/, 'JSON'],
      [/\/v1\b/, '버전 경로 /v1'],
    ],
    '「공통」',
  )
  const noHeard = common.split(/\r?\n/).some((l) => /들은 답/.test(l) && /보내지 않|넣지 않|빼고|빼서|포함하지 않|안 보내|보내지 말/.test(l))
  expect(noHeard, '「공통」: 최종 문장 호출에는 들은 답을 보내지 않는다는 줄').toBe(true)
})

test('AS-06 부록 A(화면 → POST /api/questions 요청·응답)와 부록 B(공고 분석 data/analysis/<wantedAuthNo>.json 형식·인용 규칙·확인 명령·화면은 읽기만)', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const md = readSpec()
  const a = sectionBody(md, /부록\s*A/, '부록 A')
  expectAll(
    a,
    [
      [/\/api\/questions/, '/api/questions'],
      [/POST/, 'POST'],
      [/요청/, '요청'],
      [/응답/, '응답'],
      [/\bmode\b/, 'mode(1차·최종)'],
    ],
    '부록 A',
  )
  const b = sectionBody(md, /부록\s*B/, '부록 B')
  expectAll(
    b,
    [
      [/data\/analysis\//, 'data/analysis/ 에 넣는다'],
      [/wantedAuthNo/, '파일 이름 <wantedAuthNo>.json'],
      [/\bquote\b/, '근거 인용 필드(quote)'],
      [/글자 그대로/, '인용 규칙(원문 글자 그대로)'],
      [/npm\s+(?:--prefix\s+\S+\s+)?run\s+[\w:-]+|npx\s+\S+/, '넣은 뒤 확인하는 시험 명령'],
      [/읽기만/, '화면은 이 파일을 읽기만 한다'],
    ],
    '부록 B',
  )
})

test('AS-08 README 「실제 AI 연결」: 환경변수 3개 · Vercel에 넣는 곳 · 가짜 응답 → 실제 모드 순서 · 명세 문서 링크', async ({ isMobile }) => {
  test.skip(isMobile, FILE_ONCE)
  const readme = readRepoText('README.md')
  expect(readme, 'README.md').not.toBeNull()
  const s = sectionBody(readme ?? '', /실제 AI 연결/, 'README 실제 AI 연결')
  expectAll(
    s,
    [
      [/LLM_PROVIDER/, 'LLM_PROVIDER'],
      [/AI_ENDPOINT/, 'AI_ENDPOINT'],
      [/AI_API_KEY/, 'AI_API_KEY'],
      [/Vercel/, 'Vercel에 넣는 곳'],
      [/\bremote\b/, '실제 모드(remote)'],
      [/\bmock\b|가짜 응답/, '가짜 응답 모드에서'],
      [/docs\/API-SPEC\.md/, '명세 문서 링크'],
    ],
    'README 「실제 AI 연결」',
  )
  expect((s.match(/^\s*\d+[.)]\s+/gm) ?? []).length, '바꾸는 순서(번호 목록 2단계 이상)').toBeGreaterThanOrEqual(2)
})

// ═══ RS — 결과 화면 버튼 정리(1차·최종 ③) ═════════════════════════

async function toFinalFromFirst(page: Page): Promise<void> {
  await page.getByRole('button', { name: WENT_BUTTON, exact: true }).click()
  await expectCurrentStep(page, '1차 면접 정리')
  await fillReviewR04(page)
  await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
  await waitFinalResults(page)
}

/** 질문마다 "복사"·"면접에서 쓸 것 같아요"가 없고, 펼친 뒤 남는 컨트롤은 "왜 이 질문인가요"·"근거 보기"뿐 */
async function expectOnlyWhyControls(page: Page, label: string, count: number | null): Promise<void> {
  const items = questionItems(page)
  if (count !== null) await expect(items, `${label} 질문 수`).toHaveCount(count)
  const n = await items.count()
  expect(n, `${label} 질문`).toBeGreaterThan(0)
  let links = 0
  for (let i = 0; i < n; i++) {
    const item = items.nth(i)
    const where = `${label} ${i + 1}번`
    await expect(item.getByRole('button', { name: '복사', exact: true }), `${where}: "복사" 없음`).toHaveCount(0)
    await expect(item.getByRole('button', { name: KEEP_PHRASE }), `${where}: "${KEEP_PHRASE}" 없음`).toHaveCount(0)
    await item.getByText(WHY_TEXT).first().click()
    await expect(item.getByText('주의할 답', { exact: true }).first(), `${where}: 펼침이 열린다`).toBeVisible()
    const names = await itemControls(item)
    const others = names.filter((nm) => !nm.includes(WHY_TEXT) && nm !== '근거 보기')
    expect(others, `${where}: 남는 컨트롤은 "${WHY_TEXT}"·"근거 보기"뿐(보이는 컨트롤: ${names.join(' / ')})`).toEqual([])
    links += await item.getByRole('link', { name: '근거 보기' }).count()
  }
  expect(links, `${label}: 펼침 안 "근거 보기" 링크`).toBeGreaterThan(0)
}

async function expectNoKeepOrCopyButtons(page: Page, label: string): Promise<void> {
  await expect(page.getByRole('button', { name: '복사', exact: true }), `${label}: 화면에 "복사" 버튼 없음`).toHaveCount(0)
  await expect(page.getByRole('button', { name: /질문 복사$/ }), `${label}: "<카드 이름> 질문 복사" 없음`).toHaveCount(0)
  await expect(page.getByRole('button', { name: KEEP_PHRASE }), `${label}: "${KEEP_PHRASE}" 없음`).toHaveCount(0)
}

test('RS-01 1차·최종 ③ 질문마다 "복사"·"면접에서 쓸 것 같아요"가 없고 남는 것은 "왜 이 질문인가요"와 그 안 "근거 보기" · "더 알아볼 질문"에도 복사 없음', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await expectOnlyWhyControls(page, '1차', 5)
  const extra = extraList(page)
  await expect(extra, '"더 알아볼 질문 목록"(예시 A × OO소프트, U-03)').toBeVisible()
  await expect(extra.getByRole('button', { name: /복사/ }), '"더 알아볼 질문"에 복사 버튼 없음').toHaveCount(0)
  await expectNoKeepOrCopyButtons(page, '1차 ③')

  await toFinalFromFirst(page)
  await expectOnlyWhyControls(page, '최종', null)
  await expectNoKeepOrCopyButtons(page, '최종 ③')
})

/** "전체 복사"·인쇄가 화면 전체에서 각 하나이고 오른쪽 상자(complementary) 안, 아래 바 밖 */
async function expectToolsInSide(page: Page, label: string): Promise<void> {
  for (const [name, b] of [
    [COPY_ALL, copyAllButton(page)],
    [PRINT_ONE, printButton(page)],
  ] as const) {
    await expect(b, `${label}: "${name}"는 화면 전체에서 하나`).toHaveCount(1)
    expect(await inBottomBar(b), `${label}: "${name}"는 아래 고정 바 밖`).toBe(false)
  }
  const side = resultSide(page)
  await expect(side, `${label}: "전체 복사"를 품은 오른쪽 상자(complementary)`).toHaveCount(1)
  await expect(side.getByRole('button', { name: PRINT_ONE, exact: true }), `${label}: "${PRINT_ONE}"도 같은 상자 안`).toHaveCount(1)
}

async function expectNoBottomBarWhileScrolling(page: Page, label: string): Promise<void> {
  await settleScroll(page)
  await scrollToTop(page)
  expect(await hasBottomBar(page), `${label} 맨 위: 아래 고정 바 없음`).toBe(false)
  await page.evaluate(() => window.scrollTo({ top: Math.max(0, document.documentElement.scrollHeight / 2 - window.innerHeight / 2), behavior: 'instant' }))
  await settleScroll(page)
  expect(await hasBottomBar(page), `${label} 가운데: 아래 고정 바 없음`).toBe(false)
  await scrollToBottom(page)
  expect(await hasBottomBar(page), `${label} 맨 아래: 아래 고정 바 없음`).toBe(false)
  await scrollToTop(page)
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 1366, height: 657 },
] as const) {
  test(`RS-02 ${size.width}×${size.height}: "전체 복사"·"면접에 들고 갈 한 장 인쇄"는 오른쪽 상자 안(각 하나), 1차 아래 바는 "면접 다녀왔어요" 하나, 최종 ③은 아래 바 없음`, async ({ page, isMobile }) => {
    test.skip(isMobile, '데스크톱 폭 기준(휴대폰은 RS-03)')
    await page.setViewportSize(size)
    await makeFirstQuestions(page, 'oo')
    await settleScroll(page)
    await scrollToTop(page)
    await expectToolsInSide(page, '1차 ③')
    const side = await docBox(resultSide(page))
    const q1 = await docBox(questionItems(page).first())
    expect(side.left, `1차 ③: 상자(왼끝 ${Math.round(side.left)})가 질문(1번 오른끝 ${Math.round(q1.right)}) 오른쪽`).toBeGreaterThanOrEqual(q1.right - 1)
    const went = page.getByRole('button', { name: WENT_BUTTON, exact: true })
    await expect(went, `"${WENT_BUTTON}" 하나`).toHaveCount(1)
    expect(await inBottomBar(went), `1차 "${WENT_BUTTON}"는 아래 고정 바 안`).toBe(true)
    expect(await pinnedBarControls(went), '1차 아래 고정 바의 버튼').toEqual([WENT_BUTTON])

    await toFinalFromFirst(page)
    await settleScroll(page)
    await scrollToTop(page)
    await expectToolsInSide(page, '최종 ③')
    const fside = await docBox(resultSide(page))
    const f1 = await docBox(questionItems(page).first())
    expect(fside.left, `최종 ③: 상자가 질문 오른쪽`).toBeGreaterThanOrEqual(f1.right - 1)
    await expectNoBottomBarWhileScrolling(page, '최종 ③')
  })
}

/** 쌓이는 폭·휴대폰: 두 버튼 아래끝 ≤ 1번 질문 위끝, 가로 넘침 없음 */
async function expectToolsAboveQuestions(page: Page, label: string): Promise<void> {
  const q1 = await docBox(questionItems(page).first())
  for (const [name, b] of [
    [COPY_ALL, copyAllButton(page)],
    [PRINT_ONE, printButton(page)],
  ] as const) {
    await expect(b, `${label}: "${name}" 하나`).toHaveCount(1)
    const r = await docBox(b)
    expect(r.bottom, `${label}: "${name}" 아래끝 ${Math.round(r.bottom)} ≤ 1번 질문 위끝 ${Math.round(q1.top)}`).toBeLessThanOrEqual(q1.top + 1)
    await expectNoSideOverflow(b, `${label} "${name}"`)
  }
  await expectNoSideOverflow(resultSide(page), `${label} 복사·인쇄 상자`)
  await expectNoPageOverflow(page, label)
}

for (const size of [
  { width: 1100, height: 900 },
  { width: 820, height: 1000 },
] as const) {
  test(`RS-03 쌓이는 폭 ${size.width}×${size.height}: "전체 복사"·인쇄가 1번 질문보다 위(1차·최종), 가로 넘침 없음`, async ({ page, isMobile }) => {
    test.skip(isMobile, '데스크톱 프로젝트에서 폭을 바꿔 잰다')
    await page.setViewportSize(size)
    await makeFirstQuestions(page, 'oo')
    await expectToolsAboveQuestions(page, `1차 ③ ${size.width}`)
    await toFinalFromFirst(page)
    await expectToolsAboveQuestions(page, `최종 ③ ${size.width}`)
  })
}

test('RS-03 휴대폰 375×812: "전체 복사"·인쇄가 1번 질문보다 위(1차·최종), 가로 넘침 없음', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 기준')
  await makeFirstQuestions(page, 'oo')
  await expectToolsAboveQuestions(page, '1차 ③ 휴대폰')
  await toFinalFromFirst(page)
  await expectToolsAboveQuestions(page, '최종 ③ 휴대폰')
})

/** 인쇄 화면에서 보이는 목록 항목을 위에서부터 이은 글 */
async function printedListText(page: Page): Promise<string> {
  const items = page.getByRole('listitem').filter({ visible: true })
  const n = await items.count()
  const rows: Array<{ top: number; text: string }> = []
  for (let i = 0; i < n; i++) rows.push({ top: (await rectOf(items.nth(i))).top, text: normalize(await items.nth(i).innerText()) })
  return rows
    .sort((a, b) => a.top - b.top)
    .map((r) => r.text)
    .join(' ')
}

test('RS-04 1차 전체 복사 = 화면 순서 질문 5개 → 소제목 "더 알아볼 질문" → 그 문장들 · 인쇄 한 장은 화면 순서이고 더 알아볼 질문이 없다', async ({ page, isMobile }) => {
  test.skip(isMobile, '복사 글·인쇄는 폭과 상관없어 데스크톱에서 한 번')
  await makeFirstQuestions(page, 'oo')
  const five = await questionSentences(page)
  expect(five).toHaveLength(5)
  const extras = await extraSentences(page)
  expect(extras.length, '더 알아볼 질문(U-03)').toBeGreaterThan(0)
  const raw = await copyAllText(page)
  const all = normalize(raw)
  const pos = positionsInOrder(all, five)
  expect(pos, `복사 글에 질문 5개가 화면 순서로(위치 ${pos.join(', ')})`).not.toContain(-1)
  const endFive = (pos[4] ?? 0) + (five[4]?.length ?? 0)
  const head = all.indexOf(EXTRA_HEADING, endFive)
  expect(head, '질문 5개 뒤에 소제목 "더 알아볼 질문"').toBeGreaterThan(-1)
  const headLine = raw.split(/\r?\n/).some((l) => normalize(l.replace(/[#*[\]【】<>:：=·\-]/g, ' ')) === EXTRA_HEADING)
  expect(headLine, '"더 알아볼 질문"은 한 줄짜리 소제목').toBe(true)
  const extraPos = positionsInOrder(all, extras, head)
  expect(extraPos, `소제목 뒤에 더 알아볼 질문 문장들이 화면 순서로(${extras.join(' / ')})`).not.toContain(-1)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: EXTRA_HEADING }), '인쇄에 "더 알아볼 질문" 소제목 없음').toHaveCount(0)
  const printed = await printedListText(page)
  for (const s of extras) expect(printed, `인쇄에 더 알아볼 질문 "${s}" 없음`).not.toContain(s)
  expect(normalize(await bodyText(page)), '인쇄 화면 글에 더 알아볼 질문 없음').not.toContain(extras[0] ?? '\u0000')
  expect(positionsInOrder(printed, five), '인쇄 순서 = 화면 순서').not.toContain(-1)
  await page.emulateMedia({ media: null })
})

test('RS-04 "모르겠어요"를 고르지 않아 더 알아볼 질문이 없으면 1차 전체 복사에 소제목 "더 알아볼 질문"도 없다', async ({ page, isMobile }) => {
  test.skip(isMobile, '복사 글은 폭과 상관없어 데스크톱에서 한 번')
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await pickRadio(cardGroup(page, '신규 API 개발'), '기대돼요')
  await pickRadio(cardGroup(page, '기존 시스템 유지보수'), '걱정돼요')
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expect(heading(page, EXTRA_HEADING)).toHaveCount(0)
  const text = await copyAllText(page)
  expect(text, '더 알아볼 질문이 없으면 소제목도 없다').not.toContain(EXTRA_HEADING)
  for (const [i, s] of (await questionSentences(page)).entries()) expect(normalize(text), `${i + 1}번 질문`).toContain(s)
})

test('RS-04 최종 전체 복사: 소제목 두 개 아래로 나뉘고 묶음마다 화면 순서 · 인쇄 순서도 화면 순서', async ({ page, isMobile }) => {
  test.skip(isMobile, '복사 글·인쇄는 폭과 상관없어 데스크톱에서 한 번')
  await makeFinalQuestions(page)
  const g1 = await groupSentences(page, FINAL_GROUPS[0])
  const g2 = await groupSentences(page, FINAL_GROUPS[1])
  expect(g1.length, `"${FINAL_GROUPS[0]}" 질문`).toBeGreaterThan(0)
  expect(g2.length, `"${FINAL_GROUPS[1]}" 질문`).toBeGreaterThan(0)
  const all = normalize(await copyAllText(page))
  const h1 = all.indexOf(FINAL_GROUPS[0])
  const h2 = all.indexOf(FINAL_GROUPS[1], Math.max(0, h1))
  expect(h1, `복사 글에 소제목 "${FINAL_GROUPS[0]}"`).toBeGreaterThan(-1)
  expect(h2, `복사 글에 소제목 "${FINAL_GROUPS[1]}"(첫 소제목 뒤)`).toBeGreaterThan(h1)
  const p1 = positionsInOrder(all, g1, h1)
  expect(p1, '첫 묶음 문장이 화면 순서로').not.toContain(-1)
  for (const [i, p] of p1.entries()) expect(p, `첫 묶음 ${i + 1}번이 둘째 소제목 앞`).toBeLessThan(h2)
  expect(positionsInOrder(all, g2, h2), '둘째 묶음 문장이 둘째 소제목 뒤에 화면 순서로').not.toContain(-1)

  await page.emulateMedia({ media: 'print' })
  expect(positionsInOrder(await printedListText(page), [...g1, ...g2]), '인쇄 순서 = 화면 순서').not.toContain(-1)
  await page.emulateMedia({ media: null })
})

test('RS-05 ③ 오른쪽 상자 안내에 "면접에서는 보통 한두 개만 물을 수 있어요"는 남고 "면접에서 쓸 것 같아요"는 없다 — 1차·최종·/about-ai·빌드 결과물 어디에도 없음', async ({ page, isMobile }) => {
  await makeFirstQuestions(page, 'oo')
  await expect(resultSide(page), '1차 ③ 오른쪽 상자 안내').toContainText(FEW_PHRASE)
  expect(await bodyText(page), `1차 ③ 화면에 "${KEEP_PHRASE}" 없음`).not.toContain(KEEP_PHRASE)
  await toFinalFromFirst(page)
  await expect(resultSide(page), '최종 ③ 오른쪽 상자 안내').toContainText(FEW_PHRASE)
  expect(await bodyText(page), `최종 ③ 화면에 "${KEEP_PHRASE}" 없음`).not.toContain(KEEP_PHRASE)
  await page.goto('/about-ai')
  await expect(heading(page, '이 질문은 어떻게 만들어지나요')).toBeVisible()
  expect(await page.evaluate(() => document.body.textContent ?? ''), `/about-ai 에 "${KEEP_PHRASE}" 없음`).not.toContain(KEEP_PHRASE)
  if (isMobile) return
  const dist = distFilesContaining(KEEP_PHRASE)
  expect(dist.files, 'dist/ 글 파일(webServer가 만든 가짜 응답 모드 빌드)').toBeGreaterThan(0)
  expect(dist.hits, `빌드 결과물(모든 화면 글) 어디에도 "${KEEP_PHRASE}" 없음`).toEqual([])
})

test('RS-06 버튼 줄이 빠진 질문 카드에 빈 여백이 없다(문장 바로 아래 "왜 이 질문인가요") · 1440×900 ③ 첫 화면에 1번 질문 전체와 2번 머리', async ({ page, isMobile }) => {
  await makeFirstQuestions(page, 'oo')
  const items = questionItems(page)
  await expect(items).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    const item = items.nth(i)
    const sentence = await questionSentence(item)
    const geo = await sentenceToWhyGeometry(item, sentence)
    expect(geo, `${i + 1}번: 문장과 "${WHY_TEXT}"를 찾아야 한다`).not.toBeNull()
    if (!geo) continue
    expect(geo.between, `${i + 1}번: 문장과 "${WHY_TEXT}" 사이에 다른 글이 없다`).toEqual([])
    expect(geo.gap, `${i + 1}번: 문장 아래 "${WHY_TEXT}"까지 ${Math.round(geo.gap)}px(빈 여백 없음)`).toBeLessThanOrEqual(28)
    expect(geo.gap).toBeGreaterThanOrEqual(-1)
    expect(geo.tail, `${i + 1}번: "${WHY_TEXT}" 아래 카드 끝까지 ${Math.round(geo.tail)}px(빈 버튼 줄 자리 없음)`).toBeLessThanOrEqual(40)
  }
  if (isMobile) return
  await settleScroll(page)
  await scrollToTop(page)
  const band = await visibleBand(page)
  const s1 = await questionSentence(items.first())
  const holder = await items.first().evaluate((root, s) => {
    const norm = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim()
    const el = [root, ...Array.from(root.querySelectorAll('*'))]
      .filter((e) => norm(e.textContent).includes(s))
      .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0]
    const r = el?.getBoundingClientRect()
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null
  }, s1)
  expect(holder, '1번 질문 문장').not.toBeNull()
  expect(insideBand(holder ?? { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }, band), '1440×900 ③ 첫 화면에 1번 질문 문장 전체').toBe(true)
  const chip = items.nth(1).getByText(/^(?:차이 확인|기회 확인|깊이 확인|미리 확인|탐색)$/).filter({ visible: true }).first()
  expect(insideBand(await rectOf(chip), band), '1440×900 ③ 첫 화면에 2번 질문 머리(유형 칩)').toBe(true)
})

// ═══ HP — 카드 높이와 도움말(②) ═══════════════════════════════════

async function toCards(page: Page, all = true): Promise<string[]> {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  if (all) {
    await showAllCards(page)
    await expect(cardGroups(page)).toHaveCount(17)
  }
  return cardNames(page)
}

test('HP-01 ② 카드마다 고른 것과 관계없이(고르기 전·기대돼요·걱정돼요·모르겠어요) "<카드 이름> 도움말"(보이는 글 "도움말")이 보이고, 카드 안 펼침("예를 들면")은 없다', async ({ page }) => {
  const names = await toCards(page)
  expect(names, '카드 이름 17개').toHaveLength(17)
  const expectHelpEverywhere = async (state: string): Promise<void> => {
    for (const name of names) {
      const b = helpButton(page, name)
      await expect(b, `${state}: "${name} ${HELP_TEXT}" 버튼`).toBeVisible()
      expect(normalize(await b.innerText()), `${state}: "${name}" 버튼의 보이는 글`).toContain(HELP_TEXT)
    }
  }
  await expectHelpEverywhere('고르기 전')
  await expect(page.getByRole('button', { name: /예를 들면/ }), '"예를 들면" 펼침 버튼 없음').toHaveCount(0)
  await expect(page.getByText('예를 들면', { exact: true }).filter({ visible: true }), '팝업을 열기 전에는 "예를 들면"이 안 보인다').toHaveCount(0)
  for (const name of names) {
    const inner = await cardBox(page, name).evaluate(
      (box, help) =>
        Array.from(box.querySelectorAll('details, [aria-expanded]'))
          .filter((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim() !== help)
          .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 20)}"`),
      `${name} ${HELP_TEXT}`,
    )
    expect(inner, `${name}: 카드 안에서 펼쳐지는 영역 없음`).toEqual([])
  }
  await fillPresetA(page)
  await expectHelpEverywhere('예시 A로 채운 뒤(기대돼요·걱정돼요·모르겠어요)')
})

/** 데스크톱: 버튼 가까이·버튼을 가리지 않고·팝업 전체가 화면 안 / 휴대폰: 폭 전체, 아래끝 = 화면 아래끝 */
async function expectHelpPlacement(page: Page, dialog: Locator, button: Locator, isMobile: boolean, label: string): Promise<void> {
  const v = await viewport(page)
  const r = await rectOf(dialog)
  const at = `팝업 ${Math.round(r.left)},${Math.round(r.top)}~${Math.round(r.right)},${Math.round(r.bottom)} · 화면 ${v.vw}×${v.vh}`
  if (isMobile) {
    expect(r.left, `${label}: 아래 시트 폭 전체(왼끝) ${at}`).toBeLessThanOrEqual(1)
    expect(r.right, `${label}: 아래 시트 폭 전체(오른끝) ${at}`).toBeGreaterThanOrEqual(v.vw - 1)
    expect(Math.abs(r.bottom - v.vh), `${label}: 아래 시트 아래끝 = 화면 아래끝 ${at}`).toBeLessThanOrEqual(1.5)
    return
  }
  const b = await rectOf(button)
  expect(r.left >= -1 && r.top >= -1 && r.right <= v.vw + 1 && r.bottom <= v.vh + 1, `${label}: 팝업 전체가 화면 안 ${at}`).toBe(true)
  expect(intersects(r, b), `${label}: 팝업이 "도움말" 버튼을 가리지 않는다 ${at}`).toBe(false)
  expect(gapBetween(r, b), `${label}: 팝업이 버튼 가까이 ${at}`).toBeLessThanOrEqual(40)
}

test('HP-02 "도움말" → 팝업(role=dialog "<카드 이름> 도움말"): "예를 들면"·그 카드 예시 2개(cards.backend.json)·용어 풀이 1~3개 · 데스크톱은 버튼 가까이 화면 안, 휴대폰은 아래 시트', async ({ page, isMobile }) => {
  await toCards(page)
  for (const name of ['신규 API 개발', '고객사 상주 개발', '혼자 맡는 백엔드']) {
    const btn = helpButton(page, name)
    await btn.scrollIntoViewIfNeeded()
    await btn.click()
    const d = helpDialog(page, name)
    await expect(d, `"${name} ${HELP_TEXT}" 팝업`).toBeVisible()
    await expect(d.getByText('예를 들면', { exact: true }).first(), `${name}: 소제목 "예를 들면"`).toBeVisible()
    const examples = cardExamples(name)
    expect(examples, `${name}: cards.backend.json examples 2개`).toHaveLength(2)
    for (const ex of examples) await expect(d.getByText(ex).first(), `${name}: 예시 "${ex}"`).toBeVisible()
    const terms = d.getByRole('list', { name: '용어 풀이' }).or(d.getByLabel('용어 풀이')).first()
    await expect(terms, `${name}: 용어 풀이 목록(aria-label "용어 풀이")`).toBeVisible()
    const k = await terms.getByRole('listitem').count()
    expect(k, `${name}: 용어 풀이 1~3개`).toBeGreaterThanOrEqual(1)
    expect(k, `${name}: 용어 풀이 1~3개`).toBeLessThanOrEqual(3)
    if (name === '신규 API 개발') {
      await expect(terms).toContainText('API')
      await expect(terms).toContainText('약속된 창구')
    }
    await expectHelpPlacement(page, d, btn, isMobile, name)
    await d.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(d).toBeHidden()
  }
})

test('HP-02 데스크톱: 버튼이 화면 아래끝·위끝 가까이 있어도 팝업은 들어가는 쪽으로 떠서 전체가 화면 안이고 버튼을 가리지 않는다', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰은 아래 시트')
  const names = await toCards(page)
  const name = names[Math.floor(names.length / 2)] ?? names[0] ?? ''
  const btn = helpButton(page, name)
  for (const edge of ['아래', '위'] as const) {
    await btn.scrollIntoViewIfNeeded()
    const band = await visibleBand(page)
    const b0 = await rectOf(btn)
    const target = edge === '아래' ? band.bottom - b0.height - 8 : band.top + 8
    await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), b0.top - target)
    await settleScroll(page)
    const b1 = await rectOf(btn)
    test.info().annotations.push({ type: `HP-02 ${edge}끝`, description: `버튼 ${Math.round(b1.top)}~${Math.round(b1.bottom)}px(보이는 범위 ${Math.round(band.top)}~${Math.round(band.bottom)})` })
    await btn.click()
    const d = helpDialog(page, name)
    await expect(d).toBeVisible()
    await expectHelpPlacement(page, d, btn, false, `${name}(버튼이 화면 ${edge}끝 가까이)`)
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
  }
})

test('HP-03 팝업이 열리면 초점이 안으로 · "닫기"·Esc·바깥 누르기로 닫히고 초점은 그 "도움말" 버튼으로 · 한 번에 하나', async ({ page, isMobile }) => {
  const names = await toCards(page, false)
  const a = names[0] ?? ''
  const btnA = helpButton(page, a)
  const dA = helpDialog(page, a)
  const open = async (how: string): Promise<void> => {
    await btnA.click()
    await expect(dA, `${how}: 열림`).toBeVisible()
    await expect.poll(() => focusInside(dA), { message: `${how}: 열리면 초점이 팝업 안` }).toBe(true)
  }
  const closedBack = async (how: string): Promise<void> => {
    await expect(dA, `${how}: 닫힘`).toBeHidden()
    await expect(btnA, `${how}: 초점이 "${a} ${HELP_TEXT}" 버튼으로`).toBeFocused()
  }
  await open('닫기')
  await dA.getByRole('button', { name: '닫기', exact: true }).click()
  await closedBack('닫기')
  await open('Esc')
  await page.keyboard.press('Escape')
  await closedBack('Esc')
  await open('바깥 누르기')
  const r = await rectOf(dA)
  const v = await viewport(page)
  await page.mouse.click(2, isMobile ? Math.max(10, Math.round(r.top / 2)) : Math.round(v.vh / 2))
  await closedBack('바깥 누르기')

  // 한 번에 하나: A가 열린 채 다른 카드 "도움말" 자리를 누른다
  await open('한 번에 하나')
  const ra = await rectOf(dA)
  let other: string | null = null
  for (const n of names.slice(1)) {
    const rb = await rectOf(helpButton(page, n))
    if (rb.width > 0 && rb.top >= 0 && rb.bottom <= v.vh && !intersects(rb, ra)) {
      other = n
      break
    }
  }
  expect(await openHelpDialogs(page).count(), 'A만 열림').toBe(1)
  if (!other) {
    test.info().annotations.push({ type: 'HP-03', description: '화면 안에 팝업에 가리지 않은 다른 "도움말" 버튼이 없어 두 번째 열기는 건너뜀' })
    return
  }
  const rb = await rectOf(helpButton(page, other))
  await page.mouse.click(rb.left + rb.width / 2, rb.top + rb.height / 2)
  await page.waitForTimeout(300)
  expect(await openHelpDialogs(page).count(), '팝업은 한 번에 하나').toBeLessThanOrEqual(1)
  if ((await openHelpDialogs(page).count()) === 0) await helpButton(page, other).click()
  await expect(helpDialog(page, other), `"${other} ${HELP_TEXT}" 팝업`).toBeVisible()
  await expect(dA, '앞 팝업은 닫혔다').toBeHidden()
  expect(await openHelpDialogs(page).count(), '팝업은 한 번에 하나').toBe(1)
})

function expectSameHeights(before: number[], after: number[], label: string): void {
  expect(after.length, `${label}: 카드 수`).toBe(before.length)
  after.forEach((h, i) => expect(Math.abs(h - (before[i] ?? 0)), `${label}: 카드 ${i + 1} 높이 ${before[i]} → ${h}`).toBeLessThanOrEqual(1))
}

test('HP-04 "모르겠어요"를 골라도 팝업이 저절로 열리지 않고, 고르기·팝업 열고 닫기로 어떤 카드의 높이도 바뀌지 않는다', async ({ page }) => {
  const names = await toCards(page)
  const heights = async (): Promise<number[]> => (await cardVisualBoxes(page)).map((b) => Math.round(b.height * 10) / 10)
  const h0 = await heights()
  await pickRadio(cardGroup(page, names[0] ?? ''), '모르겠어요')
  await page.waitForTimeout(800)
  await expect(openHelpDialogs(page), '"모르겠어요"를 골라도 팝업이 저절로 열리지 않는다').toHaveCount(0)
  await pickRadio(cardGroup(page, names[1] ?? ''), '기대돼요')
  await pickRadio(cardGroup(page, names[2] ?? ''), '걱정돼요')
  await pickRadio(cardGroup(page, names[3] ?? ''), '모르겠어요')
  await page.waitForTimeout(400)
  await expect(openHelpDialogs(page), '고르기만으로 팝업이 열리지 않는다').toHaveCount(0)
  expectSameHeights(h0, await heights(), '고른 뒤')
  const name = names[2] ?? ''
  await helpButton(page, name).click()
  await expect(helpDialog(page, name)).toBeVisible()
  expectSameHeights(h0, await heights(), '팝업이 열린 동안')
  await page.keyboard.press('Escape')
  await expect(helpDialog(page, name)).toBeHidden()
  expectSameHeights(h0, await heights(), '팝업을 닫은 뒤')
})

function expectEqualHeights(boxes: Array<{ height: number }>, label: string): void {
  const hs = boxes.map((b) => b.height)
  const min = Math.min(...hs)
  const max = Math.max(...hs)
  expect(max - min, `${label}: 카드 높이가 모두 같다(±1px, ${hs.map((h) => Math.round(h)).join(', ')})`).toBeLessThanOrEqual(1)
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const) {
  test(`HP-05 ${size.width}×${size.height}(한 줄에 둘 이상): 보이는 카드 높이가 모두 같다 — 12개, "5개 더 보기" 뒤 17개`, async ({ page, isMobile }) => {
    test.skip(isMobile, '768px 이상 폭(데스크톱 프로젝트)')
    await page.setViewportSize(size)
    await toCards(page, false)
    const b12 = await cardVisualBoxes(page)
    expect(b12).toHaveLength(12)
    const firstTop = b12[0]?.top ?? 0
    expect(b12.filter((b) => Math.abs(b.top - firstTop) <= 1).length, `${size.width}px: 첫 줄에 카드 둘 이상`).toBeGreaterThanOrEqual(2)
    expectEqualHeights(b12, `${size.width}px 12개`)
    await showAllCards(page)
    await expect(cardGroups(page)).toHaveCount(17)
    expectEqualHeights(await cardVisualBoxes(page), `${size.width}px 17개`)
  })
}

test('HP-05 휴대폰: 한 줄에 카드 하나, 카드는 제 내용 높이(아래 빈 자리 없음)', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 기준')
  await toCards(page)
  const boxes = await cardVisualBoxes(page)
  expect(boxes).toHaveLength(17)
  const left = boxes[0]?.left ?? 0
  for (const [i, b] of boxes.entries()) {
    expect(Math.abs(b.left - left), `카드 ${i + 1}: 한 줄에 하나(왼끝 같음)`).toBeLessThanOrEqual(2)
    expect(b.bottom - b.contentBottom, `카드 ${i + 1}: 내용 아래 빈 자리 ${Math.round(b.bottom - b.contentBottom)}px(제 내용 높이)`).toBeLessThanOrEqual(40)
  }
})

test('HP-06 카드 설명 글을 말줄임으로 줄였다면 그 카드 도움말 팝업 맨 위("예를 들면" 앞)에 설명 전체가 있다', async ({ page }) => {
  const names = await toCards(page)
  let cut = 0
  for (const name of names) {
    const texts = (await truncatedTexts(cardBox(page, name), name)).filter((t) => !/^NCS\b/.test(t))
    if (texts.length === 0) continue
    cut += 1
    await helpButton(page, name).scrollIntoViewIfNeeded()
    await helpButton(page, name).click()
    const d = helpDialog(page, name)
    await expect(d).toBeVisible()
    const t = normalize(await d.innerText())
    const ex = t.indexOf('예를 들면')
    for (const full of texts) {
      const at = t.indexOf(full)
      expect(at, `${name}: 잘린 설명 전체 "${full.slice(0, 30)}…"가 팝업에`).toBeGreaterThanOrEqual(0)
      expect(at, `${name}: 설명 전체가 팝업 맨 위("예를 들면" 앞)`).toBeLessThan(ex < 0 ? Infinity : ex)
    }
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
  }
  test.info().annotations.push({ type: 'HP-06', description: `말줄임으로 잘린 카드 ${cut}개` })
})

test('HP-07 키보드만으로 열고 닫는다(Tab → Enter/Space → Esc) · 팝업이 열린 상태에서 axe 위반 없음', async ({ page }) => {
  const names = await toCards(page, false)
  const name = names[0] ?? ''
  const btn = helpButton(page, name)
  const d = helpDialog(page, name)
  const radio = cardGroup(page, name).getByRole('radio', { name: '기대돼요' })
  let reached = false
  for (const key of ['Tab', 'Shift+Tab'] as const) {
    await radio.focus()
    for (let i = 0; i < 8 && !reached; i++) {
      await page.keyboard.press(key)
      reached = await btn.evaluate((el) => el === document.activeElement)
    }
    if (reached) break
  }
  expect(reached, `Tab으로 "${name} ${HELP_TEXT}"에 초점이 간다`).toBe(true)
  await page.keyboard.press('Enter')
  await expect(d, 'Enter로 열림').toBeVisible()
  await expect.poll(() => focusInside(d), { message: '열리면 초점이 팝업 안' }).toBe(true)
  expect(await seriousAxeViolations(page), '팝업이 열린 상태 axe').toEqual([])
  await page.keyboard.press('Escape')
  await expect(d, 'Esc로 닫힘').toBeHidden()
  await expect(btn).toBeFocused()
  await page.keyboard.press('Space')
  await expect(d, 'Space로 열림').toBeVisible()
  await page.keyboard.press('Escape')
  await expect(d).toBeHidden()
  await expect(btn).toBeFocused()
})

// ═══ LD — 공고 분석 로딩과 형광펜(①) ══════════════════════════════

/** S1 1행((주)OO소프트) 면접 준비 버튼으로 ①에 들어간다(로딩을 기다리지 않는다) */
async function enterFirstFromS1(page: Page): Promise<void> {
  await gotoApplications(page)
  await applicationEntries(page).filter({ hasText: COMPANY.oo }).first().getByRole('button', { name: PREP_BUTTON }).click()
  await page.waitForURL(PREP_URL)
}

async function waitLoadingShownAndGone(page: Page): Promise<void> {
  await expect(loadingStatus(page), '① 로딩 화면(role=status)').toBeVisible({ timeout: 3_000 })
  await expect(loadingStatus(page), '로딩이 저절로 끝난다').toBeHidden({ timeout: 5_000 })
}

/** S1에서 보이는 고용24 틀(LD-01: 로딩 중에도 그대로) */
function frameChecks(page: Page): Array<{ key: string; loc: Locator }> {
  return [
    ...BANNER_TEXTS.map((t) => ({ key: `시연 띠 "${t}"`, loc: page.getByText(t).first() })),
    { key: '헤더 "고용24"', loc: page.getByText('고용24', { exact: true }).first() },
    { key: '헤더 "김00님"', loc: page.getByText('김00님').first() },
    { key: '주 메뉴', loc: page.getByRole('navigation', { name: '주 메뉴' }) },
    { key: '왼쪽 메뉴', loc: page.getByRole('navigation', { name: '마이페이지 메뉴' }) },
    { key: '경로 표시', loc: page.getByRole('navigation', { name: '현재 위치' }) },
  ]
}

test('LD-01 S1 면접 준비 버튼으로 ①에 처음 들어가면 로딩(role=status)이 먼저: 제목·단계 3줄 차례로·근거 인용 1~4개 차례로 · 고용24 틀·S4 머리·단계 표시 그대로', async ({ page }) => {
  const quotes = analysisQuotes('K-MOCK-0001')
  expect(quotes.length, '(주)OO소프트 공고 분석의 근거 인용').toBeGreaterThan(0)
  await installLdRecorder(page, quotes)
  await gotoApplications(page)
  const baseline = new Map<string, boolean>()
  for (const f of frameChecks(page)) baseline.set(f.key, await f.loc.isVisible())

  await applicationEntries(page).filter({ hasText: COMPANY.oo }).first().getByRole('button', { name: PREP_BUTTON }).click()
  await page.waitForURL(PREP_URL)
  const status = loadingStatus(page)
  await expect(status, '로딩 화면(role=status) 제목 "AI가 분석한 공고를 펼치고 있어요"').toBeVisible({ timeout: 3_000 })
  await expect(page.getByText('AI 분석 요약', { exact: true }).filter({ visible: true }), '로딩 중에는 ① 내용이 아직 없다').toHaveCount(0)
  for (const f of frameChecks(page)) if (baseline.get(f.key)) await expect.soft(f.loc, `로딩 중 고용24 틀: ${f.key}`).toBeVisible()
  await expect(heading(page, S4_TITLE), '로딩 중 S4 머리').toBeVisible()
  await expect(currentStep(page), '로딩 중 단계 표시(현재 "공고 확인")').toContainText('공고 확인')
  if (!(await status.isVisible())) test.info().annotations.push({ type: 'LD-01', description: '틀 확인이 끝났을 때 로딩이 이미 끝나 있었음' })
  await expect(status).toBeHidden({ timeout: 5_000 })

  const rec = await ldRecord(page)
  rec.steps.forEach((t, i) => expect(t, `단계 "${LOADING_STEPS[i]}"가 로딩 안에서 켜진다`).not.toBeNull())
  const stepTimes = rec.steps.map((t) => t ?? 0)
  for (let i = 1; i < stepTimes.length; i++) expect(stepTimes[i], `단계 ${i + 1}은 ${i}번째 단계 뒤에 켜진다`).toBeGreaterThanOrEqual(stepTimes[i - 1] ?? 0)
  const shown = rec.quotes.map((t, i) => ({ t, q: quotes[i] ?? '' })).filter((x): x is { t: number; q: string } => x.t !== null)
  expect(shown.length, `로딩 안에 이 공고 분석의 근거 인용(1~4개): ${shown.map((x) => x.q).join(' / ')}`).toBeGreaterThanOrEqual(1)
  expect(shown.length, '근거 인용은 최대 4개').toBeLessThanOrEqual(4)
  if (shown.length >= 2) {
    const ts = shown.map((x) => x.t)
    expect(Math.max(...ts) - Math.min(...ts), '근거 인용이 하나씩 차례로 나타난다').toBeGreaterThanOrEqual(100)
  }
})

test('LD-01 S1 "바로 해 보기"로 ①에 처음 들어가도 로딩이 먼저 보이고 단계 3줄이 있다', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰은 "바로 해 보기"를 숨긴다(1행 버튼이 바로 아래, D-198)')
  await gotoApplications(page)
  await page.getByRole('button', { name: '바로 해 보기' }).click()
  await page.waitForURL(PREP_URL)
  const status = loadingStatus(page)
  await expect(status).toBeVisible({ timeout: 3_000 })
  for (const s of LOADING_STEPS) await expect(status, `단계 "${s}"`).toContainText(s, { timeout: 2_500 })
  await expect(status).toBeHidden({ timeout: 5_000 })
  await waitPostingReady(page)
})

test('LD-02 로딩은 1.5~2.5초 뒤 저절로 ①로 바뀌고 초점은 ① 제목으로', async ({ page }) => {
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await waitLoadingShownAndGone(page)
  await expect.poll(async () => (await ldRecord(page)).hidden, { message: '로딩이 끝난 때' }).not.toBeNull()
  const rec = await ldRecord(page)
  const d = (rec.hidden ?? 0) - (rec.shown ?? 0)
  expect(d, `로딩 길이 ${Math.round(d)}ms(1.5~2.5초)`).toBeGreaterThanOrEqual(1_400)
  expect(d, `로딩 길이 ${Math.round(d)}ms(1.5~2.5초)`).toBeLessThanOrEqual(2_650)
  await waitPostingReady(page)
  await expect.poll(() => focusedHeading(page), { message: '로딩이 끝나면 초점이 ① 제목(단계 표시 뒤의 제목)으로', timeout: 3_000 }).toMatchObject({ afterSteps: true })
})

test('LD-02 같은 지원 건은 두 번째부터 로딩 없이 바로 ①(단계 표시·새로고침·S1 다시·③ "근거 보기") · "시연 초기화" 뒤에는 다시 로딩', async ({ page }) => {
  test.setTimeout(180_000)
  acceptDialogs(page)
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await waitLoadingShownAndGone(page)
  await waitPostingReady(page)
  const expectNoLoading = async (how: string): Promise<void> => {
    await waitPostingReady(page)
    await page.waitForTimeout(800)
    expect((await ldRecord(page)).shown, `${how}: 로딩 없이 바로 ①`).toBeNull()
  }

  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await expectCurrentStep(page, '내 기대·걱정')
  await ldReset(page)
  await stepList(page).getByRole('link', { name: /공고 확인/ }).click()
  await expectNoLoading('단계 표시 "공고 확인"으로 돌아오기')

  await page.reload()
  await expectNoLoading('①에서 새로고침')

  await enterFirstFromS1(page)
  await expectNoLoading('S1 면접 준비 버튼으로 다시')

  await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
  await fillPresetA(page)
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  const item = questionItems(page).first()
  await item.getByText(WHY_TEXT).first().click()
  await ldReset(page)
  await item.getByRole('link', { name: '근거 보기' }).first().click()
  await expect(page).toHaveURL(STEP_RE(1))
  await expectNoLoading('③ "근거 보기"(?card=)로 오기')

  await demoAction(page, '시연 초기화')
  await enterFirstFromS1(page)
  await expect(loadingStatus(page), '"시연 초기화" 뒤에는 다시 로딩').toBeVisible({ timeout: 3_000 })
})

test('LD-03 로딩 뒤 ① 형광펜이 문서 순서로 차례로 칠해진다: data-drawn false → true, 첫 화면은 2초 안, 화면 밖은 스크롤해서 보일 때', async ({ page }) => {
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await waitLoadingShownAndGone(page)
  await expect.poll(async () => (await ldRecord(page)).firstView, { message: '로딩 직후 첫 화면 형광펜 기록' }).not.toBeNull()
  await page.waitForTimeout(2_300)
  const rec = await ldRecord(page)
  expect(rec.falseSeen, '칠하기 전 <mark data-drawn="false">').toBeGreaterThan(0)
  const marks = await ldMarks(page)
  expect(marks.length, '① 형광펜').toBeGreaterThan(0)
  const view = new Set(rec.firstView ?? [])
  const first = marks.filter((m) => view.has(m.i))
  if (first.length === 0) test.info().annotations.push({ type: 'LD-03', description: '로딩 직후 첫 화면 안에 형광펜이 없었음' })
  for (const m of first) {
    expect(m.drawn, `첫 화면 형광펜 "${m.text}"은 로딩 뒤 2초 안에 칠해진다`).toBe('true')
    expect((m.t ?? Infinity) - (rec.hidden ?? 0), `첫 화면 형광펜 "${m.text}" 칠해진 때(로딩 끝에서 ms)`).toBeLessThanOrEqual(2_100)
  }
  for (let k = 1; k < first.length; k++) {
    const a = first[k - 1]
    const b = first[k]
    if (!a || !b) continue
    const gap = (b.t ?? 0) - (a.t ?? 0)
    expect(gap, `문서 순서로 차례로: "${a.text}" 다음 "${b.text}"(${Math.round(gap)}ms)`).toBeGreaterThanOrEqual(30)
    expect(gap, `칠하는 간격 약 0.25초: "${a.text}" → "${b.text}"`).toBeLessThanOrEqual(700)
  }
  const below = marks.filter((m) => !view.has(m.i) && m.top >= m.vh)
  if (below.length === 0) {
    test.info().annotations.push({ type: 'LD-03', description: '처음 화면 아래에 있는 형광펜이 없어 "보일 때 칠하기"는 건너뜀' })
    return
  }
  for (const m of below) expect(m.drawn, `화면 밖 형광펜 "${m.text}"은 보이기 전까지 칠하지 않는다`).toBe('false')
  const last = below[below.length - 1] as (typeof below)[number]
  await page.locator('mark').nth(last.i).scrollIntoViewIfNeeded()
  await expect.poll(async () => (await ldMarks(page))[last.i]?.drawn, { message: `"${last.text}"이 보이면 칠해진다`, timeout: 4_000 }).toBe('true')
})

test('LD-03 칠하는 중에도 형광펜 누르기(설명)·"AI 분석 요약" 인용 누르기(켜짐)가 된다', async ({ page }) => {
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await expect(loadingStatus(page)).toBeVisible({ timeout: 3_000 })
  await waitPostingReady(page)
  const drawing = (await ldMarks(page)).some((m) => m.drawn === 'false')
  test.info().annotations.push({ type: 'LD-03', description: `누를 때 아직 칠하지 않은 형광펜 ${drawing ? '있음' : '없음'}` })
  const mark = page.locator('mark').filter({ hasText: '기타 업무 지원' }).first()
  await mark.click()
  await expect(page.getByText('기존 시스템 유지보수').filter({ visible: true }).first(), '형광펜을 누르면 설명(S4-04)').toBeVisible()
  await page.keyboard.press('Escape')
  const quote = page.getByRole('list', { name: /먼저 볼/ }).getByRole('button').first()
  await quote.click()
  await expect(page.locator('mark[data-active="true"]').first(), '"AI 분석 요약" 인용을 누르면 그 형광펜이 켜진다(F-04)').toBeVisible()
})

test('LD-03 다 칠한 형광펜 모양은 지금 형광펜(두 번째 방문, 처음부터 칠한 것)과 같다', async ({ page }) => {
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await waitLoadingShownAndGone(page)
  await waitPostingReady(page)
  const marks = page.locator('mark')
  const n = await marks.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) await marks.nth(i).scrollIntoViewIfNeeded()
  await expect.poll(async () => (await ldMarks(page)).every((m) => m.drawn === 'true'), { message: '보인 형광펜이 모두 칠해진다', timeout: 8_000 }).toBe(true)
  await page.waitForTimeout(800)
  const first: Array<Record<string, string>> = []
  for (let i = 0; i < n; i++) first.push(await markLook(marks.nth(i)))
  await page.reload()
  await waitPostingReady(page)
  await page.waitForTimeout(800)
  await expect(marks).toHaveCount(n)
  for (let i = 0; i < n; i++) expect(await markLook(marks.nth(i)), `${i + 1}번째 형광펜: 다 칠한 모양 = 처음부터 칠한 모양`).toEqual(first[i])
})

test('LD-04 두 번째 방문: 로딩 없이 바로 ①, 형광펜은 처음부터 data-drawn="true"', async ({ page }) => {
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await waitLoadingShownAndGone(page)
  await waitPostingReady(page)
  await enterFirstFromS1(page)
  await waitPostingReady(page)
  await page.waitForTimeout(800)
  const rec = await ldRecord(page)
  expect(rec.shown, '두 번째 방문은 로딩 없음').toBeNull()
  expect(rec.falseSeen, '두 번째 방문은 data-drawn="false"인 형광펜이 없다').toBe(0)
  const marks = await ldMarks(page)
  expect(marks.length).toBeGreaterThan(0)
  for (const m of marks) expect(m.drawn, `"${m.text}" data-drawn`).toBe('true')
})

test('LD-04 움직임 줄이기(prefers-reduced-motion: reduce): 첫 방문도 로딩 없이 바로 ①, 형광펜은 처음부터 data-drawn="true"', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await waitPostingReady(page)
  await page.waitForTimeout(800)
  const rec = await ldRecord(page)
  expect(rec.shown, '움직임 줄이기면 로딩 없음').toBeNull()
  expect(rec.falseSeen, '움직임 줄이기면 data-drawn="false"인 형광펜이 없다').toBe(0)
  const marks = await ldMarks(page)
  expect(marks.length).toBeGreaterThan(0)
  for (const m of marks) expect(m.drawn, `"${m.text}" data-drawn`).toBe('true')
})

test('LD-05 로딩 화면에 "분석하는 중"·"분석 중"처럼 지금 분석한다는 말이 없다', async ({ page }) => {
  await enterFirstFromS1(page)
  const status = loadingStatus(page)
  await expect(status).toBeVisible({ timeout: 3_000 })
  const texts = new Set<string>()
  for (let i = 0; i < 30 && (await status.isVisible().catch(() => false)); i++) {
    texts.add(normalize(await status.innerText().catch(() => '')))
    await page.waitForTimeout(100)
  }
  const all = [...texts].join(' ')
  expect(all, '로딩 글').toContain('AI가 분석한 공고를 펼치고 있어요')
  expect(all, '지금 분석한다는 말 없음').not.toMatch(/분석\s*(?:하는\s*)?중|분석하고\s*있/)
})

test('LD-06 휴대폰 375×812: 로딩 화면이 가로로 넘치지 않고 단계 3줄이 첫 화면에 보인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 기준')
  await enterFirstFromS1(page)
  const status = loadingStatus(page)
  await expect(status).toBeVisible({ timeout: 3_000 })
  await expectNoPageOverflow(page, '로딩 중')
  await expectNoSideOverflow(status, '로딩 화면')
  for (const s of LOADING_STEPS) {
    const line = status.getByText(s).first()
    await expect(line, `단계 "${s}"`).toBeVisible({ timeout: 2_500 })
    expect(insideBand(await rectOf(line), await visibleBand(page)), `단계 "${s}"가 첫 화면 안`).toBe(true)
  }
})

test('LD-06 로딩 중·형광펜 칠하는 중에 axe 위반이 없다', async ({ page }) => {
  await installLdRecorder(page)
  await enterFirstFromS1(page)
  await expect(loadingStatus(page)).toBeVisible({ timeout: 3_000 })
  expect(await seriousAxeViolations(page), '로딩 중 axe').toEqual([])
  if (!(await loadingStatus(page).isVisible())) test.info().annotations.push({ type: 'LD-06', description: 'axe 검사가 끝났을 때 로딩이 이미 끝나 있었음' })
  await expect(loadingStatus(page)).toBeHidden({ timeout: 5_000 })
  await waitPostingReady(page)
  const drawing = (await ldMarks(page)).some((m) => m.drawn === 'false')
  expect(await seriousAxeViolations(page), '형광펜 칠하는 중 axe').toEqual([])
  test.info().annotations.push({ type: 'LD-06', description: `둘째 검사 때 칠하는 중인 형광펜 ${drawing ? '있음' : '없음'}` })
})

// ═══ TR — 처음 온 사람 안내(스포트라이트) ══════════════════════════

/** 다른 화면 안내(2~3단계, 마지막 "닫기")를 끝까지 넘겨 닫는다. 단계마다 다른 것과 겹치지 않는지(TR-08) 본다. */
async function expectScreenTour(page: Page, label: string): Promise<TourStep[]> {
  await waitTour(page, label, 20_000)
  const steps = await walkTour(page, async (s) => {
    const at = `${label} ${s.n}/${s.m}`
    await expect(openHelpDialogs(page), `${at}: 도움말 팝업과 겹쳐 뜨지 않는다`).toHaveCount(0)
    await expect(loadingStatus(page).filter({ visible: true }), `${at}: ① 로딩과 겹치지 않는다`).toHaveCount(0)
    await expect(demoItem(page, '시연 초기화').filter({ visible: true }), `${at}: 시연 도구 메뉴와 겹치지 않는다`).toHaveCount(0)
  })
  expect(steps[0]?.n, `${label}: 1단계부터`).toBe(1)
  const m = steps[0]?.m ?? 0
  expect(m, `${label}: 2~3단계`).toBeGreaterThanOrEqual(2)
  expect(m, `${label}: 2~3단계`).toBeLessThanOrEqual(3)
  const last = steps[steps.length - 1]
  expect(last?.buttons, `${label}: 마지막 단계 버튼 "닫기"`).toContain('닫기')
  expect(last?.buttons, `${label}: "시작하기"는 S1 서비스 안내에만`).not.toContain('시작하기')
  await tourDialog(page).filter({ visible: true }).first().getByRole('button', { name: '닫기', exact: true }).click()
  await expect(tourDialog(page).filter({ visible: true }), `${label}: "닫기"로 닫힌다`).toHaveCount(0)
  return steps
}

/** S1 서비스 안내가 비출 만한 화면 요소(비춘 곳 안에 가운데가 든 것을 대상으로 본다) */
function s1Targets(page: Page): Locator[] {
  return [
    mainMenuItem(page, '채용정보'),
    page.getByRole('table').first(),
    applicationEntries(page).first(),
    applicationEntries(page).nth(1),
    applicationEntries(page).first().getByRole('button', { name: PREP_BUTTON }),
    applicationEntries(page).nth(1).getByRole('button', { name: PREP_BUTTON }),
    page.getByRole('navigation', { name: '마이페이지 메뉴' }).getByRole('link', { name: '이력서/자기소개서 관리' }),
    demoToolsButton(page),
  ]
}

async function litTarget(targets: Locator[], hole: Rect): Promise<Rect | null> {
  let best: { r: Rect; area: number } | null = null
  for (const t of targets) {
    if (!(await t.isVisible().catch(() => false))) continue
    const r = await rectOf(t)
    const cx = (r.left + r.right) / 2
    const cy = (r.top + r.bottom) / 2
    if (cx < hole.left || cx > hole.right || cy < hole.top || cy > hole.bottom) continue
    const area = r.width * r.height
    if (!best || area > best.area) best = { r, area }
  }
  return best?.r ?? null
}

const fmtRect = (r: Rect): string => `${Math.round(r.left)},${Math.round(r.top)}~${Math.round(r.right)},${Math.round(r.bottom)}`

test.describe('TR — 처음 온 사람 안내(시험 스위치 rq:test:tour-off 없이)', () => {
  test.use({ storageState: NO_TOUR_SWITCH })
  test.describe.configure({ timeout: 180_000 })

  test('TR-01 처음 방문: "/" → S1에서 서비스 안내가 저절로 시작 — 어두운 막·대상 하나만 밝게, 설명 상자(dialog·aria-modal·제목·N/M·이전·다음·건너뛰기, 끝 "시작하기"), 6~8단계에 기능 전체', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(S1_URL)
    expect(await page.evaluate((k) => localStorage.getItem(k), TOUR_OFF_KEY), 'TR 시험은 시험 스위치 없이 돈다').toBeNull()
    await waitTour(page, 'S1 서비스 안내')
    const d = tourDialog(page).filter({ visible: true }).first()
    await expect(d, '설명 상자 aria-modal="true"').toHaveAttribute('aria-modal', 'true')
    await expect(d, '설명 상자 제목(접근 이름)').toHaveAccessibleName(/\S/)
    const spots: SpotAnalysis[] = []
    const steps = await walkTour(page, async (s) => {
      spots.push(await analyzeSpotlight(page, s.box))
      if (s.n < s.m) {
        expect(s.buttons, `${s.n}/${s.m}: "다음"`).toContain('다음')
        expect(s.buttons, `${s.n}/${s.m}: "건너뛰기"`).toContain('건너뛰기')
      }
      if (s.n > 1) expect(s.buttons, `${s.n}/${s.m}: "이전"`).toContain('이전')
    })
    expect(steps[0]?.n, '1단계부터').toBe(1)
    const m = steps[0]?.m ?? 0
    expect(m, 'S1 서비스 안내 6~8단계').toBeGreaterThanOrEqual(6)
    expect(m, 'S1 서비스 안내 6~8단계').toBeLessThanOrEqual(8)
    expect(steps).toHaveLength(m)
    const last = steps[steps.length - 1]
    expect(last?.buttons, '마지막 단계 "시작하기"').toContain('시작하기')
    expect(last?.buttons, '마지막 단계에는 "다음"이 없다').not.toContain('다음')
    const all = steps.map((s) => s.text).join(' ')
    for (const w of SERVICE_TOUR_WORDS) expect(all, `서비스 안내 설명 글에 "${w}"`).toContain(w)
    spots.forEach((sp, i) => {
      expect(sp.clusters.filter((c) => c.spansScreen).length, `${i + 1}/${m}: 화면 전체가 밝다(어두운 막이 없다)`).toBe(0)
      expect(sp.clusters.length, `${i + 1}/${m}: 밝게 비춘 곳은 하나 이하(${sp.clusters.map((c) => fmtRect(c.bbox)).join(' · ')})`).toBeLessThanOrEqual(1)
      expect(sp.dimFraction, `${i + 1}/${m}: 비춘 곳·설명 상자 밖은 어둡다(어두운 칸 비율 ${sp.dimFraction.toFixed(2)})`).toBeGreaterThanOrEqual(0.85)
    })
    expect(spots.filter((sp) => sp.clusters.length === 1).length, '대상 하나를 밝게 비춘 단계').toBeGreaterThanOrEqual(2)
    await tourDialog(page).filter({ visible: true }).first().getByRole('button', { name: '시작하기', exact: true }).click()
    await expect(tourDialog(page).filter({ visible: true }), '"시작하기"로 닫힌다').toHaveCount(0)
  })

  test('TR-02 다른 화면에 처음 들어가면 그 화면 안내(2~3단계, 끝 "닫기"): 채용정보 목록·공고 상세·이력서·①(로딩·형광펜 뒤)·②·③ 1차·1차 면접 정리·최종 ③ · /about-ai·없는 주소는 안내 없음', async ({ page }) => {
    test.setTimeout(420_000)
    acceptDialogs(page)
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1 서비스 안내')
    await skipTour(page)

    await page.goto('/jobs')
    await expect(heading(page, S3_TITLE)).toBeVisible()
    await expectScreenTour(page, '채용정보 목록')
    const [detailPath] = await jobDetailPaths(page)
    await page.goto(detailPath ?? '/jobs')
    await expect(heading(page, '모집요강')).toBeVisible()
    const detail = (await expectScreenTour(page, '공고 상세')).map((s) => s.text).join(' ')
    expect(detail, '공고 상세 안내: 입사지원').toContain('입사지원')
    expect(detail, '공고 상세 안내: → 지원 현황').toContain('지원 현황')

    await page.goto('/mypage/resume')
    await expect(heading(page, S2_TITLE)).toBeVisible()
    await expectScreenTour(page, '이력서')

    await enterFirstFromS1(page)
    await waitTour(page, '① 공고 확인', 20_000)
    await expect(loadingStatus(page).filter({ visible: true }), '① 안내는 로딩이 끝난 뒤').toHaveCount(0)
    const undrawn = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('mark')).filter((m) => {
          const r = m.getBoundingClientRect()
          return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && m.getAttribute('data-drawn') === 'false'
        }).length,
    )
    expect(undrawn, '① 안내는 첫 화면 형광펜을 다 칠한 뒤').toBe(0)
    await expectScreenTour(page, '① 공고 확인')

    await page.getByRole('button', { name: '내 기대·걱정 고르기' }).click()
    await expectScreenTour(page, '② 기대·걱정 고르기')
    await fillPresetA(page)
    await makeQuestionsButton(page).click()
    await waitFirstResults(page)
    await expectScreenTour(page, '③ 1차 질문')
    await page.getByRole('button', { name: WENT_BUTTON, exact: true }).click()
    await expectScreenTour(page, '1차 면접 정리')
    await fillReviewR04(page)
    await page.getByRole('button', { name: '최종 질문 만들기', exact: true }).click()
    await waitFinalResults(page)
    await expectScreenTour(page, '최종 ③')

    await page.goto('/about-ai')
    await expect(heading(page, '이 질문은 어떻게 만들어지나요')).toBeVisible()
    await expectNoTour(page, '/about-ai')
    await page.goto(MISSING_PATH)
    await expect(page.getByText(NOT_FOUND_TEXT).first()).toBeVisible()
    await expectNoTour(page, '없는 주소')
  })

  test('TR-03 한 번 안내한 화면은 다시 들어와도 뜨지 않는다(Esc·건너뛰기·끝까지 · 새로고침·새 탭) · "시연 초기화"면 모두 처음 상태로, S1 서비스 안내가 다시', async ({ page, context }) => {
    acceptDialogs(page)
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1 처음')
    await page.keyboard.press('Escape')
    await expect(tourDialog(page).filter({ visible: true }), 'Esc = 건너뛰기').toHaveCount(0)
    await page.reload()
    await expect(heading(page, S1_TITLE)).toBeVisible()
    await expectNoTour(page, 'S1 새로고침(Esc로 닫음)')
    const tab = await context.newPage()
    await tab.goto('/mypage/applications')
    await expect(heading(tab, S1_TITLE)).toBeVisible()
    await expectNoTour(tab, 'S1 새 탭')
    await tab.close()

    await page.goto('/jobs')
    await waitTour(page, '채용정보 목록')
    await walkTour(page)
    await tourDialog(page).filter({ visible: true }).first().getByRole('button', { name: '닫기', exact: true }).click()
    await page.reload()
    await expect(heading(page, S3_TITLE)).toBeVisible()
    await expectNoTour(page, '채용정보 목록 새로고침(끝까지 봄)')

    await page.goto('/mypage/resume')
    await waitTour(page, '이력서')
    await skipTour(page)
    await page.goto('/mypage/resume')
    await expect(heading(page, S2_TITLE)).toBeVisible()
    await expectNoTour(page, '이력서 다시(건너뜀)')

    await demoMenuClick(page, '시연 초기화')
    await page.goto('/mypage/applications')
    await waitTour(page, '"시연 초기화" 뒤 S1')
    expect((await readTourStep(page)).n, '서비스 안내 1단계부터').toBe(1)
    await skipTour(page)
    await page.goto('/jobs')
    await waitTour(page, '"시연 초기화" 뒤 채용정보 목록')
  })

  test('TR-04 S1 안내 띠 "이용 안내 다시 보기"·시연 도구 "안내 다시 보기"는 서비스 안내를 1단계부터 다시 띄운다(다른 화면 안내 기록은 그대로)', async ({ page }) => {
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1')
    await skipTour(page)
    await page.goto('/jobs')
    await waitTour(page, '채용정보 목록')
    await skipTour(page)

    await gotoApplications(page)
    await expectNoTour(page, 'S1(본 화면)', 1_500)
    await page.getByRole('button', { name: '이용 안내 다시 보기', exact: true }).click()
    await waitTour(page, '"이용 안내 다시 보기"')
    let s = await readTourStep(page)
    expect(s.n, '"이용 안내 다시 보기" → 1단계부터').toBe(1)
    expect(s.m, '서비스 안내(6~8단계)').toBeGreaterThanOrEqual(6)
    await skipTour(page)

    await demoMenuClick(page, '안내 다시 보기')
    await waitTour(page, '시연 도구 "안내 다시 보기"')
    s = await readTourStep(page)
    expect(s.n, '시연 도구 "안내 다시 보기" → 1단계부터').toBe(1)
    expect(s.m, '서비스 안내(6~8단계)').toBeGreaterThanOrEqual(6)
    await expect(demoItem(page, '시연 초기화').filter({ visible: true }), '안내는 시연 도구 메뉴가 닫힌 뒤(TR-08)').toHaveCount(0)
    await skipTour(page)

    await page.goto('/jobs')
    await expect(heading(page, S3_TITLE)).toBeVisible()
    await expectNoTour(page, '채용정보 목록(다른 화면 기록은 그대로)')
  })

  test('TR-05 시연 도구 "안내 끄기" → 어느 화면에서도 저절로 뜨지 않고 버튼은 "안내 켜기" · "시연 초기화"는 끄기도 풀어 처음 상태로', async ({ page }) => {
    acceptDialogs(page)
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1')
    await skipTour(page)
    await demoMenuClick(page, '안내 끄기')
    expect(await demoMenuHas(page, '안내 켜기'), '"안내 끄기" 뒤 버튼은 "안내 켜기"').toBe(true)
    await page.goto('/jobs')
    await expect(heading(page, S3_TITLE)).toBeVisible()
    await expectNoTour(page, '안내 끈 뒤 채용정보 목록')
    await page.goto('/mypage/resume')
    await expect(heading(page, S2_TITLE)).toBeVisible()
    await expectNoTour(page, '안내 끈 뒤 이력서')
    await openPrep(page, 'oo')
    await expectNoTour(page, '안내 끈 뒤 ① 공고 확인', 4_000)

    await demoMenuClick(page, '시연 초기화')
    await page.goto('/mypage/applications')
    await waitTour(page, '"시연 초기화" 뒤 S1(끄기도 풀림)')
    await skipTour(page)
    expect(await demoMenuHas(page, '안내 끄기'), '"시연 초기화" 뒤 버튼은 다시 "안내 끄기"').toBe(true)
  })

  test('TR-05 주소에 ?tour=off를 붙여 들어오면 끈 것과 같다(이 브라우저에 저장: 다른 화면·새 탭도)', async ({ page, context }) => {
    await page.goto('/mypage/applications?tour=off')
    await expect(heading(page, S1_TITLE)).toBeVisible()
    await expectNoTour(page, '?tour=off S1')
    await page.goto('/jobs')
    await expect(heading(page, S3_TITLE)).toBeVisible()
    await expectNoTour(page, '?tour=off 뒤 채용정보 목록')
    const tab = await context.newPage()
    await tab.goto('/mypage/resume')
    await expect(heading(tab, S2_TITLE)).toBeVisible()
    await expectNoTour(tab, '?tour=off 뒤 새 탭 이력서')
    await tab.close()
    expect(await demoMenuHas(page, '안내 켜기'), '?tour=off 뒤 시연 도구 버튼은 "안내 켜기"').toBe(true)
  })

  test('TR-06 초점은 설명 상자로·Tab은 상자 안에서만·Esc = 건너뛰기·닫히면 초점은 화면 제목(또는 안내 전 자리) · "다음"이면 대상이 화면 안, 비춘 곳과 상자는 안 겹침 · 뒤 화면은 안 눌림 · axe', async ({ page }) => {
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1')
    const d = (): Locator => tourDialog(page).filter({ visible: true }).first()
    await expect.poll(() => focusInside(d()), { message: '안내가 뜨면 초점이 설명 상자 안' }).toBe(true)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInside(d()), `Tab ${i + 1}번째: 초점이 상자 안에서만 돈다`).toBe(true)
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focusInside(d()), `Shift+Tab ${i + 1}번째: 초점이 상자 안`).toBe(true)
    }
    expect(await seriousAxeViolations(page), '안내가 떠 있는 상태 axe').toEqual([])

    const targets = s1Targets(page)
    await walkTour(page, async (s) => {
      const at = `${s.n}/${s.m}`
      const sp = await analyzeSpotlight(page, s.box)
      expect(sp.clusters.filter((c) => c.spansScreen).length, `${at}: 화면 전체가 밝다(어두운 막이 없다)`).toBe(0)
      const hole = sp.clusters[0]
      if (!hole) return
      expect(intersects(hole.bbox, s.box), `${at}: 비춘 곳(${fmtRect(hole.bbox)})과 설명 상자(${fmtRect(s.box)})가 겹치지 않는다`).toBe(false)
      expect(hole.bbox.bottom, `${at}: 비춘 대상이 화면 안(아래끝 ${hole.bbox.bottom} < 화면 ${s.vh})`).toBeLessThanOrEqual(s.vh - 2)
      const t = await litTarget(targets, hole.bbox)
      if (t) expect(intersects(t, s.box), `${at}: 비춘 대상 상자(${fmtRect(t)})와 설명 상자(${fmtRect(s.box)})가 겹치지 않는다`).toBe(false)
    })
    await page.keyboard.press('Escape')
    await expect(tourDialog(page).filter({ visible: true }), 'Esc = 건너뛰기').toHaveCount(0)
    await expect(heading(page, S1_TITLE), '안내 전 초점 자리가 없으면 화면 제목으로').toBeFocused()

    const again = page.getByRole('button', { name: '이용 안내 다시 보기', exact: true })
    await again.click()
    await waitTour(page, '"이용 안내 다시 보기"')
    await expect.poll(() => focusInside(d()), { message: '다시 띄운 안내도 초점이 상자 안' }).toBe(true)
    const before = page.url()
    const box = await rectOf(d())
    let clicked = ''
    for (const [name, c] of [
      ['주 메뉴 "채용정보"', mainMenuItem(page, '채용정보')],
      ['"검색"', page.getByRole('button', { name: '검색', exact: true })],
      ['"이력서/자기소개서 관리"', page.getByRole('link', { name: '이력서/자기소개서 관리' }).first()],
    ] as const) {
      if (!(await c.isVisible().catch(() => false))) continue
      const r = await rectOf(c)
      if (r.width < 2 || intersects(r, box) || r.top < 0 || r.bottom > (await viewport(page)).vh) continue
      await page.mouse.click(r.left + r.width / 2, r.top + r.height / 2)
      clicked = name
      break
    }
    expect(clicked, '눌러 볼 뒤 화면 링크·버튼').not.toBe('')
    await page.waitForTimeout(600)
    expect(page.url(), `안내 중에는 뒤 화면(${clicked})이 눌리지 않는다`).toBe(before)
    await expect(d(), '뒤를 눌러도 안내는 그대로').toBeVisible()
    await d().getByRole('button', { name: '건너뛰기', exact: true }).click()
    await expect(tourDialog(page).filter({ visible: true })).toHaveCount(0)
    await expect(again, '닫히면 초점이 안내 전 자리("이용 안내 다시 보기")로').toBeFocused()
  })

  for (const size of [
    { width: 1440, height: 900, mobile: false },
    { width: 1366, height: 657, mobile: false },
    { width: 375, height: 812, mobile: true },
  ] as const) {
    test(`TR-07 ${size.width}×${size.height}: 모든 단계에서 설명 상자 전체가 화면 안·가로 넘침 없음${size.mobile ? '·아래 시트, 비춘 대상은 시트 위' : ''} · 빈 구멍·화면 밖 구멍 없음`, async ({ page, isMobile }) => {
      test.skip(isMobile !== size.mobile, size.mobile ? '휴대폰 프로젝트에서' : '데스크톱 프로젝트에서')
      if (!isMobile) await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto('/mypage/applications')
      await waitTour(page, 'S1 서비스 안내')
      await walkTour(page, async (s) => {
        const at = `${size.width}×${size.height} ${s.n}/${s.m}`
        const b = s.box
        expect(b.left >= -1 && b.top >= -1 && b.right <= s.vw + 1 && b.bottom <= s.vh + 1, `${at}: 설명 상자 전체가 화면 안(${fmtRect(b)}, 화면 ${s.vw}×${s.vh})`).toBe(true)
        expect(s.scrollWidth, `${at}: 가로 넘침 없음`).toBeLessThanOrEqual(s.clientWidth)
        if (isMobile) {
          expect(Math.abs(b.bottom - s.vh), `${at}: 휴대폰은 화면 아래 시트(아래끝 ${Math.round(b.bottom)})`).toBeLessThanOrEqual(1.5)
          expect(b.width, `${at}: 시트 폭`).toBeGreaterThanOrEqual(s.vw * 0.9)
        }
        const sp = await analyzeSpotlight(page, b)
        expect(sp.clusters.filter((c) => c.spansScreen).length, `${at}: 화면 전체가 밝다(어두운 막이 없다)`).toBe(0)
        expect(sp.clusters.length, `${at}: 비춘 곳은 하나 이하`).toBeLessThanOrEqual(1)
        const hole = sp.clusters[0]
        if (!hole) return
        expect(hole.minLum, `${at}: 비춘 곳(${fmtRect(hole.bbox)})에 내용이 있다(빈 구멍 아님)`).toBeLessThan(0.6)
        expect(hole.bbox.bottom, `${at}: 비춘 곳이 화면 안(화면 밖 구멍 없음)`).toBeLessThanOrEqual(s.vh - 2)
        if (isMobile) expect(hole.bbox.bottom, `${at}: 비춘 대상은 시트 위(대상 아래끝 ${hole.bbox.bottom} ≤ 시트 위끝 ${Math.round(b.top)})`).toBeLessThanOrEqual(b.top + 1)
      })
    })
  }

  test('TR-08 움직임 줄이기(prefers-reduced-motion: reduce)면 상자 등장·비춤 이동에 움직임이 없다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1')
    const running = (): Promise<string[]> =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => (a instanceof CSSAnimation ? `animation ${a.animationName}` : a instanceof CSSTransition ? `transition ${a.transitionProperty}` : 'animation')),
      )
    expect(await running(), '상자 등장에 움직임 없음').toEqual([])
    await tourDialog(page).filter({ visible: true }).first().getByRole('button', { name: '다음', exact: true }).click()
    await page.waitForTimeout(60)
    expect(await running(), '비춤 이동에 움직임 없음').toEqual([])
  })

  test('TR-08 안내는 시연 도구 메뉴가 열려 있으면 닫힌 뒤 시작한다', async ({ page }) => {
    await page.goto('/mypage/applications')
    await waitTour(page, 'S1')
    await skipTour(page)
    await demoToolsButton(page).click()
    await expect(demoItem(page, '안내 다시 보기')).toBeVisible()
    await demoItem(page, '안내 다시 보기').click()
    await waitTour(page, '시연 도구 "안내 다시 보기"')
    await expect(demoItem(page, '시연 초기화').filter({ visible: true }), '안내가 뜰 때 시연 도구 메뉴는 닫혀 있다').toHaveCount(0)
    await expect(openHelpDialogs(page)).toHaveCount(0)
  })
})

test('TR-09 시험 스위치 rq:test:tour-off="1"이면 안내가 저절로 뜨지 않고 "시연 초기화"로 지워지지 않는다(기존 시험은 이 스위치를 켠 채)', async ({ page }) => {
  acceptDialogs(page)
  await gotoApplications(page)
  expect(await page.evaluate((k) => localStorage.getItem(k), TOUR_OFF_KEY), 'playwright.config.ts 공통 설정이 켠 스위치').toBe('1')
  await expectNoTour(page, '스위치 켬 S1')
  await page.goto('/jobs')
  await expect(heading(page, S3_TITLE)).toBeVisible()
  await expectNoTour(page, '스위치 켬 채용정보 목록')
  await demoMenuClick(page, '시연 초기화')
  await gotoApplications(page)
  expect(await page.evaluate((k) => localStorage.getItem(k), TOUR_OFF_KEY), '"시연 초기화"는 시험 스위치를 지우지 않는다').toBe('1')
  await expectNoTour(page, '"시연 초기화" 뒤 스위치 켬 S1')
})
