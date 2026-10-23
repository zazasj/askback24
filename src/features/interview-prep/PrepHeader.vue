<script setup lang="ts">
/** S4 머리: 제목 + AI 라벨, 지원 건 요약, "준비할 면접" 라디오(흐름을 고른다). */
import type { Mode } from '@shared/contract'
import AiLabel from '@/components/ui/AiLabel.vue'
import { MODE_LABELS } from './steps'

defineProps<{ corpNm: string; wantedTitle: string; result: string; mode: Mode }>()
const emit = defineEmits<{ 'update:mode': [mode: Mode] }>()

const MODES: readonly Mode[] = ['first', 'final']
</script>

<template>
  <div class="prep-head">
    <h1 class="page-title">면접 역질문 준비 <AiLabel /></h1>
    <div class="summary">
      <p class="target">
        <strong class="corp">{{ corpNm }}</strong>
        <span class="sep" aria-hidden="true">·</span>
        <span class="title">{{ wantedTitle }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="result">지원결과 <b>{{ result }}</b></span>
      </p>
      <fieldset class="mode">
        <legend class="mode-legend">준비할 면접</legend>
        <div class="mode-options">
          <label v-for="m in MODES" :key="m" class="mode-option">
            <input
              type="radio"
              name="prep-mode"
              class="sr-only"
              :value="m"
              :checked="mode === m"
              @change="emit('update:mode', m)"
            />
            <span class="chip">{{ MODE_LABELS[m] }}</span>
          </label>
        </div>
      </fieldset>
    </div>
  </div>
</template>

<style scoped>
.page-title {
  margin-bottom: 1.6rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem 2.4rem;
  padding: 1.6rem 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.target {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  font-size: var(--krds-pc-font-size-body-medium);
}

.corp {
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.sep {
  color: var(--krds-light-color-text-disabled);
}

.result b {
  color: var(--krds-light-color-text-primary);
}

.mode {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.2rem;
}

.mode-legend {
  float: left;
  margin-right: 1.2rem;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
  line-height: 4rem;
}

.mode-options {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.mode-option {
  position: relative;
  display: inline-flex;
}

.chip {
  display: inline-flex;
  align-items: center;
  min-height: 4rem;
  padding: 0 1.6rem;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 500;
  color: var(--krds-light-color-text-basic);
  cursor: pointer;
}

.mode-option input:checked + .chip {
  border-color: var(--rq-accent);
  background: var(--rq-accent);
  color: var(--rq-on-accent);
  font-weight: 700;
}

.mode-option input:focus-visible + .chip {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.2rem;
}

@media (max-width: 767px) {
  .summary {
    padding: 1.4rem 1.6rem;
  }

  .chip {
    min-height: var(--rq-touch);
  }
}
</style>
