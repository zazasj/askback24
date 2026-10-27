import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function load(mode: 'mock' | 'real') {
  vi.resetModules()
  vi.doMock('./client', () => ({ API_MODE: mode }))
  return (await import('./warmup')).warmUpOnce
}

function fakeStorage(throwOnSet = false) {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (throwOnSet) throw new Error('blocked')
      m.set(k, v)
    },
  }
}

let fetchSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchSpy)
  vi.stubGlobal('sessionStorage', fakeStorage())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('./client')
})

describe('warmUpOnce', () => {
  it('real: 두 번 불러도 fetch 1번', async () => {
    const warmUpOnce = await load('real')
    warmUpOnce()
    warmUpOnce()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/api/warmup', { method: 'POST', keepalive: true })
  })

  it('같은 탭(sessionStorage 에 표시)이면 모듈을 다시 읽어도 부르지 않는다', async () => {
    ;(await load('real'))()
    ;(await load('real'))()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('rq:v1:warmup')).toBe('1')
  })

  it('mock: fetch 0번', async () => {
    ;(await load('mock'))()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sessionStorage.setItem 이 던져도 예외 없이 fetch 1번(모듈 변수로 한 번만)', async () => {
    vi.stubGlobal('sessionStorage', fakeStorage(true))
    const warmUpOnce = await load('real')
    expect(() => warmUpOnce()).not.toThrow()
    warmUpOnce()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fetch 가 거부돼도 예외 없음', async () => {
    fetchSpy.mockImplementation(() => Promise.reject(new TypeError('network')))
    const warmUpOnce = await load('real')
    expect(() => warmUpOnce()).not.toThrow()
    await Promise.resolve()
  })
})
