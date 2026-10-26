<script setup lang="ts">
/**
 * S4 ① 공고 분석 로딩(LD-01). 공고 분석은 AI 파이프라인이 미리 만든 결과라 "지금 분석한다"고 말하지 않는다(LD-05, D-219).
 * 단계 세 줄은 처음부터 다 보이고 상태만 차례로 바뀐다(만드는 중 화면 GeneratingView 와 같은 방식).
 * 그 아래 이 공고 분석의 근거 인용(① 문서 순서, 최대 4개)이 하나씩 떠오른다. 약 2초 뒤 done.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ quotes: readonly string[] }>()
const emit = defineEmits<{ done: [] }>()

const STAGES = ['공고 원문 확인', '업무 카드와 맞춰 보기', '확인할 곳 표시'] as const
/** 단계 하나 약 0.6초, 합계 2초(PLAN-3 4-3 "약 2초", LD-02 1.5~2.5초) */
const STAGE_MS = 600
const DONE_MS = 2000
const QUOTE_FIRST_MS = 250
const QUOTE_GAP_MS = 350

/** 지금 진행 중인 단계 번호(STAGES.length = 모두 끝남) */
const active = ref(0)
const shownQuotes = ref(0)
const timers: Array<ReturnType<typeof setTimeout>> = []
const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))

onMounted(() => {
  for (let i = 1; i <= STAGES.length; i++) at(i * STAGE_MS, () => (active.value = i))
  props.quotes.forEach((_, i) => at(QUOTE_FIRST_MS + i * QUOTE_GAP_MS, () => (shownQuotes.value = i + 1)))
  at(DONE_MS, () => emit('done'))
})
onBeforeUnmount(() => timers.forEach(clearTimeout))

const stateOf = (i: number) => (i < active.value ? 'done' : i === active.value ? 'active' : 'wait')
</script>

<template>
  <div class="posting-loading">
    <div class="box" role="status" aria-live="polite">
      <p class="title">AI가 분석한 공고를 펼치고 있어요</p>
      <ol class="stage-list">
        <li v-for="(s, i) in STAGES" :key="s" class="stage" :data-state="stateOf(i)">
          <span class="dot" aria-hidden="true"></span>
          <span class="stage-text">{{ s }}</span>
          <span class="sr-only">{{ stateOf(i) === 'done' ? '(완료)' : stateOf(i) === 'active' ? '(진행 중)' : '' }}</span>
        </li>
      </ol>
      <div v-if="props.quotes.length" class="found">
        <p id="posting-loading-quotes" class="found-label">공고에서 찾은 문구</p>
        <ul class="quotes" aria-labelledby="posting-loading-quotes">
          <li v-for="(q, i) in props.quotes" :key="q" class="quote-item" :data-shown="i < shownQuotes">
            <span class="quote">‘{{ q }}’</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- ① 자리 모양(공고 표 + 옆 상자). 글이 없는 장식이라 읽지 않는다 -->
    <div class="skeleton" aria-hidden="true">
      <div class="sk-table">
        <div v-for="n in 5" :key="n" class="sk-row">
          <span class="bar sk-th"></span>
          <span class="sk-td">
            <span class="bar"></span>
            <span v-if="n === 1" class="bar"></span>
            <span class="bar short"></span>
          </span>
        </div>
      </div>
      <div class="sk-side">
        <span class="bar sk-side-title"></span>
        <span v-for="n in 3" :key="n" class="sk-check"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.posting-loading {
  display: grid;
  gap: 2rem;
}

.box {
  display: grid;
  gap: 1.2rem;
  padding: 2rem 2.4rem;
  border: 1px solid var(--rq-accent-border);
  border-left: 0.4rem solid var(--rq-accent);
  border-radius: var(--krds-radius-medium2);
  background: var(--rq-accent-subtler);
}

.title {
  font-size: var(--krds-pc-font-size-label-large);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.stage-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 2.4rem;
}

