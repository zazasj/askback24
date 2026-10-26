<script setup lang="ts">
/**
 * S4 최종 ② 1차 면접 정리(최소판, 추가 개발 노트 3·10절).
 * 1차 질문마다 물어봤는지 → 들은 답 한 줄·답 모양 / 못 물은 이유, 회사가 물어본 업무(카드 체크), 면접 분위기.
 * 입력은 메모리에만 둔다(review 저장소). "최종 질문 만들기"는 질문 저장소에서 만들기를 시작하고 ③으로 간다.
 */
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { CARDS } from '@shared/catalog'
import type { Clarity, Mood, NotAskedReason, Question } from '@shared/contract'
import { typeLabel } from '@shared/rules'
import { REVIEW_TOUR } from '@/features/tour/tourSteps'
import { useScreenTour } from '@/features/tour/useScreenTour'
import { usePrepStore } from '@/stores/prep'
import { useQuestionsStore } from '@/stores/questions'
import { useReviewStore } from '@/stores/review'
import { oneLine } from './picks'
import { FIRST_TONES, cardMeta } from './questionView'
import TypeChip from './TypeChip.vue'
import {
  ASKED_LABELS,
  CLARITY_LABELS,
  HEARD_MAX,
  MOODS,
  MOOD_LABELS,
  REASONS,
  REASON_LABELS,
  isItemDone,
  isTouched,
  itemOf,
  type AskedChoice,
} from './review'

const props = defineProps<{ applyId: string }>()
const emit = defineEmits<{ make: []; first: [] }>()

const prep = usePrepStore()
const store = useQuestionsStore()
const review = useReviewStore()

const questions = computed<Question[]>(() => store.firstOf(props.applyId)?.response.questions ?? [])
const draft = computed(() => review.draftOf(props.applyId))
const item = (cardId: string) => itemOf(draft.value, cardId)
const done = computed(() => questions.value.filter((q) => isItemDone(item(q.card_id))).length)
const touched = computed(() => isTouched(draft.value))
const hasPicks = computed(() => prep.selectionOf(props.applyId).picks.length > 0)

// 정리할 1차 질문이 있을 때 이 화면 안내(TR-02). 빈 상태("먼저 1차 면접 질문을 만들어 주세요")에는 띄우지 않는다
useScreenTour('prep-review', () => [...REVIEW_TOUR], { ready: () => questions.value.length > 0, titleId: 'review-title' })

/**
 * 하나라도 적었으면 떠날 때 확인 창을 띄운다(H2-22). 휴대폰에서 다른 앱에 다녀오면 탭이 다시 열리며 입력이 지워질 수 있다.
 * 들은 답은 저장하지 않는 약속(R-09)이라 sessionStorage 임시 저장은 하지 않는다.
 * 아이폰 사파리는 탭을 정리할 때 beforeunload 가 뜨지 않는다(D-205)
 */
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (!touched.value) return
  e.preventDefault()
  // 옛 브라우저는 returnValue 를 채워야 창을 띄운다
  e.returnValue = ''
})

const ASKED: readonly AskedChoice[] = ['asked', 'not_asked']
const CLARITIES: readonly Clarity[] = ['clear', 'vague']

// 한 줄 입력이라 붙여 넣은 줄바꿈은 띄어쓰기로 바꾼다(칸은 휴대폰에서 글이 잘리지 않게 textarea)
function onHeard(cardId: string, e: Event): void {
  review.setHeard(props.applyId, cardId, oneLine((e.target as HTMLTextAreaElement).value))
}

function onReason(cardId: string, e: Event): void {
  const v = (e.target as HTMLSelectElement).value as NotAskedReason | ''
  review.setReason(props.applyId, cardId, v === '' ? null : v)
}

function onReceived(cardId: string, e: Event): void {
  review.toggleReceived(props.applyId, cardId, (e.target as HTMLInputElement).checked)
}

function setMood(m: Mood): void {
  review.setMood(props.applyId, m)
}
</script>

