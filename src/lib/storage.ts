/**
 * 브라우저 저장. 시크릿 창·저장 차단 브라우저에서는 localStorage 접근 자체가 예외를 던지므로
 * 읽기·쓰기를 모두 감싸고, 실패하면 메모리에만 들고 있는다(G-13).
 */
import { ref, watch, type Ref } from 'vue'

export const STORAGE_PREFIX = 'rq:v1:'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, guard: (v: unknown) => v is T): T | undefined {
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + key)
    if (raw === null || raw === undefined) return undefined
    const value: unknown = JSON.parse(raw)
    return guard(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(STORAGE_PREFIX + key)
  } catch {
    // 저장이 막혀 있으면 지울 것도 없다
  }
}

/** rq:v1: 로 시작하는 값을 모두 지운다(시연 초기화). */
export function clearAllKeys(): void {
  try {
    const s = storage()
    if (!s) return
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    for (const k of keys) s.removeItem(k)
  } catch {
    // 위와 같음
  }
}

/** 저장값이 있으면 그 값, 없거나 모양이 다르면 initial()로 시작하고 바뀔 때마다 저장한다. */
export function usePersisted<T>(key: string, initial: () => T, guard: (v: unknown) => v is T): Ref<T> {
  const state = ref(readJson(key, guard) ?? initial()) as Ref<T>
  watch(state, (v) => writeJson(key, v), { deep: true })
  return state
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
