/** TR-03·04·05·09: 안내한 화면·안내 끄기·다시 보기·시연 초기화·시험 스위치 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDemoToolsStore } from './demoTools'
import { TEST_TOUR_OFF_KEY, testTourOff, useTourStore, type TourKey } from './tour'

const g = globalThis as { window?: unknown }

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  delete g.window
})

function onScreen(key: TourKey, ready = true) {
  const tour = useTourStore()
  const id = tour.register({ key, steps: () => [{ title: '제목', text: '설명이에요.' }], ready: () => ready })
  return { tour, id }
}

describe('띄울 안내(due)', () => {
  it('처음 들어온 화면이면 그 화면 안내', () => {
    const { tour } = onScreen('s1')
    expect(tour.due).toBe('s1')
  })

  it('한 번 안내한 화면(끝까지·건너뛰기·Esc)은 다시 띄우지 않는다(TR-03)', () => {
    const { tour } = onScreen('jobs')
    tour.markSeen('jobs')
    expect(tour.due).toBeNull()
    tour.markSeen('jobs')
    expect(tour.saved.seen).toEqual(['jobs'])
  })

  it('화면 내용이 덜 그려졌으면(③ 만드는 중) 띄우지 않는다', () => {
    const { tour } = onScreen('prep-first', false)
    expect(tour.due).toBeNull()
  })

  it('"안내 끄기"면 어느 화면에서도 저절로 띄우지 않는다(TR-05)', () => {
    const { tour } = onScreen('resume')
    tour.setOff(true)
    expect(tour.due).toBeNull()
    tour.setOff(false)
    expect(tour.due).toBe('resume')
  })

  it('다시 보기는 본 화면·끄기와 관계없이 띄우고, 띄우면 요청이 채워진다(TR-04)', () => {
    const { tour } = onScreen('s1')
    tour.markSeen('s1')
    tour.setOff(true)
    tour.requestReplay('s1')
    expect(tour.due).toBe('s1')
    tour.started('s1')
    expect(tour.replay).toBeNull()
    expect(tour.activeKey).toBe('s1')
    expect(tour.due).toBeNull()
    tour.ended()
    expect(tour.activeKey).toBeNull()
  })

  it('다른 화면으로 옮기면 앞 화면의 다시 보기 요청은 버린다', () => {
    const { tour } = onScreen('jobs')
    tour.requestReplay('jobs')
    tour.register({ key: 'resume', steps: () => [], ready: () => true })
    expect(tour.replay).toBeNull()
  })

  it('화면이 내려가면 그 화면 안내는 없다(다른 화면이 이미 올렸으면 그대로)', () => {
    const { tour, id } = onScreen('jobs')
    tour.unregister(id)
    expect(tour.screen).toBeNull()
    const second = tour.register({ key: 'job', steps: () => [], ready: () => true })
    tour.unregister(id)
    expect(tour.screen?.id).toBe(second)
  })
})

describe('"시연 초기화"(TR-03·TR-05)', () => {
  it('안내한 화면 기록과 끄기를 모두 처음으로 돌린다', () => {
    const { tour } = onScreen('s1')
    tour.markSeen('s1')
    tour.markSeen('jobs')
    tour.setOff(true)
    useDemoToolsStore().resetAll()
    expect(tour.saved).toEqual({ seen: [], off: false })
    expect(tour.due).toBe('s1')
  })
})

describe('시험 스위치 rq:test:tour-off(TR-09)', () => {
  it('"1"이면 켜짐, 다른 값·저장소 막힘이면 꺼짐', () => {
    const store = new Map<string, string>()
    g.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null } }
    expect(testTourOff()).toBe(false)
    store.set(TEST_TOUR_OFF_KEY, '1')
    expect(testTourOff()).toBe(true)
    store.set(TEST_TOUR_OFF_KEY, '0')
    expect(testTourOff()).toBe(false)
    g.window = {
      get localStorage(): Storage {
        throw new Error('막힘')
      },
    }
    expect(testTourOff()).toBe(false)
  })

  it('"시연 초기화"가 지우는 rq:v1: 앞붙임이 아니다', () => {
    expect(TEST_TOUR_OFF_KEY.startsWith('rq:v1:')).toBe(false)
  })
})
