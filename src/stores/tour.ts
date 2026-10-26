/**
 * 처음 온 사람 안내(스포트라이트, TR). 안내한 화면과 "안내 끄기"를 브라우저에 둔다(rq:v1:tour — "시연 초기화"가 지움).
 * 화면마다 useScreenTour 가 그 화면의 단계 목록을 올리고, 앱 전체에 하나 있는 TourHost 가 띄운다.
 * 시험 전용 스위치 rq:test:tour-off = "1"이면 저절로 띄우지 않는다(TR-09). 앞붙임이 달라 "시연 초기화"가 지우지 않는다.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { usePersisted } from '@/lib/storage'
import { onDemoReset } from './demoTools'

export const TEST_TOUR_OFF_KEY = 'rq:test:tour-off'

/** 안내가 있는 화면. S1은 사이트 기능 전체를 소개하는 서비스 안내, 나머지는 그 화면 안내 */
export type TourKey = 's1' | 'jobs' | 'job' | 'resume' | 'prep-posting' | 'prep-pick' | 'prep-first' | 'prep-review' | 'prep-final'

export interface TourStep {
  title: string
  text: string
  /** 비출 대상의 data-tour 이름. 앞에서부터 그 폭에서 보이는 첫 것. 없거나 다 숨어 있으면 대상 없는 상자 */
  target?: readonly string[]
}

export interface ScreenTour {
  id: number
  key: TourKey
  steps: () => TourStep[]
  /** 화면 내용이 다 그려졌는가(③은 질문을 만든 뒤) */
  ready: () => boolean
  /** 닫은 뒤 돌려놓을 초점 자리가 없을 때 갈 화면 제목 id(없으면 본문 h1) */
  titleId?: string
}

interface TourSaved {
  seen: string[]
  off: boolean
}

const isSaved = (v: unknown): v is TourSaved =>
  typeof v === 'object' &&
  v !== null &&
  Array.isArray((v as TourSaved).seen) &&
  (v as TourSaved).seen.every((k) => typeof k === 'string') &&
  typeof (v as TourSaved).off === 'boolean'

/** 시험 스위치(TR-09). 저장소가 막혀 있으면 읽을 수 없으니 꺼진 것으로 본다 */
export function testTourOff(): boolean {
  try {
    return window.localStorage.getItem(TEST_TOUR_OFF_KEY) === '1'
  } catch {
    return false
  }
}

export const useTourStore = defineStore('tour', () => {
  const saved = usePersisted<TourSaved>('tour', () => ({ seen: [], off: false }), isSaved)
  /** 지금 화면이 올린 안내(한 번에 한 화면) */
  const screen = shallowRef<ScreenTour | null>(null)
  /** "이용 안내 다시 보기"·"안내 다시 보기": 본 화면·끄기와 관계없이 그 화면 안내를 처음부터 */
  const replay = ref<TourKey | null>(null)
  /** 지금 떠 있는 안내(없으면 null) */
  const activeKey = ref<TourKey | null>(null)
  let seq = 0

  const off = computed(() => saved.value.off)

  /** 지금 화면에서 띄워야 할 안내. 다시 보기 요청이 먼저, 그다음 끄지 않았고 아직 안 본 화면 */
  const due = computed<TourKey | null>(() => {
    const s = screen.value
    if (!s || !s.ready()) return null
    if (replay.value === s.key) return s.key
    if (saved.value.off || saved.value.seen.includes(s.key)) return null
    return s.key
  })

  onDemoReset(() => {
    saved.value = { seen: [], off: false }
    replay.value = null
  })

  function hasSeen(key: TourKey): boolean {
    return saved.value.seen.includes(key)
  }

  function markSeen(key: TourKey): void {
    if (!hasSeen(key)) saved.value = { ...saved.value, seen: [...saved.value.seen, key] }
  }

  function setOff(value: boolean): void {
    if (saved.value.off !== value) saved.value = { ...saved.value, off: value }
  }

  function register(s: Omit<ScreenTour, 'id'>): number {
    seq += 1
    screen.value = { ...s, id: seq }
    // 다른 화면으로 옮겼으면 앞 화면의 다시 보기 요청은 버린다
    if (replay.value && replay.value !== s.key) replay.value = null
    return seq
  }

  function unregister(id: number): void {
    if (screen.value?.id === id) screen.value = null
  }

  function requestReplay(key: TourKey): void {
    replay.value = key
  }

  /** 안내를 띄웠다(다시 보기 요청은 채워짐) */
  function started(key: TourKey): void {
    activeKey.value = key
    if (replay.value === key) replay.value = null
  }

  function ended(): void {
    activeKey.value = null
  }

  return { saved, screen, replay, activeKey, off, due, hasSeen, markSeen, setOff, register, unregister, requestReplay, started, ended }
})
