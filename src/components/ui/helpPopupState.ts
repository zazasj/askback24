/**
 * 도움말 팝업은 화면 전체에서 한 번에 하나만 열린다(HP-03). 지금 열린 팝업의 id 하나만 둔다.
 * 안내(T5)는 helpPopupOpen 으로 팝업이 닫히기를 기다린다(TR-08).
 */
import { computed, readonly, ref } from 'vue'

const active = ref<string | null>(null)

export const activeHelp = readonly(active)
export const helpPopupOpen = computed(() => active.value !== null)

export function setActiveHelp(id: string | null): void {
  active.value = id
}

/** 그 팝업이 아직 열린 것으로 되어 있을 때만 비운다(다른 팝업이 이미 자리를 가져갔으면 그대로) */
export function releaseHelp(id: string): void {
  if (active.value === id) active.value = null
}
