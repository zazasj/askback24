/**
 * 질문 결과를 지원 건마다 브라우저에 저장한다(rq:v1:questions). ③에서 새로고침해도 같은 질문(S4-20).
 * 만드는 중 상태는 저장하지 않는다. 들은 답·면접 분위기(M5)는 여기에 넣지 않는다(R-09).
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FirstQuestionsResponse } from '@shared/contract'
import { fetchFirstQuestions } from '@/api/client'
import { requestKey, toFirstRequest } from '@/features/interview-prep/picks'
import { usePersisted } from '@/lib/storage'
import { onDemoReset } from './demoTools'
import { usePrepStore } from './prep'

/** 만드는 중 화면을 이보다 짧게 보이지 않는다(번쩍임 방지) */
export const MIN_LOADING_MS = 1_200

export interface FirstResult {
  /** 이 결과를 만든 선택의 표식(선택이 바뀌었는지 볼 때) */
  request_key: string
  response: FirstQuestionsResponse
  /** "면접에서 쓸 것 같아요"를 누른 카드 */
  kept: string[]
  made_at: string
}

type ResultBook = Record<string, FirstResult>

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function isFirstResult(v: unknown): v is FirstResult {
  return (
    isObject(v) &&
    typeof v.request_key === 'string' &&
    isObject(v.response) &&
    v.response.mode === 'first' &&
    Array.isArray(v.response.questions) &&
    Array.isArray(v.kept) &&
    v.kept.every((k) => typeof k === 'string')
  )
}

const isResultBook = (v: unknown): v is ResultBook => isObject(v) && Object.values(v).every(isFirstResult)

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const useQuestionsStore = defineStore('questions', () => {
  const firsts = usePersisted<ResultBook>('questions', () => ({}), isResultBook)
  /** 지원 건 → 진행 중인 요청 번호(늦게 끝난 옛 요청이 새 결과를 덮지 않게) */
  const pending = ref<Record<string, number>>({})
  const failed = ref<Record<string, true>>({})
  let seq = 0
  const attempts: Record<string, number> = {}

  onDemoReset(() => {
    firsts.value = {}
    pending.value = {}
    failed.value = {}
  })

  function firstOf(applyId: string): FirstResult | undefined {
    return firsts.value[applyId]
  }

  function isGenerating(applyId: string): boolean {
    return pending.value[applyId] !== undefined
  }

  function hasFailed(applyId: string): boolean {
    return failed.value[applyId] === true
  }

  /** 지금 ② 선택으로 만든 결과인지 */
  function isCurrent(applyId: string, wantedAuthNo: string): boolean {
    const r = firstOf(applyId)
    if (!r) return false
    return r.request_key === requestKey(toFirstRequest(wantedAuthNo, usePrepStore().selectionOf(applyId)))
  }

  function settle(applyId: string, my: number): boolean {
    if (pending.value[applyId] !== my) return false
    const next = { ...pending.value }
    delete next[applyId]
    pending.value = next
    return true
  }

  /** ② 선택으로 1차 질문을 만든다(질문 만들기·AI로 다시 만들기). 끝날 때까지 isGenerating */
  async function makeFirst(applyId: string, wantedAuthNo: string, options: { apiFail?: boolean } = {}): Promise<void> {
    const req = toFirstRequest(wantedAuthNo, usePrepStore().selectionOf(applyId))
    const my = ++seq
    const variant = (attempts[applyId] = (attempts[applyId] ?? -1) + 1)
    pending.value = { ...pending.value, [applyId]: my }
    if (failed.value[applyId]) {
      const next = { ...failed.value }
      delete next[applyId]
      failed.value = next
    }
    try {
      const [response] = await Promise.all([fetchFirstQuestions(req, { apiFail: options.apiFail === true, variant }), sleep(MIN_LOADING_MS)])
      if (!settle(applyId, my)) return
      const before = firstOf(applyId)?.kept ?? []
      firsts.value = {
        ...firsts.value,
        [applyId]: {
          request_key: requestKey(req),
          response,
          kept: before.filter((id) => response.questions.some((q) => q.card_id === id)),
          made_at: new Date().toISOString(),
        },
      }
    } catch {
      if (settle(applyId, my)) failed.value = { ...failed.value, [applyId]: true }
    }
  }

  function toggleKept(applyId: string, cardId: string): void {
    const r = firstOf(applyId)
    if (!r) return
    const kept = r.kept.includes(cardId) ? r.kept.filter((k) => k !== cardId) : [...r.kept, cardId]
    firsts.value = { ...firsts.value, [applyId]: { ...r, kept } }
  }

  return { firsts, firstOf, isGenerating, hasFailed, isCurrent, makeFirst, toggleKept }
})
