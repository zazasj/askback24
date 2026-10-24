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
        <span class="sep sep-title" aria-hidden="true">·</span>
        <span class="title">{{ wantedTitle }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="result" :class="{ 'is-empty': result === '-' }"><span class="result-label">지원결과 </span><b>{{ result }}</b></span>
        <!-- 서류합격 건이 1차를 다녀와 최종으로 넘어가도 지원결과는 그대로라 지금 준비하는 면접을 같이 적는다(DA-04) -->
        <template v-if="mode === 'final'">
          <span class="sep" aria-hidden="true">·</span>
          <span class="stage">준비 중: <b>최종 면접</b></span>
        </template>
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
/* 머리는 한 줄짜리 낮은 상자(N4): 첫 화면에 단계 본문(질문·카드)이 더 보이게 위아래 여백과 라디오 높이를 줄인다 */
.page-title {
  margin-bottom: 1.2rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem 2.4rem;
  padding: 0.7rem 1.2rem 0.7rem 2rem;
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

.stage b {
  color: var(--rq-accent-strong);
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
  line-height: 3.4rem;
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
  min-height: 3.4rem;
  padding: 0 1.4rem;
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

/* 휴대폰: 머리가 첫 화면을 덜 차지하게 라디오는 2열 세그먼트(DR-r1-02).
   요약은 두 줄: 회사명·지원결과 / 채용제목(지원 조건이 잘리지 않게 두 줄까지, DR-r2-06) */
@media (max-width: 767px) {
  .page-title {
    margin-bottom: 1rem;
  }

  .summary {
    display: grid;
    gap: 0.8rem;
    padding: 1rem 1.2rem;
  }

  .target {
    min-width: 0;
    gap: 0.2rem 0.6rem;
    font-size: var(--krds-pc-font-size-body-small);
  }

  .sep-title {
    display: none;
  }

  .title {
    order: 1;
    flex-basis: 100%;
    min-width: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    color: var(--krds-light-color-text-basic);
  }

  /* 지원결과가 있으면 값만으로 뜻이 보여 글자는 화면낭독기에 남기고, "-"이면 글자를 같이 보인다 */
  .result:not(.is-empty) .result-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .result.is-empty .result-label {
    color: var(--krds-light-color-text-subtle);
  }

  .mode {
    display: block;
  }

  .mode-legend {
    float: none;
    margin: 0 0 0.4rem;
    font-size: var(--krds-pc-font-size-label-xsmall);
    line-height: 1.4;
  }

  .mode-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
  }

  .mode-option {
    display: flex;
  }

  .chip {
    width: 100%;
    justify-content: center;
    min-height: var(--rq-touch);
    padding: 0 0.6rem;
    border-radius: 0;
    font-size: var(--krds-pc-font-size-label-xsmall);
    text-align: center;
  }

  .mode-option:first-child .chip {
    border-radius: var(--krds-radius-medium2) 0 0 var(--krds-radius-medium2);
  }

  .mode-option:last-child .chip {
    margin-left: -1px;
    border-radius: 0 var(--krds-radius-medium2) var(--krds-radius-medium2) 0;
  }

  /* 맞닿은 테두리에서 고른 쪽 테두리가 위에 오게 */
  .mode-option input:checked + .chip {
    position: relative;
    z-index: 1;
  }
}
</style>
