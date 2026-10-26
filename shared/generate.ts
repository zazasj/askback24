/**
 * 질문 생성 핵심(서버 함수와 화면의 가짜 응답 모드·대체 결과가 같이 쓴다).
 * 규칙(pickTop5)으로 고른 순서 → 공급자가 문장 → 검사(validate) → 탈락·지연·오류분은 검수 문장으로 대체.
 * 경험 한 줄은 공급자에게 넘길 뿐 여기서 저장·기록하지 않는다(보고에는 개수만).
 */
import type {
  CardPick,
  CardState,
  FinalQuestion,
  FinalQuestionsRequest,
  FinalQuestionsResponse,
  FirstQuestionsRequest,
  FirstQuestionsResponse,
  InterviewReview,
  Mood,
  NotAskedReason,
  Pref,
  Question,
} from './contract.js'
import { getAnalysis, getCard, getPosting } from './catalog.js'
import { finalPrefOf, rankFinal, ruleJudgements, summarize, type FinalRanked, type Judged } from './finalRules.js'
import { pickTop5, type RankedPick } from './rules.js'
import { checkFinalQuestion, checkFirstQuestion, hasForbiddenWord, quotesHeard, type Issue } from './validate.js'
import type { Draft, DraftItem, FinalDraft, FinalDraftItem, FirstDraftInput, JudgeItem, Judgement, LlmProvider } from './providers/types.js'

export const EXPERIENCE_MAX = 100
/** 들은 답 한 줄 */
export const HEARD_MAX = 100
/** 공급자 판정 근거 길이 한도 */
export const JUDGE_BASIS_MAX = 160
/** 서버 함수 기본값. 화면은 12초를 기다리므로 그보다 짧게 */
export const PROVIDER_TIMEOUT_MS = 9_000

export type GenerateErrorCode = 'unknown_posting'

export class GenerateError extends Error {
  readonly code: GenerateErrorCode
  constructor(code: GenerateErrorCode) {
    super(code)
    this.name = 'GenerateError'
    this.code = code
  }
}

/** 로그에 남겨도 되는 것만(문장·경험·들은 답·공고 내용 없음) */
export interface GenerateReport {
  mode: 'first' | 'final'
  provider: string
  questions: number
  template: number
  /** 최종만: 공급자 판정을 받아 쓴 카드 수 */
  judged?: number
  /** 공급자 전체가 실패한 까닭 */
  failure?: 'error' | 'timeout'
  /** 검사에서 걸린 규칙(질문별). 공급자 판정을 받지 않은 것은 judge_rejected */
  issues: Array<Issue | 'judge_rejected'>
  elapsed_ms: number
}

export interface GenerateOptions {
  /** 없으면 검수 문장만 쓴다(화면의 대체 결과) */
  provider?: LlmProvider
  timeoutMs?: number
  now?: () => number
  onReport?: (report: GenerateReport) => void
}

class TimeoutError extends Error {
  constructor() {
    super('timeout')
    this.name = 'TimeoutError'
  }
}

const PREFS: readonly Pref[] = ['want', 'avoid', 'unsure']

/** 같은 카드는 처음 것만, 모르는 값은 뺀다 */
function cleanPicks(picks: readonly CardPick[]): CardPick[] {
  const seen = new Set<string>()
  const out: CardPick[] = []
  for (const p of picks) {
    if (!getCard(p.card_id) || !PREFS.includes(p.pref) || seen.has(p.card_id)) continue
    seen.add(p.card_id)
    out.push({ card_id: p.card_id, pref: p.pref, has_exp: p.has_exp === true })
  }
  return out
}

export function cleanExperience(experience: string | undefined): string {
  return (experience ?? '').trim().slice(0, EXPERIENCE_MAX)
}

function toDraftItem(r: RankedPick, rank: number): DraftItem {
  const card = getCard(r.card_id)
  const item: DraftItem = {
    rank,
    card_id: r.card_id,
    card_label: card?.label ?? r.card_id,
    pref: r.pref,
    state: r.state,
    type: r.type,
    template: r.template,
    template_text: r.template_text,
    has_exp: r.has_exp,
  }
  if (r.evidence) item.evidence = r.evidence
  return item
}

