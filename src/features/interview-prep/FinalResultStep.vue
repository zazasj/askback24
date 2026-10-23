<script setup lang="ts">
/**
 * S4 최종 ③ 최종 면접·처우 질문. 요약(확인됨·기대와 다름·아직 모름·회사가 먼저 물은 것 개수) + 순서 규칙대로 고른 질문.
 * 확인된 질문은 빠지고 처우 질문이 올라온다(추가 개발 노트 6·12절). 결과는 지원 건마다 저장되어 새로고침해도 그대로다.
 * 질문 카드·펼침·복사·👍는 1차와 같은 부품(QuestionCard)을 쓴다.
 */
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getAnalysis, getCard } from '@shared/catalog'
import type { FinalQuestion, Posting, ReviewState } from '@shared/contract'
import MockModeTag from '@/components/ui/MockModeTag.vue'
import { useCopy } from '@/composables/useCopy'
import { usePrepStore } from '@/stores/prep'
import { finalKey, useQuestionsStore } from '@/stores/questions'
import { useReviewStore } from '@/stores/review'
import GeneratingView from './GeneratingView.vue'
import { prefOf } from './picks'
import QuestionCard from './QuestionCard.vue'
import { FINAL_TONES, evidenceLabel, finalMeta, finalTypeLabel, offerMeta } from './questionView'
import { MOOD_LABELS, STATE_LABELS, isTouched } from './review'

const props = defineProps<{ applyId: string; posting: Posting }>()
const emit = defineEmits<{ edit: []; first: []; remake: [] }>()

const route = useRoute()
const prep = usePrepStore()
const store = useQuestionsStore()
const review = useReviewStore()
const { copy } = useCopy()

const hasFirst = computed(() => !!store.firstOf(props.applyId))
const generating = computed(() => store.isGeneratingFinal(props.applyId))
const failed = computed(() => store.hasFailedFinal(props.applyId))
const result = computed(() => store.finalOf(props.applyId))
const questions = computed<FinalQuestion[]>(() => result.value?.response.final_questions ?? [])
const draft = computed(() => review.draftOf(props.applyId))
/** 정리 입력은 메모리에만 있어 새로고침 뒤에는 다시 만들 수 없다 */
const canRemake = computed(() => isTouched(draft.value))

const templateCount = computed(() => questions.value.filter((q) => q.source === 'template').length)
const allTemplate = computed(() => questions.value.length > 0 && templateCount.value === questions.value.length)
const ruleJudged = computed(() => {
  const states = result.value?.response.card_states ?? []
  return states.length > 0 && states.every((s) => s.source === 'rule')
})

// 만드는 중 ↔ 결과가 바뀔 때 누른 버튼이 사라지므로 초점을 제목으로 옮긴다
const title = useTemplateRef<HTMLElement>('title')
watch(generating, async () => {
  await nextTick()
  title.value?.focus()
})

// ── 요약 ─────────────────────────────────────────────
const SUMMARY_NOTES: Record<ReviewState, string> = {
  confirmed: '질문에서 뺐어요',
  mismatch: '범위를 다시 확인해요',
  still_unknown: '한 번 더 물어요',
  company_signal: '맡게 될지 확인해요',
}
const SUMMARY_ORDER: readonly ReviewState[] = ['confirmed', 'mismatch', 'still_unknown', 'company_signal']

const summaryRows = computed(() => {
  const res = result.value?.response
  if (!res) return []
  return SUMMARY_ORDER.map((state) => ({
    state,
    label: STATE_LABELS[state],
    count: res.summary[state],
    cards: res.card_states
      .filter((s) => s.state === state && s.basis !== '')
      .map((s) => getCard(s.card_id)?.label ?? s.card_id),
    note: SUMMARY_NOTES[state],
  }))
})

