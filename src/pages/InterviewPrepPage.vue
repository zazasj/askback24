<script setup lang="ts">
/**
 * S4 면접 역질문 준비 — 단계형(D-012).
 * 머리(지원 건 요약·준비할 면접 라디오) + 단계 표시(주소 ?step=) + 단계 본문.
 * 1차: ① 공고 확인 → ② 내 기대·걱정 → ③ 질문 받기. 최종 ②③(1차 면접 정리·최종 질문)은 M5에서 채운다.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getAnalysis, getPosting, getSignals, type PresetKey } from '@shared/catalog'
import NotFoundContent from '@/components/ui/NotFoundContent.vue'
import { useDemoStore } from '@/stores/demo'
import { useDemoToolActions, type DemoToolAction } from '@/stores/demoTools'
import { usePrepStore } from '@/stores/prep'
import CardPickStep from '@/features/interview-prep/CardPickStep.vue'
import FirstResultStep from '@/features/interview-prep/FirstResultStep.vue'
import PostingStep from '@/features/interview-prep/PostingStep.vue'
import PrepHeader from '@/features/interview-prep/PrepHeader.vue'
import StepNav from '@/features/interview-prep/StepNav.vue'
import { NEXT_FROM_POSTING, STEP_LABELS, defaultModeFor } from '@/features/interview-prep/steps'
import { usePrepRoute } from '@/features/interview-prep/usePrepRoute'

const route = useRoute()
const demo = useDemoStore()
const prep = usePrepStore()

const application = computed(() => demo.findApplication(String(route.params.applyId ?? '')))
const posting = computed(() => (application.value ? getPosting(application.value.wantedAuthNo) : undefined))
const analysis = computed(() => (posting.value ? getAnalysis(posting.value.wantedAuthNo) : undefined))
const signals = computed(() => (posting.value ? getSignals(posting.value.wantedAuthNo) : []))

const { step, mode, goStep, setMode } = usePrepRoute(() => defaultModeFor(application.value?.result ?? '-'))
const labels = computed(() => STEP_LABELS[mode.value])
const stepTitle = computed(() => labels.value[step.value - 1])
/** ③ "근거 보기"가 ①로 보낼 때 켤 카드(?card=BE15) */
const focusCard = computed(() => (typeof route.query.card === 'string' ? route.query.card : null))

// 알림은 띄우지 않는다: 아래 고정 바의 "N개 골랐어요"가 바로 바뀌고, 알림이 그 바를 가린다
function fillPreset(key: PresetKey): void {
  const app = application.value
  if (app) prep.fillPreset(app.apply_id, key)
}

const demoActions = computed<DemoToolAction[]>(() =>
  application.value && mode.value === 'first' && step.value === 2
    ? [
        { id: 'preset-a', label: '예시 구직자 A로 채우기', run: () => fillPreset('A') },
        { id: 'preset-b', label: '예시 구직자 B로 채우기', run: () => fillPreset('B') },
      ]
    : [],
)
useDemoToolActions(demoActions)
</script>

<template>
  <NotFoundContent v-if="!application || !posting" detail="이 지원 건을 찾을 수 없어요. 지원 내역에서 다시 골라 주세요." />
  <div v-else class="s4">
    <PrepHeader
      :corp-nm="posting.corpNm"
      :wanted-title="posting.wantedTitle"
      :result="application.result"
      :mode="mode"
      @update:mode="setMode"
    />

    <StepNav class="steps" :labels="labels" :current="step" />

    <PostingStep
      v-if="step === 1"
      :posting="posting"
      :analysis="analysis"
      :signals="signals"
      :next-label="NEXT_FROM_POSTING[mode]"
      :focus-card="focusCard"
      @next="goStep(2)"
    />
    <CardPickStep
      v-else-if="mode === 'first' && step === 2"
      :apply-id="application.apply_id"
      :analysis="analysis"
      @make="goStep(3)"
    />
    <FirstResultStep
      v-else-if="mode === 'first'"
      :apply-id="application.apply_id"
      :analysis="analysis"
      @change="goStep(2)"
    />
    <section v-else class="step-body" aria-labelledby="step-title">
      <h2 id="step-title" class="section-title">{{ stepTitle }}</h2>
      <p class="pending-note">이 단계 화면은 다음 작업에서 채워요.</p>
    </section>
  </div>
</template>

<style scoped>
.steps {
  margin: 3.2rem 0 2.4rem;
}

.step-body {
  display: grid;
  gap: 1.6rem;
}
</style>
