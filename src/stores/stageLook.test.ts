/** PLAN-4 T6 단계 디자인 시안: 주소 값 읽기 · 탭 저장(sessionStorage) · 저장 막힘 · 시연 초기화 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDemoToolsStore } from './demoTools'
import { LOOK_KEY, hasStageBand, hasStageColor, parseLook, readLook, useStageLookStore } from './stageLook'

const g = globalThis as { window?: unknown }

function memorySession(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    storage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  delete g.window
})

describe('parseLook', () => {
  it('a·b·c·now만 받고 대소문자·앞뒤 빈칸은 봐준다', () => {
    expect(parseLook('a')).toBe('a')
    expect(parseLook(' B ')).toBe('b')
    expect(parseLook('C')).toBe('c')
    expect(parseLook('now')).toBe('now')
    expect(parseLook(['b', 'c'])).toBe('b')
  })

  it('다른 값은 null(지금 고른 시안을 그대로 둔다)', () => {
    for (const v of ['', 'd', 'ab', '1', undefined, null, 3, {}]) expect(parseLook(v)).toBeNull()
  })

  it('A·C는 단계 색, B·C는 단계 머리띠, 지금은 둘 다 없음', () => {
    expect(['now', 'a', 'b', 'c'].map((l) => [hasStageColor(l as never), hasStageBand(l as never)])).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ])
  })
})

describe('탭 저장(sessionStorage rq:v1:look)', () => {
  it('키 이름은 rq:v1: 접두사', () => {
    expect(LOOK_KEY).toBe('rq:v1:look')
  })

  it('저장이 없으면 "지금"', () => {
    g.window = { sessionStorage: memorySession().storage }
    expect(readLook()).toBe('now')
    expect(useStageLookStore().look).toBe('now')
  })

  it('저장된 값으로 시작하고, 바꾸면 저장하고, "지금"으로 바꾸면 키를 지운다', () => {
    const s = memorySession({ [LOOK_KEY]: 'b' })
    g.window = { sessionStorage: s.storage }
    const looks = useStageLookStore()
    expect(looks.look).toBe('b')
    looks.look = 'c'
    expect(s.map.get(LOOK_KEY)).toBe('c')
    looks.look = 'now'
    expect(s.map.has(LOOK_KEY)).toBe(false)
  })

  it('저장값이 이상하면 "지금"', () => {
    g.window = { sessionStorage: memorySession({ [LOOK_KEY]: 'zz' }).storage }
    expect(readLook()).toBe('now')
  })

  it('저장이 막힌 브라우저(접근 자체가 예외)에서도 메모리 값으로 바뀐다', () => {
    g.window = {
      get sessionStorage(): Storage {
        throw new Error('SecurityError')
      },
    }
    const looks = useStageLookStore()
    expect(looks.look).toBe('now')
    looks.fromQuery('a')
    expect(looks.look).toBe('a')
  })

  it('window가 없어도(서버·시험) "지금"', () => {
    expect(readLook()).toBe('now')
  })
})

describe('주소 값과 시연 초기화', () => {
  it('?look= 값이 알맞으면 바꾸고, 아니면 그대로', () => {
    g.window = { sessionStorage: memorySession().storage }
    const looks = useStageLookStore()
    looks.fromQuery('b')
    expect(looks.look).toBe('b')
    looks.fromQuery('zzz')
    looks.fromQuery(undefined)
    expect(looks.look).toBe('b')
  })

  it('"시연 초기화"하면 "지금"으로 돌아가고 저장도 지운다', () => {
    const s = memorySession({ [LOOK_KEY]: 'c' })
    g.window = { sessionStorage: s.storage }
    const looks = useStageLookStore()
    expect(looks.look).toBe('c')
    useDemoToolsStore().resetAll()
    expect(looks.look).toBe('now')
    expect(s.map.has(LOOK_KEY)).toBe(false)
  })
})