// ── 질문 카드 ─────────────────────────────────────────
const analysis = computed(() => getAnalysis(props.posting.wantedAuthNo))
const picks = computed(() => prep.selectionOf(props.applyId).picks)
const stateLabelOf = (cardId: string) => {
  const s = result.value?.response.card_states.find((c) => c.card_id === cardId)?.state
  return s ? STATE_LABELS[s] : undefined
}
const offerLabelOf = (q: FinalQuestion) => {
  const blank = analysis.value?.blanks.find((b) => b.topic === q.topic)
  return blank ? offerMeta(blank) : undefined
}

function metaOf(q: FinalQuestion): string {
  return finalMeta(q, q.card_id ? prefOf(picks.value, q.card_id) : null, q.card_id ? stateLabelOf(q.card_id) : undefined, offerLabelOf(q))
}

/** ① 형광펜은 카드 근거에만 있다(D-033). 처우 질문 근거는 링크 없이 글로만 */
function evidenceTo(q: FinalQuestion) {
  if (!q.card_id || !q.evidence) return undefined
  const marked = analysis.value?.cards.some((c) => c.card_id === q.card_id && c.evidence)
  return marked ? { query: { ...route.query, step: '1', card: q.card_id } } : undefined
}

const kept = computed(() => new Set(result.value?.kept ?? []))

const moodNote = computed(() => {
  const mood = draft.value.mood
  if (mood === 'pressured') return `면접 분위기가 "${MOOD_LABELS.pressured}"라고 해서 조심스럽게 여쭙는 문장을 앞에 붙였어요.`
  if (mood === 'relaxed') return `면접 분위기가 "${MOOD_LABELS.relaxed}"라고 해서 앞말 없이 바로 묻는 문장으로 썼어요.`
  return ''
})

function copyAll(): void {
  const head = `${props.posting.corpNm} · ${props.posting.wantedTitle}\n최종 면접·처우 질문`
  const body = questions.value.map((q, i) => `${i + 1}. [${finalTypeLabel(q.type)}] ${q.text}`).join('\n')
  void copy(`${head}\n\n${body}`)
}

function printSheet(): void {
  window.print()
}

const FINAL_STAGES = ['1차 면접 정리 확인', '질문 순서 정하기', 'AI가 문장 쓰는 중'] as const
</script>

