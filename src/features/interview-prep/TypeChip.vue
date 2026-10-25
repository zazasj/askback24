<script setup lang="ts">
/**
 * 질문 유형 칩(1차 ③·최종 ③·1차 면접 정리 공용). 색만이 아니라 글자로도 유형을 말한다(DESIGN-REVIEW D7).
 * 정리 화면(②)도 ③과 같은 색을 써서 같은 질문이 같은 모양으로 보인다(H2-21 ②)
 */
import type { ChipTone } from './questionView'

defineProps<{ label: string; tone: ChipTone }>()
</script>

<template>
  <span class="type-chip" :class="`is-${tone}`">{{ label }}</span>
</template>

<style scoped>
.type-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-gray-subtle);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  white-space: nowrap;
  color: var(--krds-light-color-text-basic);
}

/* 차이 확인은 오류가 아니라 확인할 차이라 빨강 대신 주황(DR-r2-02) */
.type-chip.is-conflict {
  background: var(--rq-tone-orange-subtle);
  color: var(--rq-tone-orange);
}

.type-chip.is-opportunity {
  background: var(--krds-light-color-surface-success-subtler);
  color: var(--krds-light-color-text-success);
}

.type-chip.is-depth {
  background: var(--krds-light-color-surface-information-subtler);
  color: var(--krds-light-color-text-information);
}

.type-chip.is-warning {
  background: var(--krds-light-color-surface-warning-subtler);
  color: var(--krds-light-color-text-warning);
}

.type-chip.is-offer {
  background: var(--rq-accent-subtle);
  color: var(--rq-accent-strong);
}
</style>
