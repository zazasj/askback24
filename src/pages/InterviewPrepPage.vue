<script setup lang="ts">
/**
 * S4 면접 역질문 준비 — 단계형(D-012).
 * M1: 머리(지원 건 요약·준비할 면접 라디오)와 단계 표시·주소 연동까지. 단계 본문은 M2(①②)·M3(③)·M5(최종)에서 채운다.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPosting } from '@shared/catalog'
import NotFoundContent from '@/components/ui/NotFoundContent.vue'
import { useDemoStore } from '@/stores/demo'
import PrepHeader from '@/features/interview-prep/PrepHeader.vue'
import StepNav from '@/features/interview-prep/StepNav.vue'
import { NEXT_FROM_POSTING, STEP_LABELS, defaultModeFor } from '@/features/interview-prep/steps'
import { usePrepRoute } from '@/features/interview-prep/usePrepRoute'

const route = useRoute()
const demo = useDemoStore()

const application = computed(() => demo.findApplication(String(route.params.applyId ?? '')))
const posting = computed(() => (application.value ? getPosting(application.value.wantedAuthNo) : undefined))

const { step, mode, goStep, setMode } = usePrepRoute(() => defaultModeFor(application.value?.result ?? '-'))
const labels = computed(() => STEP_LABELS[mode.value])
const stepTitle = computed(() => labels.value[step.value - 1])
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

    <section class="step-body" aria-labelledby="step-title">
      <h2 id="step-title" class="section-title">{{ stepTitle }}</h2>
      <p class="pending-note">이 단계 화면은 다음 작업에서 채워요.</p>
      <div v-if="step === 1" class="step-actions">
        <button type="button" class="btn btn-accent btn-lg" @click="goStep(2)">{{ NEXT_FROM_POSTING[mode] }}</button>
      </div>
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

.step-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .step-actions .btn {
    width: 100%;
  }
}
</style>
