/** POST /api/warmup: remote 일 때만 AI 서버를 한 번 부르고, 결과와 상관없이 204. 가짜 fetch 로만 돈다. */
import { describe, expect, it, vi } from 'vitest'
import type { Logger } from './handler.ts'
import type { ServerEnv } from './provider.ts'
import { handleWarmup } from './warmup.ts'

const ENV: ServerEnv = { LLM_PROVIDER: 'remote', AI_ENDPOINT: 'https://ai.example.test', AI_API_KEY: 'k' }
const log = (): Logger => ({ info: vi.fn(), error: vi.fn() })
const post = () => new Request('https://x.test/api/warmup', { method: 'POST' })

describe('handleWarmup', () => {
  it('remote: fetch 1번, 204', async () => {
    const f = vi.fn(async (_url: string) => new Response('{"ok":true}'))
    vi.stubGlobal('fetch', f)
    const res = await handleWarmup(post(), ENV, log())
    vi.unstubAllGlobals()
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(f).toHaveBeenCalledTimes(1)
    expect(String(f.mock.calls[0]?.[0])).toBe('https://ai.example.test/v1/warmup')
  })

  it('LLM_PROVIDER 없음: fetch 0번, 204', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const res = await handleWarmup(post(), { AI_ENDPOINT: ENV.AI_ENDPOINT }, log())
    vi.unstubAllGlobals()
    expect(res.status).toBe(204)
    expect(f).not.toHaveBeenCalled()
  })

  it('fetch 가 던져도 204', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('network'))))
    const l = log()
    const res = await handleWarmup(post(), ENV, l)
    vi.unstubAllGlobals()
    expect(res.status).toBe(204)
    expect(l.error).not.toHaveBeenCalled()
  })

  it('GET 은 405', async () => {
    const res = await handleWarmup(new Request('https://x.test/api/warmup'), ENV, log())
    expect(res.status).toBe(405)
    expect(await res.json()).toEqual({ error: 'method_not_allowed' })
  })
})
