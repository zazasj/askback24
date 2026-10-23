/**
 * 시연 도구 상자. 공통 버튼(시연 초기화·안내 다시 보기)은 DemoTools.vue 가 갖고,
 * 화면별 버튼(S4 ② "예시 구직자 A로 채우기" 등)은 그 화면이 useDemoToolActions 로 올린다.
 */
import { defineStore } from 'pinia'
import { onBeforeUnmount, onMounted, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { clearAllKeys } from '@/lib/storage'
import { useDemoStore } from './demo'

export interface DemoToolAction {
  id: string
  label: string
  run: () => void
}

const resetHandlers = new Set<() => void>()

/** 다른 저장소(prep 등)가 시연 초기화에 끼어들 때 쓴다. 반환값으로 해제 */
export function onDemoReset(handler: () => void): () => void {
  resetHandlers.add(handler)
  return () => resetHandlers.delete(handler)
}

export const useDemoToolsStore = defineStore('demoTools', () => {
  const pageActions = shallowRef<DemoToolAction[]>([])
  const open = ref(false)

  function setPageActions(actions: DemoToolAction[]): void {
    pageActions.value = actions
  }

  function clearPageActions(actions: DemoToolAction[]): void {
    if (pageActions.value === actions) pageActions.value = []
  }

  /** 지원 내역·선택·결과·안내 띠를 모두 처음으로(G-12) */
  function resetAll(): void {
    clearAllKeys()
    useDemoStore().reset()
    for (const h of resetHandlers) h()
  }

  return { pageActions, open, setPageActions, clearPageActions, resetAll }
})

/** 화면이 떠 있는 동안만 시연 도구에 버튼을 더한다. */
export function useDemoToolActions(actions: MaybeRefOrGetter<DemoToolAction[]>): void {
  const store = useDemoToolsStore()
  let current: DemoToolAction[] = []
  const apply = () => {
    store.clearPageActions(current)
    current = [...toValue(actions)]
    store.setPageActions(current)
  }
  onMounted(apply)
  watch(() => toValue(actions), apply)
  onBeforeUnmount(() => store.clearPageActions(current))
}
