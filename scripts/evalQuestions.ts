/**
 * 평가 ②③ 끝까지 실행(scripts/eval-questions.ts 가 부른다): 평가 공고 × 예시 구직자 A·B를
 * TS 규칙(shared/) → 로컬 Python AI 서버 → TS 최종 검사 길로 돌려 questions.jsonl · judgements.jsonl 로 남긴다.
 * 서버·LLM 없이 시험하려고 공급자·서버 시작은 인자로 받는다. 콘솔에는 건수만 찍고 공고·질문·회사명은 찍지 않는다.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Preset } from '../shared/catalog.ts'
import type {
  FinalQuestionsResponse,
  FirstQuestionsResponse,
  InterviewReview,
  Posting,
  PostingAnalysis,
  Pref,
} from '../shared/contract.ts'
import { generateFinal, generateFirst, judgeInputFor, PROVIDER_TIMEOUT_MS, type GenerateOptions, type PostingLookup } from '../shared/generate.ts'
import type { FinalDraftInput, FirstDraftInput, LlmProvider } from '../shared/providers/types.ts'

export type Persona = 'A' | 'B'
export interface EvalCase {
  wantedAuthNo: string
  persona: Persona
}

/** Python(evals/metrics_cards.py)가 읽는 줄. 필드 이름을 바꾸지 않는다 */
export interface CaseRow {
  wantedAuthNo: string
  persona: Persona
  first: FirstQuestionsResponse
  first_input: FirstDraftInput | null
  final: FinalQuestionsResponse
  final_input: FinalDraftInput | null
  first_ms: number
  final_ms: number
}

export interface GoldJudgementRow {
  wantedAuthNo: string
  card_id: string
  question: string
  heard: string
  pref: Pref
  expected: string
}

export interface JudgementRow {
  wantedAuthNo: string
  card_id: string
  expected: string
  /** 판정이 빠졌거나 호출이 실패하면 null(맞음·틀림이 아니라 "판정 실패"로 센다) */
  got: string | null
}

export function buildCases(ids: string[]): EvalCase[] {
  return ids.flatMap((wantedAuthNo) => (['A', 'B'] as const).map((persona) => ({ wantedAuthNo, persona })))
}

/** 최종 질문을 만들 때 쓰는 가짜 정리: 1~2위만 물어봤고 들은 답은 없다(판정 LLM은 부르지 않는다) */
export function syntheticReview(first: FirstQuestionsResponse): InterviewReview {
  const review: InterviewReview = { asked: [], not_asked: [], received: [], impression: { mood: 'normal' } }
  first.questions.forEach((q, i) => {
    const question_id = `q${q.rank}`
    if (i < 2) review.asked.push({ question_id, card_id: q.card_id, heard: '', clarity: 'clear' })
    else review.not_asked.push({ question_id, card_id: q.card_id, reason: 'no_time' })
  })
  return review
}

/** 보낸 입력을 sink 에 남긴다(Python 쪽 검사가 같은 입력으로 점수를 매긴다) */
export function recordingProvider(inner: LlmProvider, sink: { first?: FirstDraftInput; final?: FinalDraftInput }): LlmProvider {
  const out: LlmProvider = {
    name: inner.name,
    writeFirst: (input, signal) => {
      sink.first = input
      return inner.writeFirst(input, signal)
    },
  }
  if (inner.judgeReview) out.judgeReview = inner.judgeReview.bind(inner)
  if (inner.writeFinal) {
    const write = inner.writeFinal.bind(inner)
    out.writeFinal = (input, signal) => {
      sink.final = input
      return write(input, signal)
    }
  }
  return out
}

export interface RunDeps {
  provider: LlmProvider
  lookup: GenerateOptions['lookup']
  presets: Record<Persona, Preset>
}

export async function runCase(c: EvalCase, deps: RunDeps): Promise<CaseRow> {
  const preset = deps.presets[c.persona]
  const sink: { first?: FirstDraftInput; final?: FinalDraftInput } = {}
  const provider = recordingProvider(deps.provider, sink)
  const options = { provider, ...(deps.lookup ? { lookup: deps.lookup } : {}) }

  const first = await generateFirst({ mode: 'first', wantedAuthNo: c.wantedAuthNo, picks: preset.picks, experience: preset.experience }, options)
  const first_input = sink.first ?? null
  const final = await generateFinal(
    { mode: 'final', wantedAuthNo: c.wantedAuthNo, picks: preset.picks, review: syntheticReview(first) },
    options,
  )
  return {
    wantedAuthNo: c.wantedAuthNo,
    persona: c.persona,
    first,
    first_input,
    final,
    final_input: sink.final ?? null,
    first_ms: first.elapsed_ms,
    final_ms: final.elapsed_ms,
  }
}

