/** A2-01: 이미 만든 질문은 "질문 만들기"로 다시 만들지 않고, S1에서 들어올 때 결과가 있으면 ③으로 연다 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { FirstQuestionsRequest } from '@shared/contract'
import { entryStep } from '@/features/interview-prep/steps'
import { MIN_LOADING_MS, useQuestionsStore } from './questions'
import { usePrepStore } from './prep'

// 화면의 질문 받기(가짜 공급자·서버)는 부르는 횟수만 세고 검수 문장으로 바로 답한다
const fetchFirst = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', async () => {
  const { buildTemplateFirst } = await import('@shared/generate')
  fetchFirst.mockImplementation(async (req: FirstQuestionsRequest) => buildTemplateFirst(req))
  return { API_MODE: 'mock', fetchFirstQuestions: fetchFirst, fetchFinalQuestions: vi.fn() }
})

const ROW1 = { apply_id: 'A-0001', wantedAuthNo: 'K-MOCK-0001', result: '서류합격' }
const ROW2 = { apply_id: 'A-0002', wantedAuthNo: 'K-MOCK-0002', result: '1차 합격' }

beforeEach(() => {
  setActivePinia(createPinia())
  fetchFirst.mockClear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('A2-01 같은 선택이면 "질문 만들기"가 다시 만들지 않는다', () => {
  it('질문을 만든 뒤 선택을 바꾸지 않고 다시 누르면 만들지 않고 같은 문장 그대로, 선택을 바꾸면 새로 만든다', async () => {
    const store = useQuestionsStore()
    const prep = usePrepStore()
    prep.fillPreset(ROW1.apply_id, 'A')

    expect(store.ensureFirst(ROW1.apply_id, ROW1.wantedAuthNo)).toBe(true)
    expect(store.isGenerating(ROW1.apply_id)).toBe(true)
    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS)
    expect(store.isGenerating(ROW1.apply_id)).toBe(false)
    const first = store.firstOf(ROW1.apply_id)
    const sentences = first?.response.questions.map((q) => q.text)
    expect(sentences).toHaveLength(5)
    expect(fetchFirst).toHaveBeenCalledTimes(1)

    // ③ 근거 보기 → ① → ② → 질문 만들기(선택 그대로)
    expect(store.ensureFirst(ROW1.apply_id, ROW1.wantedAuthNo)).toBe(false)
    expect(store.isGenerating(ROW1.apply_id)).toBe(false)
    expect(fetchFirst).toHaveBeenCalledTimes(1)
    expect(store.firstOf(ROW1.apply_id)?.made_at).toBe(first?.made_at)
    expect(store.firstOf(ROW1.apply_id)?.response.questions.map((q) => q.text)).toEqual(sentences)

    // 선택을 바꾸면 새로 만든다
    prep.togglePref(ROW1.apply_id, 'BE08', 'unsure')
    expect(store.ensureFirst(ROW1.apply_id, ROW1.wantedAuthNo)).toBe(true)
    expect(store.isGenerating(ROW1.apply_id)).toBe(true)
    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS)
    expect(fetchFirst).toHaveBeenCalledTimes(2)
  })

  it('"AI로 다시 만들기"(makeFirst)는 같은 선택이어도 늘 다시 만든다', async () => {
    const store = useQuestionsStore()
    usePrepStore().fillPreset(ROW1.apply_id, 'A')
    store.ensureFirst(ROW1.apply_id, ROW1.wantedAuthNo)
    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS)
    void store.makeFirst(ROW1.apply_id, ROW1.wantedAuthNo)
    expect(store.isGenerating(ROW1.apply_id)).toBe(true)
    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS)
    expect(fetchFirst).toHaveBeenCalledTimes(2)
  })

  it('S1 2행 시드(예시 A × (주)△△커머스)는 시드와 같은 선택이면 "질문 만들기"가 시드 결과를 그대로 보인다(S4-16)', () => {
    const store = useQuestionsStore()
    expect(store.firstOf(ROW2.apply_id)?.seed).toBe(true)
    expect(store.ensureFirst(ROW2.apply_id, ROW2.wantedAuthNo)).toBe(false)
    expect(store.isGenerating(ROW2.apply_id)).toBe(false)
    expect(fetchFirst).not.toHaveBeenCalled()
  })
})

describe('A2-01 S1에서 들어올 때 여는 단계', () => {
  it('지원결과로 정한 면접 종류의 결과가 있으면 ③, 없으면 ①', () => {
    expect(entryStep('서류합격', () => false)).toBe(1)
    expect(entryStep('서류합격', (m) => m === 'first')).toBe(3)
    expect(entryStep('1차 합격', (m) => m === 'first')).toBe(1)
    expect(entryStep('1차 합격', (m) => m === 'final')).toBe(3)
    expect(entryStep('-', () => false)).toBe(1)
  })

  it('처음 상태: 1행·3행은 결과 없음 → ①, 2행은 시드 1차 결과만 있고 최종으로 열어 ①(S1-05·S1-06·R-07)', async () => {
    const store = useQuestionsStore()
    const step = (row: { apply_id: string; result: string }) => entryStep(row.result, (m) => store.hasResult(row.apply_id, m))
    expect(step(ROW1)).toBe(1)
    expect(step({ apply_id: 'A-0003', result: '-' })).toBe(1)
    expect(store.hasResult(ROW2.apply_id, 'first')).toBe(true)
    expect(store.hasResult(ROW2.apply_id, 'final')).toBe(false)
    expect(step(ROW2)).toBe(1)

    // 1차 질문을 만들면 1행은 ③으로 연다
    usePrepStore().fillPreset(ROW1.apply_id, 'A')
    store.ensureFirst(ROW1.apply_id, ROW1.wantedAuthNo)
    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS)
    expect(step(ROW1)).toBe(3)
  })
})
