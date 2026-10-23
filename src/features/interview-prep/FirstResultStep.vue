<script setup lang="ts">
/**
 * S4 ③ 1차·기술 면접 질문.
 * M2 범위: 고른 카드로 shared/rules 의 pickTop5 검수 문장을 바로 보여 주고 "복사"·"선택 바꾸기"만 둔다.
 * 질문 생성(generate·가짜 공급자)·만드는 중·저장 복원·펼침·전체 복사·인쇄·다시 만들기는 M3에서 붙인다.
 */
import { computed } from 'vue'
import { CARD_BOOK, getCard } from '@shared/catalog'
import type { PostingAnalysis } from '@shared/contract'
import { pickTop5, typeLabel } from '@shared/rules'
import { useCopy } from '@/composables/useCopy'
import { usePrepStore } from '@/stores/prep'

const props = defineProps<{ applyId: string; analysis?: PostingAnalysis }>()
const emit = defineEmits<{ change: [] }>()

const prep = usePrepStore()
const { copy } = useCopy()

const selection = computed(() => prep.selectionOf(props.applyId))
const questions = computed(() =>
  props.analysis
    ? pickTop5({ picks: prep.cardPicks(props.applyId), experience: selection.value.experience }, props.analysis)
    : [],
)
</script>

<template>
  <section class="result-step" aria-labelledby="result-title">
    <div class="intro">
      <h2 id="result-title" class="section-title">1차·기술 면접 질문</h2>
      <p v-if="questions.length" class="lead">
        고른 카드 {{ selection.picks.length }}개 중 공고와 차이가 큰 순서로 {{ questions.length }}개를 골랐어요.
      </p>
    </div>

    <ol v-if="questions.length" class="questions">
      <li v-for="(q, i) in questions" :key="q.card_id" class="question">
        <div class="q-head">
          <span class="num" aria-hidden="true">{{ i + 1 }}</span>
          <span class="type-chip" :class="`is-${q.type}`">{{ typeLabel(q.type) }}</span>
          <span class="q-card">{{ getCard(q.card_id)?.label }} · {{ CARD_BOOK.preference_options[q.pref] }}</span>
          <span v-if="q.has_exp" class="exp-chip">경험 포함</span>
        </div>
        <p class="q-text">{{ q.template_text }}</p>
        <div class="q-actions">
          <button type="button" class="btn btn-tertiary btn-sm" @click="copy(q.template_text)">복사</button>
        </div>
      </li>
    </ol>
    <div v-else class="empty">
      <p>아직 고른 카드가 없어요. 기대되거나 걱정되는 업무를 골라 주세요.</p>
    </div>

    <div class="result-actions">
      <button type="button" class="btn btn-tertiary" @click="emit('change')">선택 바꾸기</button>
    </div>
  </section>
</template>

<style scoped>
.result-step {
  display: grid;
  gap: 2rem;
}

.intro {
  display: grid;
  gap: 0.6rem;
}

.lead {
  color: var(--krds-light-color-text-subtle);
}

.questions {
  display: grid;
  gap: 1.2rem;
}

.question {
  display: grid;
  gap: 1rem;
  padding: 1.8rem 2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.q-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.8rem;
}

.num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: var(--krds-radius-medium2);
  background: var(--rq-accent);
  color: var(--rq-on-accent);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
}

.type-chip,
.exp-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border-radius: var(--krds-radius-max);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  white-space: nowrap;
  background: var(--krds-light-color-surface-gray-subtle);
  color: var(--krds-light-color-text-basic);
}

.type-chip.is-conflict {
  background: var(--krds-light-color-surface-danger-subtler);
  color: var(--krds-light-color-text-danger);
}

.type-chip.is-opportunity {
  background: var(--krds-light-color-surface-success-subtler);
  color: var(--krds-light-color-text-success);
}

.type-chip.is-depth {
  background: var(--krds-light-color-surface-information-subtler);
  color: var(--krds-light-color-text-information);
}

.exp-chip {
  background: var(--rq-accent-subtle);
  color: var(--rq-accent-strong);
}

.q-card {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.q-text {
  font-size: var(--krds-pc-font-size-body-large);
  font-weight: 700;
  line-height: 1.55;
  color: var(--krds-light-color-text-bolder);
}

.q-actions,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.empty {
  padding: 3.2rem 2rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
  color: var(--krds-light-color-text-subtle);
  text-align: center;
}

@media (max-width: 767px) {
  .question {
    padding: 1.4rem 1.6rem;
  }

  .q-text {
    font-size: var(--krds-pc-font-size-body-medium);
  }
}
</style>