/** 정답표 줄마다 판정 LLM 을 한 번씩 부른다. 줄 하나가 실패해도 나머지는 계속한다 */
export async function runJudgements(
  rows: GoldJudgementRow[],
  deps: { provider: LlmProvider; lookup: { posting(id: string): Posting | undefined } },
): Promise<JudgementRow[]> {
  const out: JudgementRow[] = []
  for (const r of rows) {
    const row: JudgementRow = { wantedAuthNo: r.wantedAuthNo, card_id: r.card_id, expected: r.expected, got: null }
    const posting = deps.lookup.posting(r.wantedAuthNo)
    const judge = deps.provider.judgeReview?.bind(deps.provider)
    if (posting && judge) {
      const input = judgeInputFor(posting, [{ card_id: r.card_id, pref: r.pref, heard: r.heard }])
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS)
      try {
        const got = await judge(input, ctrl.signal)
        row.got = got.find((g) => g.card_id === r.card_id)?.state ?? null
      } catch {
        row.got = null
      } finally {
        clearTimeout(timer)
      }
    }
    out.push(row)
  }
  return out
}

// ── 서버 수명 ─────────────────────────────────────────────────
export interface ServerProc {
  kill(sig?: string): void
  exited: Promise<void>
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** promise 가 ms 안에 끝나면 true, 아니면 false(타이머는 늘 정리) */
async function finishedWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<false>((r) => {
    timer = setTimeout(() => r(false), ms)
  })
  try {
    return await Promise.race([promise.then(() => true, () => true), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function safeKill(proc: ServerProc, sig: string): void {
  try {
    proc.kill(sig)
  } catch {
    // 이미 끝난 프로세스: 원래 오류를 가리지 않는다
  }
}

async function stopServer(proc: ServerProc): Promise<void> {
  safeKill(proc, 'SIGTERM')
  if (await finishedWithin(proc.exited, 5000)) return
  safeKill(proc, 'SIGKILL')
  await finishedWithin(proc.exited, 2000)
}

/** 서버를 띄우고 준비되면 body 를 돌린다. body 가 끝나든 던지든(준비 실패 포함) 서버는 반드시 끈다 */
export async function withServer<T>(
  start: () => ServerProc,
  ready: () => Promise<boolean>,
  body: () => Promise<T>,
  waitMs = 60_000,
): Promise<T> {
  const proc = start()
  try {
    const deadline = Date.now() + waitMs
    let early = false
    void proc.exited.then(() => {
      early = true
    })
    for (;;) {
      if (await ready().catch(() => false)) break
      if (early) throw new Error('서버가 준비되기 전에 끝났습니다')
      const left = deadline - Date.now()
      if (left <= 0) throw new Error(`서버가 ${Math.round(waitMs / 1000)}초 안에 준비되지 않았습니다`)
      await sleep(Math.min(300, left))
    }
    return await body()
  } finally {
    await stopServer(proc)
  }
}

// ── 파일 ─────────────────────────────────────────────────────
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export interface EvalData {
  /** 분석 파일이 있는 공고만, 공고 파일 이름 순서대로 */
  ids: string[]
  /** 분석이 없어 건너뛴 공고 수 */
  skipped: number
  lookup: PostingLookup
}

/** evals/data/postings/*.json(공고 하나씩)과 <run>/analysis/<wantedAuthNo>.json 을 읽는다 */
export function loadEvalData(postingsDir: string, runDir: string): EvalData {
  const postings = new Map<string, Posting>()
  const analyses = new Map<string, PostingAnalysis>()
  const ids: string[] = []
  let skipped = 0
  for (const name of readdirSync(postingsDir).filter((n) => n.endsWith('.json')).sort()) {
    const posting = readJson<Posting>(join(postingsDir, name))
    const analysisPath = join(runDir, 'analysis', `${posting.wantedAuthNo}.json`)
    if (!existsSync(analysisPath)) {
      skipped++
      continue
    }
    postings.set(posting.wantedAuthNo, posting)
    analyses.set(posting.wantedAuthNo, readJson<PostingAnalysis>(analysisPath))
    ids.push(posting.wantedAuthNo)
  }
  return { ids, skipped, lookup: { posting: (id) => postings.get(id), analysis: (id) => analyses.get(id) } }
}

export function writeJsonl(path: string, rows: readonly unknown[]): void {
  writeFileSync(path, rows.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8')
}

export function readGoldJudgements(goldPath: string): GoldJudgementRow[] | null {
  if (!existsSync(goldPath)) return null
  return readJson<{ judgements?: GoldJudgementRow[] }>(goldPath).judgements ?? []
}

/** 검수 문장으로 대체된 질문 수(1차 + 최종) */
export function countTemplates(rows: readonly CaseRow[]): number {
  return rows.reduce(
    (n, r) => n + r.first.questions.filter((q) => q.source === 'template').length + r.final.final_questions.filter((q) => q.source === 'template').length,
    0,
  )
}
