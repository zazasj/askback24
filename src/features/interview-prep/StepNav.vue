<script setup lang="ts">
// 단계 표시(KRDS step_indicator 모양). 현재 단계에 aria-current="step".
// id="prep-steps": 휴대폰·낮은 화면에서 단계가 바뀌면 여기로 스크롤한다(router.ts scrollBehavior)
// 지난 단계는 그 단계로 가는 링크(H1-24). 모양은 그대로 두고 밑줄은 마우스·초점에만
import { useRoute } from 'vue-router'
import type { StepNo } from './steps'

defineProps<{ labels: readonly string[]; current: StepNo }>()

const route = useRoute()

function stepTo(n: number) {
  // ?card= 는 ③ "근거 보기"가 한 번 쓰는 값이라 단계를 옮길 때 뺀다(usePrepRoute keptQuery 와 같음)
  const { card: _card, ...rest } = route.query
  return { query: { ...rest, step: String(n) } }
}
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
      <RouterLink v-if="i + 1 < current" class="step-link" :to="stepTo(i + 1)">
        <span class="no" aria-hidden="true">{{ i + 1 }}</span>
        <span class="text">
          <span class="sr-only">{{ i + 1 }}단계 </span>
          <span class="label">{{ label }}</span>
          <span class="sr-only"> (지난 단계)</span>
        </span>
      </RouterLink>
      <template v-else>
        <span class="no" aria-hidden="true">{{ i + 1 }}</span>
        <span class="text">
          <span class="sr-only">{{ i + 1 }}단계 </span>
          <span class="label">{{ label }}</span>
        </span>
      </template>
    </li>
  </ol>
</template>

<style scoped>
/* 낮은 단계 표시(N4): 모양(번호 원 + 이름 + 아래 줄)은 그대로 두고 높이만 줄인다 */
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
  gap: 0.8rem;
  min-height: 4rem;
  padding: 0.4rem 1.2rem;
  border-bottom: 3px solid var(--krds-light-color-border-gray-light);
  color: var(--krds-light-color-text-subtle);
}

/* 지난 단계 링크: 단계 칸 모양을 그대로 쓰고 글자색도 이어받는다 */
.step-link {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.step-link:hover .label,
.step-link:focus-visible .label {
  text-decoration: underline;
  text-underline-offset: 0.3rem;
}

.no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-xsmall);
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

  .step,
  .step-link {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }

  .step {
    min-height: 0;
    padding: 0.4rem 0.4rem 0.6rem;
  }

  .no {
    width: 2.4rem;
    height: 2.4rem;
  }

  .label {
    font-size: var(--krds-pc-font-size-label-xsmall);
  }
}
</style>