.stage {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  font-size: var(--krds-pc-font-size-body-medium);
  color: var(--krds-light-color-text-subtle);
}

.dot {
  flex: none;
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid var(--krds-light-color-border-gray);
  border-radius: 50%;
  background: var(--krds-light-color-surface-white);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.stage[data-state='active'] {
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.stage[data-state='active'] .dot {
  border-color: var(--rq-accent);
  animation: pulse 0.6s ease-in-out infinite alternate;
}

.stage[data-state='done'] {
  color: var(--krds-light-color-text-basic);
}

.stage[data-state='done'] .dot {
  border-color: var(--rq-accent);
  background: var(--rq-accent);
}

.found {
  display: grid;
  gap: 0.6rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--rq-accent-border);
}

.found-label {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.quotes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.quote-item {
  max-width: 100%;
}

/* 아직 나오지 않은 인용은 자리만 잡아 둔다(나올 때 줄이 밀리지 않게). 투명도 대신 숨김 → 떠오르기 */
.quote-item[data-shown='false'] {
  visibility: hidden;
}

.quote-item[data-shown='true'] {
  animation: rise 0.3s ease-out;
}

/* ① 형광펜과 같은 노란 바탕(로딩 뒤 이 문구들이 형광펜으로 칠해진다) */
.quote {
  display: inline-block;
  max-width: 100%;
  padding: 0.2rem 0.6rem;
  border-radius: var(--krds-radius-small1);
  background: var(--rq-mark);
  font-size: var(--krds-pc-font-size-body-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
  word-break: keep-all;
  overflow-wrap: anywhere;
}

/* ── ① 자리 모양 ───────────────────────────────────── */
.skeleton {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 2.4rem;
  align-items: start;
}

.sk-table {
  border-top: 2px solid var(--krds-light-color-border-gray-light);
}

.sk-row {
  display: grid;
  grid-template-columns: 10.4rem minmax(0, 1fr);
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
}

.sk-th {
  height: auto;
  margin: 0;
  border-radius: 0;
  background: var(--krds-light-color-surface-gray-subtler);
}

.sk-td {
  display: grid;
  gap: 0.8rem;
  padding: 1.4rem;
}

.sk-side {
  display: grid;
  gap: 1rem;
  padding: 1.8rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.sk-side-title {
  width: 60%;
  height: 2rem;
}

.sk-check {
  display: block;
  height: 6.4rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-medium3);
  background: var(--krds-light-color-surface-white);
}

.bar {
  display: block;
  height: 1.4rem;
  border-radius: var(--krds-radius-small1);
  background: var(--krds-light-color-surface-gray-subtle);
}

.bar.short {
  width: 58%;
}

@keyframes pulse {
  from {
    transform: scale(0.85);
  }
  to {
    transform: scale(1.1);
  }
}

@keyframes rise {
  from {
    transform: translateY(0.6rem);
  }
  to {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage[data-state='active'] .dot,
  .quote-item[data-shown='true'] {
    animation: none;
  }
}

/* 고대비(forced-colors)에서 진행·완료 단계 점이 구분되게 시스템 강조색(A3-r2-06) */
@media (forced-colors: active) {
  .stage[data-state='active'] .dot {
    border-color: Highlight;
  }

  .stage[data-state='done'] .dot {
    border-color: Highlight;
    background-color: Highlight;
  }
}

@media (max-width: 1023px) {
  .skeleton {
    grid-template-columns: minmax(0, 1fr);
  }

  .sk-side {
    display: none;
  }
}

@media (max-width: 767px) {
  .posting-loading {
    gap: 1.6rem;
  }

  .box {
    padding: 1.4rem 1.4rem 1.4rem 1.2rem;
  }

  .stage-list {
    flex-direction: column;
  }

  .sk-row {
    grid-template-columns: 8.4rem minmax(0, 1fr);
  }

  .sk-td {
    padding: 1rem;
  }
}
</style>