function toQuestion(r: RankedPick, rank: number, text: string, source: Question['source']): Question {
  const q: Question = {
    rank,
    card_id: r.card_id,
    type: r.type,
    text,
    basis: r.reason,
    watch_out: r.watch_out,
    good_sign: r.good_sign,
    has_exp: r.has_exp,
    source,
  }
  if (r.evidence) q.evidence = r.evidence
  return q
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  if (ms <= 0) return Promise.reject(new TimeoutError())
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      ctrl.abort()
      reject(new TimeoutError())
    }, ms)
    run(ctrl.signal).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(timer)
        reject(e instanceof Error ? e : new Error('provider failure'))
      },
    )
  })
}

/** 1차·기술 면접 질문 5개. 공급자가 없거나 실패하면 그 질문들을 검수 문장(source: template)으로 */
export async function generateFirst(req: FirstQuestionsRequest, options: GenerateOptions = {}): Promise<FirstQuestionsResponse> {
  const now = options.now ?? (() => Date.now())
  const started = now()
  const posting = getPosting(req.wantedAuthNo)
  const analysis = getAnalysis(req.wantedAuthNo)
  if (!posting || !analysis) throw new GenerateError('unknown_posting')

  const picks = cleanPicks(req.picks)
  const experience = cleanExperience(req.experience)
  const ranked = pickTop5({ picks, experience }, analysis)
  const items = ranked.map((r, i) => toDraftItem(r, i + 1))

  let drafts: Draft[] | null = null
  let failure: GenerateReport['failure']
  const provider = options.provider
  if (provider && items.length) {
    const input: FirstDraftInput = {
      mode: 'first',
      posting,
      experience: items.some((i) => i.has_exp) ? experience : '',
      items,
    }
    try {
      drafts = await withTimeout((signal) => provider.writeFirst(input, signal), options.timeoutMs ?? PROVIDER_TIMEOUT_MS)
    } catch (e) {
      failure = e instanceof TimeoutError ? 'timeout' : 'error'
    }
  }

  const issues: Issue[] = []
  const questions = ranked.map((r, i) => {
    const rank = i + 1
    const draft = Array.isArray(drafts) ? drafts.find((d) => d && d.card_id === r.card_id) : undefined
    if (draft && typeof draft.text === 'string') {
      const text = draft.text.replace(/\s+/g, ' ').trim()
      // 근거는 늘 우리 규칙의 것(API-SPEC 18행). AI가 준 evidence는 읽지 않는다 — 다르면 "근거 보기"·basis·"공고에 없음"이 어긋남(A3-r1-03)
      const found = checkFirstQuestion({ text, state: r.state, ...(r.evidence ? { evidence: r.evidence } : {}) }, posting)
      if (!found.length) return toQuestion(r, rank, text, 'ai')
      issues.push(...found)
    }
    return toQuestion(r, rank, r.template_text, 'template')
  })

  const elapsed_ms = Math.max(0, now() - started)
  options.onReport?.({
    mode: 'first',
    provider: provider?.name ?? 'template',
    questions: questions.length,
    template: questions.filter((q) => q.source === 'template').length,
    ...(failure ? { failure } : {}),
    issues,
    elapsed_ms,
  })
  return { mode: 'first', questions, elapsed_ms }
}

/** 공급자 없이 검수 문장으로만 만든 1차 결과(바로 돌려준다). 시연 시드·화면 대체 결과에 쓴다 */
export function buildTemplateFirst(req: FirstQuestionsRequest): FirstQuestionsResponse {
  const analysis = getAnalysis(req.wantedAuthNo)
  if (!getPosting(req.wantedAuthNo) || !analysis) throw new GenerateError('unknown_posting')
  const ranked = pickTop5({ picks: cleanPicks(req.picks), experience: cleanExperience(req.experience) }, analysis)
  return { mode: 'first', questions: ranked.map((r, i) => toQuestion(r, i + 1, r.template_text, 'template')), elapsed_ms: 0 }
}

// ── 최종 면접·처우 질문 ─────────────────────────────────────────
const REASONS: readonly NotAskedReason[] = ['no_time', 'bad_mood', 'forgot', 'no_chance', 'explained']
const MOODS: readonly Mood[] = ['relaxed', 'normal', 'pressured']

export function cleanHeard(heard: string | undefined): string {
  return (heard ?? '').replace(/\s+/g, ' ').trim().slice(0, HEARD_MAX)
}

