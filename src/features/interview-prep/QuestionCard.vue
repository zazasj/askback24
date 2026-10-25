<script setup lang="ts">
/**
 * 질문 한 장(1차·최종 공용). 질문 문장이 가장 크고, 근거·주의할 답·좋은 신호는 "왜 이 질문인가요"에 접어 둔다.
 * 검수 문장(source: template)은 감추지 않고 라벨을 단다.
 */
import { useId } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ChipTone } from './questionView'
import TypeChip from './TypeChip.vue'

defineProps<{
  /** 화면에 보이는 번호 */
  rank: number
  /** 인쇄할 때의 번호와 자리("면접에서 쓸 것 같아요"를 누른 질문이 맨 위, H1-14). 없으면 화면과 같다 */
  printNo?: number
  typeLabel: string
  tone: ChipTone
  /** 카드(근로조건) 이름 "고객사 상주 개발" — 인쇄에도 남는다 */
  metaName?: string
  /** 내 선택·판정·공고 상태 꼬리 "걱정돼요 · 아직 모름" — 화면에만(H2-01) */
  metaTail?: string
  text: string
  hasExp: boolean
  template: boolean
  kept: boolean
  basis: string
  /** "우대조건 '고객사 상주 가능자'" */
  evidenceLabel?: string
  /** ① 그 형광펜으로 가는 주소 */
  evidenceTo?: RouteLocationRaw
  watchOut: string
  goodSign: string
  /** 유형 칩의 뜻 "차이 확인: 걱정한 일이 …" — 펼침 첫 줄 */
  typeNote?: string
}>()

const emit = defineEmits<{ copy: []; keep: [] }>()

// 질문마다 같은 이름인 버튼(복사·면접에서 쓸 것 같아요·근거 보기)이 몇 번 질문 것인지 화면낭독기에 알린다(H2-19)
const noId = `q-no-${useId()}`
</script>

<template>
  <li
    class="question"
    :class="{ 'is-template': template, 'has-print-no': printNo !== undefined }"
    :style="printNo !== undefined ? { '--print-order': printNo } : undefined"
  >
    <!-- 인쇄물(면접장에 들고 가는 종이)에는 번호·카드 이름·질문·"들은 답" 칸만. 유형 칩·내 선택·판정 꼬리는 화면에만(H2-01) -->
    <div class="q-head">
      <span class="num" aria-hidden="true">{{ rank }}</span>
      <span v-if="printNo !== undefined" class="num print-num" aria-hidden="true">{{ printNo }}</span>
      <span :id="noId" class="sr-only">{{ rank }}번 질문</span>
      <TypeChip :label="typeLabel" :tone="tone" data-print="hide" />
      <span v-if="metaName || metaTail" class="q-meta">
        <span v-if="metaName" class="q-meta-name">{{ metaName }}</span>
        <span v-if="metaTail" class="q-meta-tail" data-print="hide"><template v-if="metaName"> · </template>{{ metaTail }}</span>
      </span>
      <span v-if="hasExp" class="tag exp-tag" data-print="hide">경험 포함</span>
      <span v-if="template" class="tag template-tag" data-print="hide">검수 문장</span>
    </div>

    <p class="q-text">{{ text }}</p>

    <div class="q-actions" data-print="hide">
      <button type="button" class="btn btn-tertiary btn-sm" :aria-describedby="noId" @click="emit('copy')">복사</button>
      <button type="button" class="btn btn-sm keep" :aria-pressed="kept" :aria-describedby="noId" @click="emit('keep')">
        <svg class="keep-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path
            d="M6 9v8H3V9h3Zm2 8V9.2l3.6-5.9a1.4 1.4 0 0 1 2.6.9L13.6 8H17a1.5 1.5 0 0 1 1.5 1.8l-1.3 5.9A1.8 1.8 0 0 1 15.4 17H8Z"
          />
        </svg>
        면접에서 쓸 것 같아요
      </button>
    </div>

    <details class="why" data-print="hide">
      <summary>왜 이 질문인가요</summary>
      <p v-if="typeNote" class="why-type">{{ typeNote }}</p>
      <dl class="why-list">
        <div class="why-row">
          <dt>근거</dt>
          <dd>
            <span v-if="evidenceLabel" class="evidence">{{ evidenceLabel }}</span>
            <span v-else class="evidence is-none">공고에 근거 없음 · 직접 확인</span>
            <span class="basis">{{ basis }}</span>
            <RouterLink v-if="evidenceTo" class="evidence-link tap-target" :to="evidenceTo" :aria-describedby="noId">근거 보기</RouterLink>
          </dd>
        </div>
        <div class="why-row">
          <dt>주의할 답</dt>
          <dd>
            {{ watchOut }}
            <!-- 누구의 답인지 밝힌다(H2-15 ①): 주의할 답은 회사가 하는 답이다 -->
            <span class="why-note">회사가 이렇게 답하면 내 기대와 다를 수 있어요. 회사의 흠은 아니에요.</span>
          </dd>
        </div>
        <div class="why-row">
          <dt>좋은 신호</dt>
          <dd>{{ goodSign }}</dd>
        </div>
      </dl>
    </details>

    <div class="print-memo" aria-hidden="true">
      <span class="print-memo-label">들은 답</span>
    </div>
  </li>
