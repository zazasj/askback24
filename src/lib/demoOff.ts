/**
 * 시연 범위 밖 컨트롤 표시(G-14). 한 가지 방식만 쓴다:
 * aria-disabled="true" + `is-demo-off`(회색 글자, base.css) + 설명 "시연 범위 밖이에요"(DemoOffTip) + 누르면 알림(G-03).
 * `disabled` 대신 aria-disabled 라 키보드 초점은 받는다(설명을 읽을 수 있게).
 */
import type { Directive } from 'vue'
import { OUT_OF_SCOPE, useToastStore } from '@/stores/toast'

export const DEMO_OFF_TIP = '시연 범위 밖이에요'
export const DEMO_OFF_TIP_ID = 'demo-off-tip'
export const DEMO_OFF_CLASS = 'is-demo-off'

type DemoOffEl = HTMLElement & { __demoOffNotice?: string; __demoOffClick?: (e: Event) => void }

function mark(el: DemoOffEl): void {
  el.setAttribute('aria-disabled', 'true')
  el.setAttribute('aria-describedby', DEMO_OFF_TIP_ID)
  // 화면이 :class 로 class 를 다시 쓰면 지워지므로 갱신 때마다 다시 단다
  el.classList.add(DEMO_OFF_CLASS)
}

/** `v-demo-off` 또는 `v-demo-off="'누르면 띄울 알림'"`(없으면 "시연 범위 밖 메뉴예요") */
export const vDemoOff: Directive<DemoOffEl, string | undefined> = {
  mounted(el, binding) {
    el.__demoOffNotice = binding.value
    el.__demoOffClick = (e: Event) => {
      // 링크·제출 단추여도 이동하지 않는다
      e.preventDefault()
      useToastStore().show(el.__demoOffNotice ?? OUT_OF_SCOPE)
    }
    el.addEventListener('click', el.__demoOffClick)
    mark(el)
  },
  updated(el, binding) {
    el.__demoOffNotice = binding.value
    mark(el)
  },
  beforeUnmount(el) {
    if (el.__demoOffClick) el.removeEventListener('click', el.__demoOffClick)
  },
}