/** 모르는 카드·값은 빼고, 같은 카드는 처음 것만 */
function cleanReview(review: InterviewReview): InterviewReview {
  const seen = new Set<string>()
  const fresh = (id: unknown): id is string => typeof id === 'string' && !!getCard(id) && !seen.has(id) && !!seen.add(id)
  const out: InterviewReview = { asked: [], not_asked: [], received: [], impression: { mood: 'normal' } }
  for (const a of review.asked ?? []) {
    if (!fresh(a.card_id)) continue
    const item: InterviewReview['asked'][number] = { question_id: String(a.question_id), card_id: a.card_id, heard: cleanHeard(a.heard) }
    if (a.clarity === 'clear' || a.clarity === 'vague') item.clarity = a.clarity
    out.asked.push(item)
  }
  for (const n of review.not_asked ?? []) {
    if (!fresh(n.card_id)) continue
    const item: InterviewReview['not_asked'][number] = { question_id: String(n.question_id), card_id: n.card_id }
    if (n.reason && REASONS.includes(n.reason)) item.reason = n.reason
    out.not_asked.push(item)
  }
  // 회사가 물어본 업무는 내 질문 카드와 겹쳐도 받아 두고, 판정에서 내 질문 쪽을 따른다
  const received = new Set<string>()
  for (const r of review.received ?? []) {
    if (typeof r.card_id === 'string' && getCard(r.card_id) && !received.has(r.card_id)) {
      received.add(r.card_id)
      out.received.push({ card_id: r.card_id })
    }
  }
  if (MOODS.includes(review.impression?.mood)) out.impression.mood = review.impression.mood
  return out
}

/** 공급자 판정을 받아 쓴다: 물어봤고 들은 답이 있는 카드만, 근거가 있고 들은 답을 옮기지 않은 것만 */
function mergeJudgements(
  base: Judged[],
  got: unknown,
  asked: ReadonlySet<string>,
  heard: readonly string[],
  issues: GenerateReport['issues'],
): { judged: Judged[]; accepted: number } {
  if (!Array.isArray(got)) return { judged: base, accepted: 0 }
  const STATES: ReadonlyArray<Judgement['state']> = ['confirmed', 'mismatch', 'still_unknown']
  let accepted = 0
  const judged = base.map((j) => {
    if (!asked.has(j.card_id)) return j
    const g = (got as Array<Partial<Judgement> | null>).find((x) => x && x.card_id === j.card_id)
    if (!g) return j
    const basis = typeof g.basis === 'string' ? g.basis.replace(/\s+/g, ' ').trim() : ''
    const ok =
      STATES.includes(g.state as Judgement['state']) &&
      basis !== '' &&
      basis.length <= JUDGE_BASIS_MAX &&
      !quotesHeard(basis, heard) &&
      !hasForbiddenWord(basis)
    if (!ok) {
      issues.push('judge_rejected')
      return j
    }
    accepted++
    return { ...j, state: g.state as Judgement['state'], basis, source: 'ai' as const }
  })
  return { judged, accepted }
}

function toFinalDraftItem(r: FinalRanked): FinalDraftItem {
  const item: FinalDraftItem = {
    rank: r.rank,
    key: r.key,
    label: r.label,
    type: r.type,
    origin: r.origin,
    tone: r.tone,
    cushion: r.cushion,
    template: r.template,
    template_text: r.template_text,
  }
  if (r.card_id) item.card_id = r.card_id
  if (r.topic) item.topic = r.topic
  if (r.posting_state) item.state = r.posting_state
  if (r.review_state) item.review_state = r.review_state
  if (r.evidence) item.evidence = r.evidence
  return item
}

function toFinalQuestion(r: FinalRanked, text: string, source: FinalQuestion['source']): FinalQuestion {
  const q: FinalQuestion = {
    rank: r.rank,
    type: r.type,
    priority: r.priority,
    text,
    basis: r.basis,
    watch_out: r.watch_out,
    good_sign: r.good_sign,
    source,
  }
  if (r.card_id) q.card_id = r.card_id
  if (r.topic) q.topic = r.topic
  if (r.evidence) q.evidence = r.evidence
  return q
}

/**
 * 최종 면접·처우 질문. 단순 규칙 판정 → 공급자 판정(물어본 카드만) → 순서 규칙(finalRules) → 공급자 문장 → 검사.
 * 판정·문장 두 호출은 시간 한도 하나를 나눠 쓴다. 공급자가 없거나 실패하면 단순 규칙 판정과 검수 문장.
 * 들은 답은 판정 공급자에게만 넘기고 응답·보고에 싣지 않는다.
 */
