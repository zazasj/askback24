<script setup lang="ts">
// 단계 표시(KRDS step_indicator 모양). 현재 단계에 aria-current="step".
// id="prep-steps": 휴대폰에서 단계가 바뀌면 여기로 스크롤한다(router.ts scrollBehavior)
import type { StepNo } from './steps'

defineProps<{ labels: readonly string[]; current: StepNo }>()
</script>

<template>
  <ol id="prep-steps" class="step-nav" aria-label="준비 단계">
    <li
      v-for="(label, i) in labels"
      :key="label"
      class="step"
      :class="{ 'is-done': i + 1 < current, 'is-active': i + 1 === current }"
      :aria-current="i + 1 === current ? 'step' : undefined"
    >
      <span class="no" aria-hidden="true">{{ i + 1 }}</span>
      <span class="text">
        <span class="sr-only">{{ i + 1 }}단계 </span>
        <span class="label">{{ label }}</span>
        <span v-if="i + 1 < current" class="sr-only"> (지난 단계)</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.step-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
  counter-reset: none;
}

.step {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 5.6rem;
  padding: 0.8rem 1.6rem;
  border-bottom: 3px solid var(--krds-light-color-border-gray-light);
  color: var(--krds-light-color-text-subtle);
}

.no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 3.2rem;
  height: 3.2rem;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
}

.label {
  font-size: var(--krds-pc-font-size-label-medium);
  font-weight: 700;
}

.step.is-done {
  border-bottom-color: var(--rq-accent-border);
  color: var(--krds-light-color-text-basic);
}

.step.is-done .no {
  border-color: var(--rq-accent-border);
  color: var(--rq-accent-strong);
}

.step.is-active {
  border-bottom-color: var(--rq-accent);
  color: var(--rq-accent-strong);
}

.step.is-active .no {
  border-color: var(--rq-accent);
  background: var(--rq-accent);
  color: var(--rq-on-accent);
}

@media (max-width: 767px) {
  .step-nav {
    gap: 0.4rem;
  }

  .step {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    min-height: 0;
    padding: 0.8rem 0.4rem;
  }

  .no {
    width: 2.6rem;
    height: 2.6rem;
    font-size: var(--krds-pc-font-size-label-xsmall);
  }

  .label {
    font-size: var(--krds-pc-font-size-label-xsmall);
  }
}
</style>
