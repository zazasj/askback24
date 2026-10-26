/**
 * AI 담당 서버 공급자(LLM_PROVIDER=remote). 우리 서버(api/)가 {AI_ENDPOINT}/v1/… 세 주소를 POST 로 부른다(docs/API-SPEC.md).
 * 순서·유형·근거는 우리 규칙이 정하므로 여기서는 받은 JSON의 모양(필수 필드·타입)만 본다. 모양이 틀린 항목은 버리고,
 * shared/generate.ts 가 그 항목만 검수 문장(판정은 단순 규칙)으로 대신한다. HTTP 오류·JSON 아님·바깥 모양이 틀림은
 * 예외로 던져 전체를 대신하게 한다. 키는 api/ 에서 받아 넘긴다(화면 번들에 넣지 않음). 오류에 요청·응답 내용을 싣지 않는다.
 */
import type { Evidence, EvidenceField } from '../contract.js'
import type { Draft, FinalDraft, FinalDraftInput, FirstDraftInput, JudgeInput, Judgement, LlmProvider } from './types.js'

export interface RemoteConfig {
  /** 예: https://ai.example.com — 끝의 / 는 떼고 /v1/… 을 붙인다 */
  endpoint?: string
  key?: string
  /** 시험용. 없으면 부를 때의 전역 fetch */
  fetch?: typeof fetch
}

export const REMOTE_PATHS = {
  first: '/v1/first-questions',
  judge: '/v1/final-judgements',
  final: '/v1/final-questions',
} as const

export type RemoteErrorCode = 'not_configured' | 'http_status' | 'not_json' | 'bad_shape'

export class RemoteError extends Error {
  readonly code: RemoteErrorCode
  readonly status: number | undefined
  constructor(code: RemoteErrorCode, status?: number) {
    super(status === undefined ? code : `${code} ${status}`)
    this.name = 'RemoteError'
    this.code = code
    this.status = status
  }
}

// 타입에서 필드 하나가 늘거나 줄면 여기서 컴파일 오류가 난다
const EVIDENCE_FIELDS: Record<EvidenceField, true> = {
  jobCont: true,
  pfCond: true,
  etcPfCond: true,
  empTpNm: true,
  salTpNm: true,
  sal: true,
  workdayWorkhrCont: true,
  etcWelfare: true,
}
const JUDGE_STATES: ReadonlyArray<Judgement['state']> = ['confirmed', 'mismatch', 'still_unknown']

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** 근거 인용. 없음(키 없음·null)이면 null, 모양이 틀리면 false */
function readEvidence(v: unknown): Evidence | null | false {
  if (v === undefined || v === null) return null
  if (!isObject(v) || typeof v.field !== 'string' || !Object.hasOwn(EVIDENCE_FIELDS, v.field)) return false
  if (typeof v.quote !== 'string' || v.quote === '') return false
  return { field: v.field as EvidenceField, quote: v.quote }
}

/** 1차 문장: card_id·text 가 있고 evidence 모양이 맞는 것만. 알려진 키만 옮긴다 */
export function readDrafts(list: readonly unknown[]): Draft[] {
  return list.flatMap((v) => {
    if (!isObject(v) || !isId(v.card_id) || typeof v.text !== 'string') return []
    const evidence = readEvidence(v.evidence)
    if (evidence === false) return []
    const d: Draft = { card_id: v.card_id, text: v.text }
    if (evidence) d.evidence = evidence
    return [d]
  })
}

export function readJudgements(list: readonly unknown[]): Judgement[] {
  return list.flatMap((v) => {
    if (!isObject(v) || !isId(v.card_id) || typeof v.basis !== 'string') return []
    if (!JUDGE_STATES.includes(v.state as Judgement['state'])) return []
    return [{ card_id: v.card_id, state: v.state as Judgement['state'], basis: v.basis }]
  })
}

export function readFinalDrafts(list: readonly unknown[]): FinalDraft[] {
  return list.flatMap((v) => {
    if (!isObject(v) || !isId(v.key) || typeof v.text !== 'string') return []
    const evidence = readEvidence(v.evidence)
    if (evidence === false) return []
    const d: FinalDraft = { key: v.key, text: v.text }
    if (evidence) d.evidence = evidence
    return [d]
  })
}

async function post(config: RemoteConfig, path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const base = config.endpoint?.trim().replace(/\/+$/, '')
  if (!base) throw new RemoteError('not_configured')
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' }
  if (config.key) headers.Authorization = `Bearer ${config.key}`
  const doFetch = config.fetch ?? globalThis.fetch
  const res = await doFetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal })
  if (!res.ok) {
    // 오류 본문({ error: { code, message } })은 읽지 않는다. 우리 쪽 처리는 상태와 관계없이 같다(전체 대체)
    res.body?.cancel().catch(() => undefined)
    throw new RemoteError('http_status', res.status)
  }
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RemoteError('not_json')
  }
}

/** 바깥 모양({ "<key>": [...] })이 틀리면 전체를 대신하게 예외 */
function listOf(data: unknown, key: 'questions' | 'judgements'): unknown[] {
  if (!isObject(data)) throw new RemoteError('bad_shape')
  const list = data[key]
  if (!Array.isArray(list)) throw new RemoteError('bad_shape')
  return list
}

export function createRemoteProvider(config: RemoteConfig): LlmProvider {
  return {
    name: 'remote',
    async writeFirst(input: FirstDraftInput, signal: AbortSignal): Promise<Draft[]> {
      return readDrafts(listOf(await post(config, REMOTE_PATHS.first, input, signal), 'questions'))
    },
    async judgeReview(input: JudgeInput, signal: AbortSignal): Promise<Judgement[]> {
      return readJudgements(listOf(await post(config, REMOTE_PATHS.judge, input, signal), 'judgements'))
    },
    async writeFinal(input: FinalDraftInput, signal: AbortSignal): Promise<FinalDraft[]> {
      return readFinalDrafts(listOf(await post(config, REMOTE_PATHS.final, input, signal), 'questions'))
    },
  }
}
