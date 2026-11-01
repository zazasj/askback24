/**
 * 단계 디자인 시안(PLAN-4 T6). 1차와 최종 단계가 한눈에 다르게 보이도록 만든 시안 A·B·C를 시연 도구와 주소(?look=a|b|c)로 바꿔 본다.
 * 기본은 "지금"(바꾸지 않음). 고른 값은 이 탭에만 둔다(sessionStorage rq:v1:look). "시연 초기화"하면 "지금"으로 돌아간다.
 * 세진이 하나를 고르면 그것을 기본으로 하고 이 스위치는 지운다(11-02).
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { STORAGE_PREFIX } from '@/lib/storage'
import { onDemoReset } from './demoTools'

export const STAGE_LOOKS = ['now', 'a', 'b', 'c'] as const
export type StageLook = (typeof STAGE_LOOKS)[number]

export const LOOK_KEY = `${STORAGE_PREFIX}look`

/** 시연 도구 「단계 디자인 시안: 지금 · A · B · C」 */
export const LOOK_LABELS: Record<StageLook, string> = { now: '지금', a: 'A', b: 'B', c: 'C' }

/** 시안 A·C: 최종 단계에서만 강조색을 바꾼다 */
export const hasStageColor = (look: StageLook): boolean => look === 'a' || look === 'c'
/** 시안 B·C: 단계 표시줄 위 단계 머리띠 */
export const hasStageBand = (look: StageLook): boolean => look === 'b' || look === 'c'

export function parseLook(v: unknown): StageLook | null {
  const s = Array.isArray(v) ? v[0] : v
  if (typeof s !== 'string') return null
  const key = s.trim().toLowerCase()
  return (STAGE_LOOKS as readonly string[]).includes(key) ? (key as StageLook) : null
}

function session(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function readLook(): StageLook {
  try {
    return parseLook(session()?.getItem(LOOK_KEY)) ?? 'now'
  } catch {
    return 'now'
  }
}

/** "지금"은 저장하지 않는다(키를 지움) */
export function writeLook(look: StageLook): void {
  try {
    const s = session()
    if (!s) return
    if (look === 'now') s.removeItem(LOOK_KEY)
    else s.setItem(LOOK_KEY, look)
  } catch {
    // 저장이 막혀도 이 화면에서는 메모리 값으로 바뀐다
  }
}

export const useStageLookStore = defineStore('stageLook', () => {
  const look = ref<StageLook>(readLook())
  watch(look, writeLook, { flush: 'sync' })

  onDemoReset(() => {
    look.value = 'now'
  })

  /** 주소 ?look= 값. 알맞지 않은 값은 무시하고 지금 고른 시안을 그대로 둔다 */
  function fromQuery(v: unknown): void {
    const l = parseLook(v)
    if (l) look.value = l
  }

  return { look, fromQuery }
})
