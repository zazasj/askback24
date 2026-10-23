/**
 * 질문 생성 핵심(서버 함수와 화면의 가짜 응답 모드·대체 결과가 같이 쓴다).
 * 규칙(pickTop5)으로 고른 순서 → 공급자가 문장 → 검사(validate) → 탈락·지연·오류분은 검수 문장으로 대체.
 * 경험 한 줄은 공급자에게 넘길 뿐 여기서 저장·기록하지 않는다(보고에는 개수만).
 */
import type { CardPick, FirstQuestionsRequest, FirstQuestionsResponse, Pref, Question } from './contract'
import { getAnalysis, getCard, getPosting } from './catalog'
import { pickTop5, questionTemplate, type RankedPick } from './rules'
import { checkFirstQuestion, type Issue } from './validate'
import type { Draft, DraftItem, FirstDraftInput, LlmProvider } from './providers/types'

export const EXPERIENCE_MAX = 100
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

/** 로그에 남겨도 되는 것만(문장·경험·공고 내용 없음) */
export interface GenerateReport {
  provider: string
  questions: number
  template: number
  /** 공급자 전체가 실패한 까닭 */
  failure?: 'error' | 'timeout'
  /** 검사에서 걸린 규칙(질문별) */
  issues: Issue[]
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
    template: card ? questionTemplate(card, r.type) : r.template_text,
    template_text: r.template_text,
    has_exp: r.has_exp,
  }
  if (r.evidence) item.evidence = r.evidence
  return item
}

function toQuestion(r: RankedPick, rank: number, text: string, source: Question['source'], evidence = r.evidence): Question {
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
  if (evidence) q.evidence = evidence
  return q
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
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
      const evidence = draft.evidence ?? r.evidence
      const found = checkFirstQuestion({ text, state: r.state, ...(evidence ? { evidence } : {}) }, posting)
      if (!found.length) return toQuestion(r, rank, text, 'ai', evidence)
      issues.push(...found)
    }
    return toQuestion(r, rank, r.template_text, 'template')
  })

  const elapsed_ms = Math.max(0, now() - started)
  options.onReport?.({
    provider: provider?.name ?? 'template',
    questions: questions.length,
    template: questions.filter((q) => q.source === 'template').length,
    ...(failure ? { failure } : {}),
    issues,
    elapsed_ms,
  })
  return { mode: 'first', questions, elapsed_ms }
}
