import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRESETS } from '@shared/catalog'
import type { FirstQuestionsRequest } from '@shared/contract'
import { generateFirst } from '@shared/generate'
import { createMockProvider } from '@shared/providers/mock'
import { API_MODE, fetchFirstQuestions, isFirstResponse } from './client'

const req: FirstQuestionsRequest = { mode: 'first', wantedAuthNo: 'K-MOCK-0001', picks: PRESETS.A.picks, experience: PRESETS.A.experience }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('실제 모드: /api/questions → 실패하면 같은 규칙의 검수 문장', () => {
  it('시험 환경은 실제 모드(VITE_API_MODE 없음)', () => {
    expect(API_MODE).toBe('real')
  })

  it('서버 응답이 형식에 맞으면 그대로 쓴다', async () => {
    const server = await generateFirst(req, { provider: createMockProvider() })
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(server), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await fetchFirstQuestions(req)
    expect(res).toEqual(server)
    expect(fetchSpy).toHaveBeenCalledWith('/api/questions', expect.objectContaining({ method: 'POST' }))
  })

  it('네트워크 오류 · 500 · 형식이 다른 응답이면 검수 문장 5개(source: template)', async () => {
    const cases = [
      () => Promise.reject(new TypeError('network')),
      async () => new Response('{"error":"internal"}', { status: 500 }),
      async () => new Response('{"questions":"oops"}', { status: 200 }),
    ]
    for (const make of cases) {
      vi.stubGlobal('fetch', vi.fn(make))
      const res = await fetchFirstQuestions(req)
      expect(res.questions.map((q) => q.card_id)).toEqual(['BE15', 'BE07', 'BE02', 'BE03', 'BE01'])
      expect(res.questions.every((q) => q.source === 'template')).toBe(true)
    }
  })

  it('응답 형식 검사', () => {
    expect(isFirstResponse({ mode: 'first', questions: [] })).toBe(true)
    expect(isFirstResponse({ mode: 'final', questions: [] })).toBe(false)
    expect(isFirstResponse({ mode: 'first', questions: [{ card_id: 'BE01', text: 'x' }] })).toBe(false)
  })
})