<template>
  <section class="review-step" aria-labelledby="review-title">
    <div class="intro">
      <h2 id="review-title" class="section-title" tabindex="-1">1차 면접 정리</h2>
      <!-- 정리할 질문이 없으면 아래 빈 상태 안내와 어긋나므로 숨긴다(DR-r2-05) -->
      <template v-if="questions.length">
        <p class="lead">
          1차 면접에서 물어본 것과 들은 답을 짧게 정리해 주세요. 확인된 것은 빼고, 남은 것과 처우를 최종 면접 질문으로 만들어 드려요.
        </p>
        <p class="privacy">
          들은 답과 면접 분위기는 저장하지 않아요. 새로고침하면 지워지고, 만든 최종 질문만 이 브라우저에 남아요. 실제 서비스에서는 들은
          답을 AI에 보내 답이 구체적이었는지만 판정하고, 질문 문장을 쓸 때는 보내지 않아요. 면접관 이름이나 회사 내부 이야기는 빼고 적어 주세요.
        </p>
      </template>
    </div>

    <div v-if="!questions.length" class="empty">
      <p class="empty-title">먼저 1차 면접 질문을 만들어 주세요</p>
      <p>1차 면접에 가져갈 질문을 만든 뒤 면접을 다녀오면, 여기서 물어본 것과 들은 답을 정리할 수 있어요.</p>
      <button type="button" class="btn btn-accent" @click="emit('first')">1차 면접 질문 만들기</button>
    </div>

    <template v-else>
      <section class="block" aria-labelledby="asked-title">
        <div class="block-head">
          <h3 id="asked-title" class="sub-title">1차 면접에 가져간 질문 {{ questions.length }}개</h3>
          <p class="hint">질문마다 물어봤는지 골라 주세요. 들은 답은 한 줄이면 충분해요.</p>
        </div>
        <ol class="review-list">
          <li
            v-for="(q, i) in questions"
            :key="q.card_id"
            class="review-item"
            :class="{ 'is-done': isItemDone(item(q.card_id)) }"
            data-tour="review-item"
          >
            <div class="q-head">
              <span class="num" aria-hidden="true">{{ i + 1 }}</span>
              <span class="sr-only">{{ i + 1 }}번 질문</span>
              <TypeChip :label="typeLabel(q.type)" :tone="FIRST_TONES[q.type]" />
              <span class="q-meta">{{ cardMeta(q.card_id, q.type) }}</span>
            </div>
            <p class="q-text">{{ q.text }}</p>

            <fieldset class="choice-row">
              <legend class="sr-only">{{ i + 1 }}번 질문을 물어봤나요</legend>
              <label v-for="a in ASKED" :key="a" class="choice" :class="`is-${a}`">
                <input
                  type="radio"
                  class="sr-only"
                  :name="`asked-${q.card_id}`"
                  :value="a"
                  :checked="item(q.card_id).asked === a"
                  @change="review.setAsked(applyId, q.card_id, a)"
                />
                <span class="chip">{{ ASKED_LABELS[a] }}</span>
              </label>
            </fieldset>

            <div v-if="item(q.card_id).asked === 'asked'" class="detail">
              <div class="field">
                <label :for="`heard-${q.card_id}`" class="field-label">들은 답</label>
                <textarea
                  :id="`heard-${q.card_id}`"
                  class="input input-multiline heard-input"
                  rows="2"
                  :maxlength="HEARD_MAX"
                  autocomplete="off"
                  placeholder="예: 신규 개발은 프로젝트 들어갈 때만 해요"
                  :aria-describedby="`heard-${q.card_id}-count`"
                  :value="item(q.card_id).heard"
                  @keydown.enter.prevent
                  @input="onHeard(q.card_id, $event)"
                ></textarea>
                <span :id="`heard-${q.card_id}-count`" class="field-count">{{ item(q.card_id).heard.length }}/{{ HEARD_MAX }}자</span>
              </div>
              <fieldset class="choice-row">
                <legend class="field-label">답이 어땠나요</legend>
                <label v-for="c in CLARITIES" :key="c" class="choice" :class="`is-${c}`">
                  <input
                    type="radio"
                    class="sr-only"
                    :name="`clarity-${q.card_id}`"
                    :value="c"
                    :checked="item(q.card_id).clarity === c"
                    @change="review.setClarity(applyId, q.card_id, c)"
                  />
                  <span class="chip">{{ CLARITY_LABELS[c] }}</span>
                </label>
              </fieldset>
            </div>

            <div v-else-if="item(q.card_id).asked === 'not_asked'" class="detail">
              <div class="field">
                <label :for="`reason-${q.card_id}`" class="field-label">못 물은 이유</label>
                <select
                  :id="`reason-${q.card_id}`"
                  class="input reason-select"
                  :value="item(q.card_id).reason ?? ''"
                  @change="onReason(q.card_id, $event)"
                >
                  <option value="" disabled>골라 주세요</option>
                  <option v-for="r in REASONS" :key="r" :value="r">{{ REASON_LABELS[r] }}</option>
                </select>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <fieldset class="block box">
        <legend class="sub-title box-legend">회사가 물어본 업무</legend>
        <p class="hint">
          면접에서 회사가 먼저 물어본 업무가 있으면 골라 주세요. 공고에 없던 업무라도 회사가 물었다면 실제로 맡게 될 수 있어요.
        </p>
        <ul class="task-grid">
          <li v-for="card in CARDS" :key="card.id">
            <label class="task-check">
              <input type="checkbox" :checked="draft.received.includes(card.id)" @change="onReceived(card.id, $event)" />
              <span>{{ card.label }}</span>
            </label>
          </li>
        </ul>
      </fieldset>

      <fieldset class="block box">
        <legend class="sub-title box-legend">면접 분위기</legend>
        <p class="hint">질문 문장을 얼마나 조심스럽게 쓸지에만 써요. 회사를 평가하는 데는 쓰지 않아요.</p>
        <div class="choice-row">
          <label v-for="m in MOODS" :key="m" class="choice is-mood">
            <input type="radio" class="sr-only" :name="`mood-${applyId}`" :value="m" :checked="draft.mood === m" @change="setMood(m)" />
            <span class="chip">{{ MOOD_LABELS[m] }}</span>
          </label>
        </div>
        <!-- 면접에서 직무와 상관없는 개인정보를 요구받았을 때 안내할 곳(H2-13) -->
        <p class="hint">
          면접에서 가족·결혼 계획처럼 일과 상관없는 개인정보를 물었다면 고용노동부 고객상담센터(국번 없이 1350)에 상담할 수 있어요.
        </p>
      </fieldset>

      <div class="review-bar">
        <p class="counter">
          <strong class="count">정리한 질문 {{ done }}/{{ questions.length }}개</strong>
          <span class="count-tip">정리하지 않은 질문은 아직 모름으로 두고 다시 올려요.</span>
        </p>
        <button type="button" class="btn btn-accent btn-lg make" :disabled="!touched" data-tour="review-make" @click="emit('make')">최종 질문 만들기</button>
      </div>
      <p v-if="!hasPicks" class="hint">고른 카드가 없어 회사가 물어본 업무와 처우 질문 위주로 만들어요.</p>
    </template>
  </section>
