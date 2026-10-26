/**
 * 질문 결과를 지원 건마다 브라우저에 저장한다. 1차는 rq:v1:questions(③에서 새로고침해도 같은 질문, S4-20),
 * 최종은 rq:v1:final-questions. 만드는 중 상태는 저장하지 않는다.
 * 들은 답·면접 분위기는 저장하지 않는다(R-09): 최종 응답에는 들은 답이 없고, 정리 입력은 review 저장소(메모리)에만 있다.
 */
import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import type { FinalQuestion, FinalQuestionsResponse, FirstQuestionsResponse, Mode } from '@shared/contract'
import { fetchFinalQuestions, fetchFirstQuestions } from '@/api/client'
import { seedFirst } from '@/demoData'
import { requestKey, toFirstRequest } from '@/features/interview-prep/picks'
import { toFinalRequest } from '@/features/interview-prep/review'
import { usePersisted } from '@/lib/storage'
import { onDemoReset } from './demoTools'
import { usePrepStore } from './prep'
import { useReviewStore } from './review'

/** 만드는 중 화면을 이보다 짧게 보이지 않는다(번쩍임 방지) */
export const MIN_LOADING_MS = 1_200

// 6차 RS-01: "면접에서 쓸 것 같아요"(옛 kept 칸)를 없앴다. 그 전에 저장된 값에 kept가 남아 있어도 검사하지 않고 읽지 않는다
export interface FirstResult {
  /** 이 결과를 만든 선택의 표식(선택이 바뀌었는지 볼 때) */
  request_key: string
  response: FirstQuestionsResponse
  made_at: string
  /** 시연 시드(S1 2행)로 미리 만들어 둔 결과 */
  seed?: boolean
}

export interface FinalResult {
  response: FinalQuestionsResponse
  made_at: string
}

type ResultBook = Record<string, FirstResult>
type FinalBook = Record<string, FinalResult>

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function isFirstResult(v: unknown): v is FirstResult {
  return (
    isObject(v) &&
    typeof v.request_key === 'string' &&
    isObject(v.response) &&
    v.response.mode === 'first' &&
    Array.isArray(v.response.questions)
  )
}

function isFinalResult(v: unknown): v is FinalResult {
  return (
    isObject(v) &&
    isObject(v.response) &&
    v.response.mode === 'final' &&
    Array.isArray(v.response.final_questions) &&
    Array.isArray(v.response.card_states) &&
    isObject(v.response.summary)
  )
}

const isResultBook = (v: unknown): v is ResultBook => isObject(v) && Object.values(v).every(isFirstResult)
const isFinalBook = (v: unknown): v is FinalBook => isObject(v) && Object.values(v).every(isFinalResult)

/** 최종 질문 하나를 가리키는 키(카드 질문은 카드 ID, 처우 질문은 offer:<topic>) */
export const finalKey = (q: FinalQuestion): string => q.card_id ?? `offer:${q.topic ?? q.rank}`

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 지원 건마다 하나씩 도는 요청(늦게 끝난 옛 요청이 새 결과를 덮지 않게 번호로 가린다) */
function useRuns() {
  const pending = ref<Record<string, number>>({})
  const failed = ref<Record<string, true>>({})
  let seq = 0
  const attempts: Record<string, number> = {}

  const drop = (map: Ref<Record<string, unknown>>, key: string) => {
    if (!(key in map.value)) return
    const next = { ...map.value }
    delete next[key]
    map.value = next
  }

  /** 새 요청 번호와 "다시 만들기" 횟수(가짜 공급자가 문장을 바꾸는 데 씀) */
  function start(applyId: string): { my: number; variant: number } {
    const my = ++seq
    const variant = (attempts[applyId] = (attempts[applyId] ?? -1) + 1)
    pending.value = { ...pending.value, [applyId]: my }
    drop(failed, applyId)
    return { my, variant }
  }

  /** 이 요청이 아직 최신이면 끝내고 true */
  function settle(applyId: string, my: number): boolean {
    if (pending.value[applyId] !== my) return false
    drop(pending, applyId)
    return true
  }

  function fail(applyId: string, my: number): void {
    if (settle(applyId, my)) failed.value = { ...failed.value, [applyId]: true }
  }

  function reset(): void {
    pending.value = {}
    failed.value = {}
  }

  return { pending, failed, start, settle, fail, reset }
}