<template>
  <section class="final-step" aria-labelledby="final-title">
    <div class="intro">
      <div class="title-row">
        <h2 id="final-title" ref="title" class="section-title" tabindex="-1">최종 면접·처우 질문</h2>
        <MockModeTag />
      </div>
      <p v-if="generating" class="lead">1차 면접에서 정리한 것을 내 기대와 맞대 보고 있어요.</p>
      <p v-else-if="questions.length" class="lead">
        확인된 것은 빼고, 남은 것과 처우 질문을 묻기 좋은 순서로 {{ questions.length }}개 골랐어요.
      </p>
    </div>

    <GeneratingView v-if="generating" :count="6" :stages="FINAL_STAGES" />

    <template v-else-if="result">
      <p class="sr-only" aria-live="polite">최종 질문 {{ questions.length }}개를 만들었어요.</p>

      <!-- ③은 질문이 주인공: 요약은 한 줄 개수 띠, 카드별 내용·뜻은 펼침 안(DR-r1-09) -->
      <section class="summary" aria-labelledby="summary-title" data-print="hide">
        <div class="summary-head">
          <h3 id="summary-title" class="summary-title">1차 면접 정리 결과</h3>
          <ul class="summary-strip">
            <li v-for="row in summaryRows" :key="row.state" class="stat" :class="`is-${row.state}`">
              <span class="stat-label">{{ row.label }}</span> <strong class="stat-count">{{ row.count }}</strong>
            </li>
          </ul>
        </div>
        <p class="summary-foot">"기대와 다름"은 회사의 흠이 아니라 내 기대와 다르다는 뜻이에요. 점수는 매기지 않아요.</p>
        <details class="summary-more">
          <summary class="summary-toggle">카드별로 보기</summary>
          <dl class="summary-grid">
            <div v-for="row in summaryRows" :key="row.state" class="stat-box" :class="`is-${row.state}`">
              <dt class="stat-box-label">{{ row.label }} {{ row.count }}개</dt>
              <dd class="stat-cards">{{ row.cards.length ? row.cards.join(', ') : '없음' }}</dd>
              <dd v-if="row.count > 0" class="stat-note">{{ row.note }}</dd>
            </div>
          </dl>
        </details>
      </section>

      <p v-if="allTemplate" class="notice is-fallback">
        AI 응답을 받지 못해 미리 검수한 문장으로 보여 드려요. 질문 순서와 근거는 같아요.
      </p>
      <p v-else-if="templateCount > 0" class="notice is-fallback">
        질문 {{ templateCount }}개는 AI 문장이 검사를 통과하지 못해 미리 검수한 문장으로 바꿨어요.
      </p>
      <p v-if="ruleJudged" class="notice is-fallback">
        들은 답 판정도 단순 규칙(구체적 → 확인됨, 모호하거나 못 물음 → 아직 모름)으로 했어요. "기대와 다름"은 AI가 답을 읽어야 나와요.
      </p>

      <div class="result-layout">
        <ol class="questions" aria-label="최종 면접·처우 질문 목록">
          <QuestionCard
            v-for="q in questions"
            :key="finalKey(q)"
            :rank="q.rank"
            :type-label="finalTypeLabel(q.type)"
            :tone="FINAL_TONES[q.type]"
            :meta="metaOf(q)"
            :text="q.text"
            :has-exp="false"
            :template="q.source === 'template'"
            :kept="kept.has(finalKey(q))"
            :basis="q.basis"
            :evidence-label="evidenceLabel(q.evidence)"
            :evidence-to="evidenceTo(q)"
            :watch-out="q.watch_out"
            :good-sign="q.good_sign"
            @copy="copy(q.text)"
            @keep="store.toggleFinalKept(applyId, finalKey(q))"
          />
        </ol>

        <aside class="result-side" aria-labelledby="final-side-title" data-print="hide">
          <div class="side-box">
            <h3 id="final-side-title" class="side-title">1차 면접 정리</h3>
            <p v-if="moodNote" class="side-line side-mood">{{ moodNote }}</p>
            <p class="side-line">정리를 고치면 최종 질문을 다시 만들 수 있어요.</p>
            <button type="button" class="btn btn-tertiary side-btn" @click="emit('edit')">1차 면접 정리 고치기</button>
            <button v-if="canRemake" type="button" class="btn btn-tertiary side-btn" @click="emit('remake')">AI로 다시 만들기</button>
          </div>
          <div class="side-box">
            <button type="button" class="btn btn-accent-outline side-btn" @click="copyAll">전체 복사</button>
            <button type="button" class="btn btn-tertiary side-btn" @click="printSheet">면접에 들고 갈 한 장 인쇄</button>
            <RouterLink class="about-link tap-target" to="/about-ai">이 질문은 어떻게 만들어지나요</RouterLink>
          </div>
        </aside>
      </div>
    </template>

    <div v-else-if="!hasFirst" class="empty">
      <p class="empty-title">먼저 1차 면접 질문을 만들어 주세요</p>
      <p>1차 면접 질문을 만들고 면접을 다녀온 뒤 정리하면, 최종 면접·처우 질문을 만들어 드려요.</p>
      <div class="empty-actions">
        <button type="button" class="btn btn-accent" @click="emit('first')">1차 면접 질문 만들기</button>
      </div>
    </div>

    <div v-else-if="failed" class="empty">
      <p>최종 질문을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
      <div class="empty-actions">
        <button v-if="canRemake" type="button" class="btn btn-accent" @click="emit('remake')">AI로 다시 만들기</button>
        <button type="button" class="btn btn-tertiary" @click="emit('edit')">1차 면접 정리하기</button>
      </div>
    </div>

    <div v-else class="empty">
      <p>아직 1차 면접을 정리하지 않았어요. 물어본 것과 들은 답을 정리하면 최종 질문을 만들어 드려요.</p>
      <div class="empty-actions">
        <button type="button" class="btn btn-accent" @click="emit('edit')">1차 면접 정리하기</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.final-step {
  display: grid;
  gap: 2rem;
}

