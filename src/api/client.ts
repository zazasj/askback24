/**
 * 질문 받기. 가짜 응답 모드(VITE_API_MODE=mock)는 서버를 부르지 않고 브라우저에서 shared/generate + 가짜 공급자를 돈다.
 * 실제 모드는 POST /api/questions, 12초 시간 초과·오류·형식 이상이면 같은 규칙의 검수 문장으로 대체한다.
 */
import type {
  CardState,
  FinalQuestion,
  FinalQuestionsRequest,
  FinalQuestionsResponse,
  FirstQuestionsRequest,
  FirstQuestionsResponse,
  Question,
  QuestionsRequest,
} from '@shared/contract'
import { generateFinal, generateFirst } from '@shared/generate'
import { createMockProvider } from '@shared/providers/mock'

export const API_MODE: 'mock' | 'real' = import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'real'
export const MOCK_DELAY_MS = 1_500
export const CLIENT_TIMEOUT_MS = 12_000

export interface FetchOptions {
  /** 시험 장치 ?apiFail=1 (가짜 응답 모드에서만) */
  apiFail?: boolean
  /** "AI로 다시 만들기" 횟수. 가짜 공급자가 문장을 바꾸는 데 쓴다 */
  variant?: number
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function isQuestion(v: unknown): v is Question {
  return (
    isObject(v) &&
    typeof v.card_id === 'string' &&
    typeof v.text === 'string' &&
    typeof v.type === 'string' &&
    typeof v.watch_out === 'string' &&
    typeof v.good_sign === 'string' &&
    (v.source === 'ai' || v.source === 'template')
  )
}

export function isFirstResponse(v: unknown): v is FirstQuestionsResponse {
  return isObject(v) && v.mode === 'first' && Array.isArray(v.questions) && v.questions.every(isQuestion)
}

const REVIEW_STATES = ['confirmed', 'mismatch', 'still_unknown', 'company_signal']

function isCardState(v: unknown): v is CardState {
  return isObject(v) && typeof v.card_id === 'string' && REVIEW_STATES.includes(v.state as string) && typeof v.basis === 'string' && v.basis !== ''
}

function isFinalQuestion(v: unknown): v is FinalQuestion {
  return (
    isObject(v) &&
    (typeof v.card_id === 'string' || typeof v.topic === 'string') &&
    typeof v.text === 'string' &&
    typeof v.type === 'string' &&
    typeof v.basis === 'string' &&
    typeof v.watch_out === 'string' &&
    typeof v.good_sign === 'string' &&
    (v.source === 'ai' || v.source === 'template')
  )
}

export function isFinalResponse(v: unknown): v is FinalQuestionsResponse {
  return (
    isObject(v) &&
    v.mode === 'final' &&
    Array.isArray(v.card_states) &&
    v.card_states.every(isCardState) &&
    Array.isArray(v.final_questions) &&
    v.final_questions.every(isFinalQuestion) &&
    isObject(v.summary) &&
    REVIEW_STATES.every((k) => typeof (v.summary as Record<string, unknown>)[k] === 'number')
  )
}

async function postQuestions(req: QuestionsRequest): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS)
  try {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchFirstQuestions(req: FirstQuestionsRequest, options: FetchOptions = {}): Promise<FirstQuestionsResponse> {
  if (API_MODE === 'mock') {
    const provider = createMockProvider({ delayMs: MOCK_DELAY_MS, variant: options.variant ?? 0, fail: options.apiFail === true })
    return generateFirst(req, { provider, timeoutMs: CLIENT_TIMEOUT_MS })
  }
  try {
    const body = await postQuestions(req)
    if (isFirstResponse(body)) return body
    throw new Error('unexpected response')
  } catch {
    // 서버가 늦거나 실패해도 화면은 같은 규칙의 검수 문장을 바로 보여 준다
    return generateFirst(req)
  }
}

/** 최종 면접·처우 질문. 들은 답은 이 요청에만 싣고 화면 저장소에는 넣지 않는다(R-09) */
export async function fetchFinalQuestions(req: FinalQuestionsRequest, options: FetchOptions = {}): Promise<FinalQuestionsResponse> {
  if (API_MODE === 'mock') {
    const provider = createMockProvider({ delayMs: MOCK_DELAY_MS, variant: options.variant ?? 0, fail: options.apiFail === true })
    return generateFinal(req, { provider, timeoutMs: CLIENT_TIMEOUT_MS })
  }
  try {
    const body = await postQuestions(req)
    if (isFinalResponse(body)) return body
    throw new Error('unexpected response')
  } catch {
    // 서버가 늦거나 실패하면 단순 규칙 판정과 검수 문장으로 바로 보여 준다
    return generateFinal(req)
  }
}