</template>

<style scoped>
.review-step {
  display: grid;
  gap: 2.4rem;
}

.intro {
  display: grid;
  gap: 0.6rem;
}

/* 이 제목(tabindex="-1")의 초점 테두리는 base.css 가 없앤다(A3-r1-15) */

.lead {
  color: var(--krds-light-color-text-basic);
}

.privacy,
.hint {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.block {
  display: grid;
  gap: 1.2rem;
}

.block-head {
  display: grid;
  gap: 0.4rem;
}

.sub-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

/* ── 질문 하나 ─────────────────────────────────────── */
.review-list {
  display: grid;
  gap: 1.2rem;
}

.review-item {
  display: grid;
  gap: 1.2rem;
  padding: 1.8rem 2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.review-item.is-done {
  border-color: var(--rq-accent-border);
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

.q-meta {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.q-text {
  font-size: var(--krds-pc-font-size-body-medium);
  font-weight: 700;
  line-height: 1.6;
  color: var(--krds-light-color-text-bolder);
}

/* ── 칩 모양 라디오 ───────────────────────────────── */
.choice-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.choice-row > legend.field-label {
  float: left;
  width: 100%;
  margin-bottom: 0.6rem;
}

.choice {
  position: relative;
  display: inline-flex;
}

.chip {
  display: inline-flex;
  align-items: center;
  min-height: 3.6rem;
  padding: 0 1.4rem;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 500;
  color: var(--krds-light-color-text-basic);
  cursor: pointer;
  user-select: none;
}

.chip:hover {
  border-color: var(--krds-light-color-border-gray-dark);
}

.choice input:focus-visible + .chip {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.2rem;
}

/* 고른 표시는 강조색 하나(H2-21 ②). 못 물어봤어요·모호했어요도 같은 색이라 "고른 것"만 뜻한다 */
.choice input:checked + .chip {
  border-color: var(--rq-accent);
  background: var(--rq-accent);
  color: var(--rq-on-accent);
  font-weight: 700;
}

/* ── 들은 답·못 물은 이유 ─────────────────────────── */
.detail {
  display: grid;
  gap: 1.2rem;
  padding: 1.4rem 1.6rem;
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-gray-subtler);
}

.field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem 1.2rem;
}

.field-label {
  grid-column: 1 / -1;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.heard-input,
.reason-select {
  width: 100%;
  min-height: 4.4rem;
  font-size: var(--krds-pc-font-size-body-medium);
}

.reason-select {
  grid-column: 1 / -1;
  max-width: 36rem;
}

.field-count {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
  white-space: nowrap;
}

/* ── 회사가 물어본 업무 · 면접 분위기 ─────────────── */
.box {
  padding: 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.box-legend {
  float: left;
  width: 100%;
  margin-bottom: 0.4rem;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
  gap: 0.8rem 1.6rem;
}

/* 한 줄 이름과 두 줄 이름이 같은 행에 있어도 칸 높이를 맞춘다 */
.task-grid > li {
  display: flex;
}

.task-check {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4rem;
  padding: 0 1.2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-small);
  color: var(--krds-light-color-text-basic);
  cursor: pointer;
}

.task-check:has(input:checked) {
  border-color: var(--rq-accent);
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.task-check input {
  flex: none;
  width: 1.8rem;
  height: 1.8rem;
  margin: 0;
  accent-color: var(--rq-accent);
}

/* ── 아래 버튼 줄 ─────────────────────────────────── */
.review-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 2rem;
  padding: 1.4rem 1.6rem 1.4rem 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.counter {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
}

.count {
  font-size: var(--krds-pc-font-size-label-large);
  color: var(--rq-accent-strong);
}

.count-tip {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

/* 비활성 → 활성 색이 바로 바뀌게(중간 색에서 대비가 모자라지 않게) */
.make {
  transition: none;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 1.2rem;
  padding: 3.2rem 2rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
  color: var(--krds-light-color-text-subtle);
  text-align: center;
}

.empty-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

@media (max-width: 767px) {
  .review-item,
  .box {
    padding: 1.4rem 1.6rem;
  }

  .chip,
  .task-check {
    min-height: var(--rq-touch);
  }

  /* "면접 분위기" 칩 3개가 한 줄에 들어가게 */
  .chip {
    padding: 0 1rem;
  }

  /* 체크 17개가 1열이면 약 900px로 질문 정리보다 길어진다. 2열 + 두 줄 이름 허용(DR-r3-04) */
  .task-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem 0.8rem;
  }

  .task-check {
    align-items: flex-start;
    gap: 0.6rem;
    padding: 1rem 1rem;
    line-height: 1.4;
  }

  /* 첫 줄 글자 가운데에 체크 상자를 맞춘다 */
  .task-check input {
    margin-top: 0.15rem;
  }

  /* 입력칸을 한 줄 전체로 쓰고 글자 수는 칸 아래 오른쪽에(DR-r1-08) */
  .field {
    grid-template-columns: minmax(0, 1fr);
  }

  .field-count {
    justify-self: end;
  }

  .review-bar {
    padding: 1.2rem 1.6rem;
  }

  .review-bar .make {
    width: 100%;
    min-height: var(--rq-touch);
  }
}
</style>