.intro {
  display: grid;
  gap: 0.6rem;
}

.section-title:focus {
  outline: none;
}

.section-title:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.2rem;
}

.lead {
  color: var(--krds-light-color-text-subtle);
}

.sub-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

/* ── 요약 ─────────────────────────────────────────── */
.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1.2rem;
}

.summary {
  display: grid;
  gap: 0.6rem;
  padding: 1.2rem 1.6rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.summary-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1.6rem;
}

.summary-title {
  font-size: var(--krds-pc-font-size-label-medium);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.6rem;
}

/* 색은 점으로만 덧붙이고 뜻은 글자가 말한다. 확인됨 초록 · 기대와 다름 우리 기능 보라(위험의 빨강이 아님, DR-r1-13) · 아직 모름 노랑 · 회사가 먼저 물은 것 파랑 */
.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.stat::before {
  content: '';
  flex: none;
  align-self: center;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background: var(--stat-color, var(--krds-light-color-border-gray));
}

.stat-count {
  font-size: var(--krds-pc-font-size-label-large);
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.is-confirmed {
  --stat-color: var(--krds-light-color-border-success);
}

.is-mismatch {
  --stat-color: var(--rq-accent);
}

.is-still_unknown {
  --stat-color: var(--krds-light-color-border-warning);
}

.is-company_signal {
  --stat-color: var(--krds-light-color-border-information);
}

.summary-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 3.2rem;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--rq-accent-strong);
  cursor: pointer;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 0.6rem;
}

.stat-box {
  display: grid;
  align-content: start;
  gap: 0.2rem;
  padding: 1.2rem 1.4rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-top: 0.4rem solid var(--stat-color, var(--krds-light-color-border-gray));
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-white);
}

.stat-box-label {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.stat-cards {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.stat-note,
.summary-foot {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

/* ── 안내 ─────────────────────────────────────────── */
.notice {
  padding: 1.2rem 1.6rem;
  border-left: 0.4rem solid var(--krds-light-color-border-gray-dark);
  border-radius: var(--krds-radius-medium1);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.notice.is-fallback {
  border-left-color: var(--krds-light-color-text-warning);
  background: var(--krds-light-color-surface-warning-subtler);
}

/* ── 질문·오른쪽 상자 ─────────────────────────────── */
.result-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 26rem;
  align-items: start;
  gap: 2.4rem;
}

.questions {
  display: grid;
  gap: 1.2rem;
}

.result-side {
  position: sticky;
  top: 1.6rem;
  display: grid;
  gap: 1.2rem;
}

.side-box {
  display: grid;
  gap: 0.8rem;
  padding: 1.6rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.side-title {
  font-size: var(--krds-pc-font-size-label-medium);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.side-line {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.side-mood {
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  color: var(--krds-light-color-text-basic);
}

.side-btn {
  width: 100%;
}

.about-link {
  justify-self: start;
  margin-top: 0.4rem;
  font-size: var(--krds-pc-font-size-body-small);
  font-weight: 700;
  color: var(--krds-light-color-text-primary);
  text-decoration: underline;
  text-underline-offset: 0.3rem;
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

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.8rem;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .result-side {
    position: static;
    grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
  }
}

@media (max-width: 767px) {
  .summary {
    padding: 1.2rem 1.4rem;
  }

  .summary-toggle {
    min-height: var(--rq-touch);
  }

  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .result-side {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-btn {
    min-height: var(--rq-touch);
  }
}

@media print {
  .final-step {
    gap: 0.8rem;
  }

  .result-layout {
    display: block;
  }

  .questions {
    gap: 0.6rem;
  }
}
</style>
