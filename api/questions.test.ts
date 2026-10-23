import { describe, expect, it, vi } from 'vitest'
import { PRESETS } from '../shared/catalog'
import type { FirstQuestionsResponse } from '../shared/contract'
import { handleQuestions, type Logger } from './_lib/handler'
import { providerFor } from './_lib/provider'
import { parseQuestionsRequest } from './_lib/request'
import { POST } from './questions'

const KEY = 'sk-test-ENNOIA-0000-secret'
const EXPERIENCE = PRESETS.A.experience
const HEARD = '유지보수가 7할쯤 되고 신규는 프로젝트 들어갈 때만요'

function post(body: unknown, raw?: string): Request {
  return new Request('http://localhost/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  })
}

const firstBody = { mode: 'first', wantedAuthNo: 'K-MOCK-0001', picks: PRESETS.A.picks, experience: EXPERIENCE }
const finalBody = {
  mode: 'final',
  wantedAuthNo: 'K-MOCK-0001',
  picks: PRESETS.A.picks,
  review: {
    asked: [{ question_id: 'q2', card_id: 'BE07', heard: HEARD, clarity: 'clear' }],
    not_asked: [],
    received: [{ card_id: 'BE08' }],
    impression: { mood: 'pressured' },
  },
}

function memoryLog(): Logger & { lines: string[] } {
  const lines: string[] = []
  return { lines, info: (m) => lines.push(m), error: (m) => lines.push(m) }
}

describe('POST /api/questions', () => {
  it('mode=first + 가짜 공급자(기본) → 200, 질문 5개', async () => {
    const res = await handleQuestions(post(firstBody), {}, memoryLog())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as FirstQuestionsResponse
    expect(body.mode).toBe('first')
    expect(body.questions.map((q) => q.card_id)).toEqual(['BE15', 'BE07', 'BE02', 'BE03', 'BE01'])
    expect(body.questions.every((q) => q.source === 'ai')).toBe(true)
  })

  it('mode=final 은 자리만(501, M5에서 판정·최종 질문)', async () => {
    const res = await handleQuestions(post(finalBody), {}, memoryLog())
    expect(res.status).toBe(501)
  })

  it('LLM_PROVIDER=ennoia 인데 형식 미확인 → 검수 문장으로 200', async () => {
    const res = await handleQuestions(post(firstBody), { LLM_PROVIDER: 'ennoia', ENNOIA_API_KEY: KEY }, memoryLog())
    expect(res.status).toBe(200)
    const body = (await res.json()) as FirstQuestionsResponse
    expect(body.questions.every((q) => q.source === 'template')).toBe(true)
    expect(providerFor({ LLM_PROVIDER: 'ennoia' }).name).toBe('ennoia')
    expect(providerFor({}).name).toBe('mock')
    expect(providerFor({ LLM_PROVIDER: 'unknown' }).name).toBe('mock')
  })

  it('잘못된 요청은 400·404·413, 오류 응답에 입력값을 싣지 않는다', async () => {
    const log = memoryLog()
    const bad = await handleQuestions(post(null, '{not json'), {}, log)
    expect(bad.status).toBe(400)
    const noPicks = await handleQuestions(post({ ...firstBody, picks: [] }), {}, log)
    expect(noPicks.status).toBe(400)
    const longExp = await handleQuestions(post({ ...firstBody, experience: `${EXPERIENCE}${'가'.repeat(100)}` }), {}, log)
    expect(longExp.status).toBe(400)
    expect(await longExp.text()).not.toContain(EXPERIENCE)
    const unknown = await handleQuestions(post({ ...firstBody, wantedAuthNo: 'K-NOPE' }), {}, log)
    expect(unknown.status).toBe(404)
    const huge = await handleQuestions(post(null, 'x'.repeat(20_000)), {}, log)
    expect(huge.status).toBe(413)
    const get = await handleQuestions(new Request('http://localhost/api/questions'), {}, log)
    expect(get.status).toBe(405)
  })

  it('요청 검사: 선호·has_exp 모양이 틀리면 거절', () => {
    expect(parseQuestionsRequest({ ...firstBody, picks: [{ card_id: 'BE01', pref: 'love' }] }).ok).toBe(false)
    expect(parseQuestionsRequest({ ...firstBody, picks: [{ card_id: 'BE01', pref: 'want', has_exp: 'yes' }] }).ok).toBe(false)
    expect(parseQuestionsRequest({ ...firstBody, mode: 'second' }).ok).toBe(false)
    expect(parseQuestionsRequest({ ...finalBody, review: {} }).ok).toBe(false)
    expect(parseQuestionsRequest(finalBody).ok).toBe(true)
  })
})

describe('API-05 응답·로그에 키·경험 한 줄·들은 답이 없다', () => {
  async function run(body: unknown, env: Parameters<typeof handleQuestions>[1]) {
    const log = memoryLog()
    const res = await handleQuestions(post(body), env, log)
    return { status: res.status, text: await res.text(), logs: log.lines.join('\n') }
  }

  it('API-05 로그에는 공급자 이름과 개수만(키·경험 원문·질문 문장 없음)', async () => {
    for (const env of [{}, { LLM_PROVIDER: 'ennoia', ENNOIA_API_KEY: KEY }]) {
      const { logs } = await run(firstBody, env)
      expect(logs).toMatch(/^\[questions\] mode=first provider=(mock|ennoia) n=5 template=\d+ ms=\d+/)
      expect(logs).not.toContain(KEY)
      expect(logs).not.toContain(EXPERIENCE)
      expect(logs).not.toContain('FastAPI')
      expect(logs).not.toContain('상주')
    }
  })

  it('API-05 응답에 키가 없고, 경험 한 줄을 따로 되돌려 주는 필드가 없다', async () => {
    for (const env of [{}, { LLM_PROVIDER: 'ennoia', ENNOIA_API_KEY: KEY }]) {
      const { status, text } = await run(firstBody, env)
      expect(status).toBe(200)
      expect(text).not.toContain(KEY)
      expect(text).not.toMatch(/"experience"/)
      const body = JSON.parse(text) as Record<string, unknown>
      expect(Object.keys(body).sort()).toEqual(['elapsed_ms', 'mode', 'questions'])
    }
  })

  it('API-05 최종 요청의 들은 답은 응답·로그 어디에도 없다', async () => {
    const { text, logs } = await run(finalBody, { ENNOIA_API_KEY: KEY })
    expect(text).not.toContain(HEARD)
    expect(logs).not.toContain(HEARD)
    expect(text).not.toContain(KEY)
  })

  it('API-05 함수 진입점은 키를 process.env 에서만 읽고 console 에도 남기지 않는다', async () => {
    vi.stubEnv('LLM_PROVIDER', 'ennoia')
    vi.stubEnv('ENNOIA_API_KEY', KEY)
    const seen: string[] = []
    const capture = (...args: unknown[]) => void seen.push(args.map(String).join(' '))
    const info = vi.spyOn(console, 'info').mockImplementation(capture)
    const error = vi.spyOn(console, 'error').mockImplementation(capture)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(capture)
    try {
      const res = await POST(post(firstBody))
      const text = await res.text()
      expect(res.status).toBe(200)
      expect(text).not.toContain(KEY)
      const all = seen.join('\n')
      expect(all).toContain('provider=ennoia')
      expect(all).not.toContain(KEY)
      expect(all).not.toContain(EXPERIENCE)
    } finally {
      info.mockRestore()
      error.mockRestore()
      logSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })
})
