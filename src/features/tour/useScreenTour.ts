/**
 * 화면이 떠 있는 동안 그 화면의 안내 단계를 올린다(TR-02). 띄울지·언제 띄울지는 TourHost 가 정한다.
 * ready 가 false 인 동안은 띄우지 않는다(③은 질문을 다 만든 뒤).
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { useTourStore, type TourKey, type TourStep } from '@/stores/tour'

export function useScreenTour(key: TourKey, steps: () => TourStep[], opts: { ready?: () => boolean; titleId?: string } = {}): void {
  const tour = useTourStore()
  let id = 0
  onMounted(() => {
    id = tour.register({ key, steps, ready: opts.ready ?? (() => true), titleId: opts.titleId })
  })
  onBeforeUnmount(() => tour.unregister(id))
}
