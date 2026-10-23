/**
 * S4 단계·면접 종류는 주소에 둔다(?step=1|2|3&mode=first|final).
 * 뒤로 가기·새로고침·주소로 열기가 저절로 맞고, 저장이 막힌 브라우저에서도 같은 화면이 나온다.
 * mode 가 없으면 지원결과로 정한다(1차 합격 → 최종).
 */
import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Mode } from '@shared/contract'
import { parseMode, parseStep, type StepNo } from './steps'

export function usePrepRoute(defaultMode: MaybeRefOrGetter<Mode>) {
  const route = useRoute()
  const router = useRouter()

  const step = computed<StepNo>(() => parseStep(route.query.step) ?? 1)
  const mode = computed<Mode>(() => parseMode(route.query.mode) ?? toValue(defaultMode))

  // 단계가 없거나 잘못된 주소는 ①로 맞춘다(기록은 남기지 않음)
  watch(
    () => route.query.step,
    (v) => {
      if (route.name === 'prep' && parseStep(v) === null) void router.replace({ query: { ...route.query, step: '1' } })
    },
    { immediate: true },
  )

  function goStep(n: StepNo) {
    return router.push({ query: { ...route.query, step: String(n) } })
  }

  /** 면접 종류를 바꾼다. 단계를 주지 않으면 지금 단계 번호를 그대로 둔다 */
  function setMode(m: Mode, n: StepNo = step.value) {
    return router.push({ query: { ...route.query, step: String(n), mode: m } })
  }

  return { step, mode, goStep, setMode }
}