export async function generateFinal(req: FinalQuestionsRequest, options: GenerateOptions = {}): Promise<FinalQuestionsResponse> {
  const now = options.now ?? (() => Date.now())
  const started = now()
  const posting = getPosting(req.wantedAuthNo)
  const analysis = getAnalysis(req.wantedAuthNo)
  if (!posting || !analysis) throw new GenerateError('unknown_posting')

  const picks = cleanPicks(req.picks ?? [])
  const review = cleanReview(req.review)
  const heard = review.asked.map((a) => a.heard).filter((h) => h !== '')
  const deadline = started + (options.timeoutMs ?? PROVIDER_TIMEOUT_MS)
  const left = () => deadline - now()
  const provider = options.provider
  const issues: GenerateReport['issues'] = []
  let failure: GenerateReport['failure']

  // 1) 판정
  let judged = ruleJudgements(review, picks)
  let accepted = 0
  const judgeItems: JudgeItem[] = review.asked.flatMap((a) => {
    const card = getCard(a.card_id)
    const j = judged.find((x) => x.card_id === a.card_id && x.origin === 'asked')
    if (!card || !j || a.heard === '') return []
    const pref = finalPrefOf(picks, a.card_id)
    const item: JudgeItem = {
      card_id: card.id,
      card_label: card.label,
      pref,
      heard: a.heard,
      watch_out: pref === 'want' ? card.interpretation.mismatch_if_want : card.interpretation.mismatch_if_avoid,
      good_sign: card.interpretation.good_if,
    }
    if (a.clarity) item.clarity = a.clarity
    return [item]
  })
  if (provider?.judgeReview && judgeItems.length) {
    const judge = provider.judgeReview.bind(provider)
    try {
      const got = await withTimeout((signal) => judge({ mode: 'final', posting, items: judgeItems }, signal), left())
      ;({ judged, accepted } = mergeJudgements(judged, got, new Set(judgeItems.map((i) => i.card_id)), heard, issues))
    } catch (e) {
      failure = e instanceof TimeoutError ? 'timeout' : (failure ?? 'error')
    }
  }

  // 2) 순서·표현 단계
  const ranked = rankFinal({ picks, judged, mood: review.impression.mood, analysis })

  // 3) 문장
  let drafts: FinalDraft[] | null = null
  if (provider?.writeFinal && ranked.length && failure !== 'timeout') {
    const write = provider.writeFinal.bind(provider)
    try {
      drafts = await withTimeout((signal) => write({ mode: 'final', posting, items: ranked.map(toFinalDraftItem) }, signal), left())
    } catch (e) {
      failure = e instanceof TimeoutError ? 'timeout' : (failure ?? 'error')
    }
  }

  // 4) 검사: 걸린 질문만 검수 문장으로
  const final_questions = ranked.map((r) => {
    const draft = Array.isArray(drafts) ? drafts.find((d) => d && d.key === r.key) : undefined
    if (draft && typeof draft.text === 'string') {
      const text = draft.text.replace(/\s+/g, ' ').trim()
      // 1차와 같이 근거는 우리 규칙의 것만(A3-r1-03)
      const check: Parameters<typeof checkFinalQuestion>[0] = { text }
      if (r.posting_state) check.state = r.posting_state
      if (r.evidence) check.evidence = r.evidence
      const found = checkFinalQuestion(check, posting, heard)
      if (!found.length) return toFinalQuestion(r, text, 'ai')
      issues.push(...found)
    }
    return toFinalQuestion(r, r.template_text, 'template')
  })

  const carried = new Set(ranked.map((r) => r.card_id).filter((id): id is string => !!id))
  const card_states: CardState[] = judged.map((j) => ({
    card_id: j.card_id,
    state: j.state,
    basis: j.basis,
    source: j.source,
    carry: carried.has(j.card_id),
  }))

  const elapsed_ms = Math.max(0, now() - started)
  options.onReport?.({
    mode: 'final',
    provider: provider?.name ?? 'template',
    questions: final_questions.length,
    template: final_questions.filter((q) => q.source === 'template').length,
    judged: accepted,
    ...(failure ? { failure } : {}),
    issues,
    elapsed_ms,
  })
  return { mode: 'final', card_states, final_questions, summary: summarize(judged), elapsed_ms }
}
