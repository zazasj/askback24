/** 알림(토스트). 화면에 하나만 띄우고 role=status 영역이 읽어 준다. */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const OUT_OF_SCOPE = '시연 범위 밖 메뉴예요'

export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  /** 같은 문구를 다시 띄워도 화면낭독기가 읽도록 바뀌는 값 */
  const seq = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(text: string, ms = 3200): void {
    message.value = text
    seq.value++
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      message.value = ''
    }, ms)
  }

  function outOfScope(): void {
    show(OUT_OF_SCOPE)
  }

  return { message, seq, show, outOfScope }
})