</template>

<style scoped>
.question {
  display: grid;
  gap: 1rem;
  padding: 1.6rem 2rem;
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

.tag {
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border-radius: var(--krds-radius-max);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  white-space: nowrap;
}

.print-num {
  display: none;
}

.exp-tag {
  background: var(--rq-accent-subtle);
  color: var(--rq-accent-strong);
}

.template-tag {
  border: 1px solid var(--krds-light-color-border-gray);
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-text-subtle);
}

.q-meta {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.q-text {
  font-size: var(--krds-pc-font-size-body-large);
  font-weight: 700;
  line-height: 1.6;
  color: var(--krds-light-color-text-bolder);
}

.q-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.keep {
  border-color: var(--krds-light-color-button-tertiary-border);
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-text-basic);
}

.keep:hover {
  border-color: var(--rq-accent);
}

.keep[aria-pressed='true'] {
  border-color: var(--rq-accent);
  background: var(--rq-accent-subtle);
  color: var(--rq-accent-strong);
  font-weight: 700;
}

.keep-icon {
  width: 1.6rem;
  height: 1.6rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.keep[aria-pressed='true'] .keep-icon {
  fill: currentColor;
}

/* ── 왜 이 질문인가요 ─────────────────────────────── */
.why {
  border-top: 1px solid var(--krds-light-color-border-gray-light);
  padding-top: 0.6rem;
}

.why summary {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 3.2rem;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-primary);
  cursor: pointer;
  list-style: none;
}

.why summary::-webkit-details-marker {
  display: none;
}

.why summary::before {
  content: '';
  width: 0.7rem;
  height: 0.7rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.15s;
}

.why[open] summary::before {
  transform: rotate(45deg);
}

.why-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1.4rem 1.6rem;
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-gray-subtler);
}

.why-row {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  gap: 1.2rem;
}

.why-row dt {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.why-row dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.6;
  color: var(--krds-light-color-text-basic);
}

/* 유형 칩이 회사를 따지는 말로 읽히지 않게 뜻을 먼저 한 줄로 */
.why-type {
  margin-top: 1rem;
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.6;
  color: var(--krds-light-color-text-basic);
}

.why-type + .why-list {
  margin-top: 0.6rem;
}

.why-note {
  flex-basis: 100%;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.evidence {
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.evidence.is-none {
  font-weight: 500;
  color: var(--krds-light-color-text-subtle);
}

.basis {
  color: var(--krds-light-color-text-subtle);
}

.evidence-link {
  font-weight: 700;
  color: var(--krds-light-color-text-primary);
  text-decoration: underline;
  text-underline-offset: 0.3rem;
}

.print-memo {
  display: none;
}

@media (max-width: 767px) {
  .question {
    padding: 1.4rem 1.6rem;
  }

  .q-text {
    font-size: var(--krds-pc-font-size-body-medium);
  }

  .q-actions .btn {
    min-height: var(--rq-touch);
  }

  .why summary {
    min-height: var(--rq-touch);
  }

  .why-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2rem;
  }
}

@media print {
  .question {
    order: var(--print-order, 0);
    gap: 0.6rem;
    padding: 1rem 1.2rem;
    break-inside: avoid;
  }

  .question.has-print-no .num:not(.print-num) {
    display: none;
  }

  .question.has-print-no .print-num {
    display: inline-flex;
  }

  /* 종이에는 카드 이름만 남는다(유형 칩·꼬리는 data-print="hide") */
  .q-meta {
    font-size: 9pt;
  }

  .q-text {
    font-size: 11pt;
  }

  .print-memo {
    display: block;
    min-height: 1.5cm;
    padding: 0.4rem 0.6rem;
    border: 1px dashed var(--krds-light-color-border-gray);
    border-radius: var(--krds-radius-medium1);
  }

  .print-memo-label {
    font-size: 9pt;
    color: var(--krds-light-color-text-subtle);
  }
}
</style>
