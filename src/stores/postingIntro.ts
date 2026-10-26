/**
 * S4 ① 공고 분석 로딩(LD). 지원 건마다 처음 한 번만 보이므로 본 지원 건을 브라우저에 둔다(rq:v1:posting-intro,
 * "시연 초기화"가 지움). 로딩·형광펜 칠하기가 진행 중인지는 안내(T5)가 기다릴 수 있게 함께 둔다(TR-08).
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usePersisted } from '@/lib/storage'
import { onDemoReset } from './demoTools'

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

export const usePostingIntroStore = defineStore('postingIntro', () => {
  const seen = usePersisted<string[]>('posting-intro', () => [], isStringList)
  /** ① 로딩이 떠 있다 */
  const loading = ref(false)
  /** 로딩 뒤 ① 형광펜을 칠하는 중(첫 화면 것을 다 칠하면 끝, 스크롤해 보이는 것을 칠할 때 다시 켜짐) */
  const drawing = ref(false)
  const busy = computed(() => loading.value || drawing.value)

  onDemoReset(() => {
    seen.value = []
  })

  function hasSeen(applyId: string): boolean {
    return seen.value.includes(applyId)
  }

  function markSeen(applyId: string): void {
    if (!hasSeen(applyId)) seen.value = [...seen.value, applyId]
  }

  return { seen, loading, drawing, busy, hasSeen, markSeen }
})