export const useQuestionsStore = defineStore('questions', () => {
  const firsts = usePersisted<ResultBook>('questions', () => ({}), isResultBook)
  const finals = usePersisted<FinalBook>('final-questions', () => ({}), isFinalBook)
  const firstRuns = useRuns()
  const finalRuns = useRuns()

  onDemoReset(() => {
    firsts.value = {}
    finals.value = {}
    firstRuns.reset()
    finalRuns.reset()
  })

  /** 저장된 결과, 없으면 시드 지원 건의 미리 만든 결과 */
  function firstOf(applyId: string): FirstResult | undefined {
    const saved = firsts.value[applyId]
    if (saved) return saved
    const seed = seedFirst(applyId)
    return seed ? { ...seed, made_at: '', seed: true } : undefined
  }

  function isGenerating(applyId: string): boolean {
    return firstRuns.pending.value[applyId] !== undefined
  }

  function hasFailed(applyId: string): boolean {
    return firstRuns.failed.value[applyId] === true
  }

  /** 지금 ② 선택으로 만든 결과인지 */
  function isCurrent(applyId: string, wantedAuthNo: string): boolean {
    const r = firstOf(applyId)
    if (!r) return false
    return r.request_key === requestKey(toFirstRequest(wantedAuthNo, usePrepStore().selectionOf(applyId)))
  }

  /** 그 면접 종류의 결과가 있는지(1차는 시드 포함). S1에서 들어올 때 ③으로 열지 정한다 */
  function hasResult(applyId: string, mode: Mode): boolean {
    return mode === 'first' ? !!firstOf(applyId) : !!finalOf(applyId)
  }

  /** 브라우저에 저장된(내가 만든) 결과가 있는지. 시드는 넣지 않는다. 들어올 때 면접 종류를 정한다(H2-04) */
  function hasSaved(applyId: string, mode: Mode): boolean {
    return mode === 'first' ? !!firsts.value[applyId] : !!finals.value[applyId]
  }

  /**
   * 최종 결과를 만든 뒤 1차 질문을 다시 만들었는지(H2-04 ④). 최종 질문은 그 전 1차 질문과 정리로 만든 것이라
   * 화면에 "이전 1차 질문 기준"이라고 알린다
   */
  function finalBehindFirst(applyId: string): boolean {
    const fin = finals.value[applyId]
    const first = firsts.value[applyId]
    return !!fin && !!first && first.made_at > fin.made_at
  }

  /**
   * ② "질문 만들기". 지금 선택으로 만든 결과가 이미 있으면 다시 만들지 않는다: 문장이 바뀌면 인쇄해 둔 것과 어긋나고
   * 실제 모드에서는 AI를 한 번 더 부른다. 다시 만들기는 "AI로 다시 만들기"(makeFirst)만 한다. 새로 만들기 시작했으면 true
   */
  function ensureFirst(applyId: string, wantedAuthNo: string, options: { apiFail?: boolean } = {}): boolean {
    if (isCurrent(applyId, wantedAuthNo)) return false
    void makeFirst(applyId, wantedAuthNo, options)
    return true
  }

  /** ② 선택으로 1차 질문을 만든다(AI로 다시 만들기, 결과가 없을 때의 질문 만들기). 끝날 때까지 isGenerating */
  async function makeFirst(applyId: string, wantedAuthNo: string, options: { apiFail?: boolean } = {}): Promise<void> {
    const req = toFirstRequest(wantedAuthNo, usePrepStore().selectionOf(applyId))
    const { my, variant } = firstRuns.start(applyId)
    try {
      const [response] = await Promise.all([fetchFirstQuestions(req, { apiFail: options.apiFail === true, variant }), sleep(MIN_LOADING_MS)])
      if (!firstRuns.settle(applyId, my)) return
      firsts.value = {
        ...firsts.value,
        [applyId]: { request_key: requestKey(req), response, made_at: new Date().toISOString() },
      }
    } catch {
      firstRuns.fail(applyId, my)
    }
  }

  // ── 최종 면접·처우 질문 ───────────────────────────────
  function finalOf(applyId: string): FinalResult | undefined {
    return finals.value[applyId]
  }

  function isGeneratingFinal(applyId: string): boolean {
    return finalRuns.pending.value[applyId] !== undefined
  }

  function hasFailedFinal(applyId: string): boolean {
    return finalRuns.failed.value[applyId] === true
  }

  /** 1차 결과 + 1차 면접 정리(메모리)로 최종 질문을 만든다. 들은 답은 요청에만 실린다 */
  async function makeFinal(applyId: string, wantedAuthNo: string, options: { apiFail?: boolean } = {}): Promise<void> {
    const first = firstOf(applyId)
    if (!first) return
    const req = toFinalRequest(wantedAuthNo, usePrepStore().cardPicks(applyId), useReviewStore().draftOf(applyId), first.response.questions)
    const { my, variant } = finalRuns.start(applyId)
    try {
      const [response] = await Promise.all([fetchFinalQuestions(req, { apiFail: options.apiFail === true, variant }), sleep(MIN_LOADING_MS)])
      if (!finalRuns.settle(applyId, my)) return
      finals.value = { ...finals.value, [applyId]: { response, made_at: new Date().toISOString() } }
    } catch {
      finalRuns.fail(applyId, my)
    }
  }

  return {
    firsts,
    finals,
    firstOf,
    isGenerating,
    hasFailed,
    isCurrent,
    hasResult,
    hasSaved,
    finalBehindFirst,
    ensureFirst,
    makeFirst,
    finalOf,
    isGeneratingFinal,
    hasFailedFinal,
    makeFinal,
  }
})
