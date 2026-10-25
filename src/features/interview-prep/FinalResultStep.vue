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
import { keptFirst } from './printOrder'
import { FINAL_TONES, evidenceLabel, finalMetaParts, finalTypeLabel, finalTypeNote, type MetaParts } from './questionView'
import { MOOD_LABELS, STATE_LABELS, isTouched, ruleJudgedAskedCount } from './review'

const props = defineProps<{ applyId: string; posting: Posting }>()
const emit = defineEmits<{ edit: []; first: []; remake: [] }>()

const route = useRoute()
const prep = usePrepStore()
const store = useQuestionsStore()
const review = useReviewStore()
const { copy } = useCopy()

const hasFirst = computed(() => !!store.firstOf(props.applyId))
/** 1차 질문을 만드는 중에 머리 라디오로 최종으로 바꾸면 아직 결과가 없다 — ②로 돌려보내지 않는다 */
const firstGenerating = computed(() => store.isGenerating(props.applyId))
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
/** 일부만 규칙 판정이어도 규칙 결과가 AI 판정으로 보이지 않게 개수를 알린다 */
const ruleAskedCount = computed(() => ruleJudgedAskedCount(result.value?.response.card_states ?? []))

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
function metaOf(q: FinalQuestion): MetaParts {
  const blank = q.card_id ? undefined : analysis.value?.blanks.find((b) => b.topic === q.topic)
  return finalMetaParts(q, q.card_id ? prefOf(picks.value, q.card_id) : null, q.card_id ? stateLabelOf(q.card_id) : undefined, blank)
}

// ── 소제목 두 묶음(H1-12) ────────────────────────────────
// 처우 질문까지 한 목록에 같은 무게로 있으면 임원 면접에서 다 물을 것처럼 읽힌다. 순서 규칙(API-07)은 그대로 두고
// 화면에서만 "최종 면접에서 물을 것"과 "처우 협의 때 물을 것"으로 나눈다(묶음 안 순서는 규칙 순서, 번호는 보이는 순서)
interface QuestionGroup {
  key: 'interview' | 'offer'
  title: string
  note: string
  items: Array<{ q: FinalQuestion; no: number }>
}

const groups = computed<QuestionGroup[]>(() => {
  const asks = questions.value.filter((q) => q.type !== 'offer')
  const offers = questions.value.filter((q) => q.type === 'offer')
  const out: QuestionGroup[] = [
    { key: 'interview', title: '최종 면접에서 물을 것', note: '최종 면접에서는 보통 한두 개만 물을 수 있어요. 꼭 물을 질문부터 골라 두세요.', items: [] },
    { key: 'offer', title: '처우 협의 때 물을 것', note: '근로조건은 합격 뒤 처우 협의 자리에서 물어도 돼요.', items: [] },
  ]
  let no = 0
  for (const q of asks) out[0]?.items.push({ q, no: ++no })
  for (const q of offers) out[1]?.items.push({ q, no: ++no })
  return out.filter((g) => g.items.length > 0)
})

/** 인쇄·전체 복사 순서: 묶음마다 "면접에서 쓸 것 같아요"를 누른 질문이 맨 위(H1-14) */
const sheetGroups = computed(() =>
  groups.value.map((g) => ({ ...g, items: keptFirst(g.items, (it) => kept.value.has(finalKey(it.q))) })),
)
const printNoOf = computed(() => {
  const map = new Map<string, number>()
  let n = 0
  for (const g of sheetGroups.value) for (const it of g.items) map.set(finalKey(it.q), ++n)
  return map
})

/** 최종 질문을 만든 뒤 1차를 다시 만들었으면 최종 질문은 그 전 1차 기준이다(H2-04 ④) */
const finalBehind = computed(() => store.finalBehindFirst(props.applyId))

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

// 복사 글에는 유형 꼬리표("[처우 확인]")를 붙이지 않고 소제목만 둔다(H2-01 ②·H1-12)
function copyAll(): void {
  const head = `${props.posting.corpNm} · ${props.posting.wantedTitle}\n최종 면접·처우 질문`
  let n = 0
  const body = sheetGroups.value.map((g) => [g.title, ...g.items.map((it) => `${++n}. ${it.q.text}`)].join('\n')).join('\n\n')
  void copy(`${head}\n\n${body}`)
}

function printSheet(): void {
  window.print()
}

const FINAL_STAGES = ['1차 면접 정리 확인', '질문 순서 정하기', 'AI가 문장 쓰는 중'] as const

/** 고용노동부 「개정 표준 근로계약서」 게시 글(2025-03-07, 근로기준정책과). 2026-10-25 열어 내려받기 파일 확인(H1-21) */
const STANDARD_CONTRACT_URL = 'https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20250300356'
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
        들은 답 판정도 단순 규칙(구체적 → 확인됨, 걱정한 업무이거나 모호하거나 못 물음 → 아직 모름)으로 했어요. "기대와 다름"은 AI가 답을 읽어야 나와요.
      </p>
      <p v-else-if="ruleAskedCount > 0" class="notice is-fallback">
        카드 {{ ruleAskedCount }}개는 단순 규칙으로 판정했어요. "기대와 다름"은 AI가 답을 읽어야 나와요.
      </p>

      <p v-if="finalBehind" class="notice" data-print="hide">
        최종 질문은 이전 1차 질문 기준이에요. 새 1차 질문으로 바꾸려면 "1차 면접 정리 고치기"에서 다시 정리해 주세요.
      </p>

      <div class="result-layout">
        <div class="question-groups">
          <section v-for="g in groups" :key="g.key" class="q-group" :aria-labelledby="`final-group-${g.key}`">
            <div class="group-head">
              <h3 :id="`final-group-${g.key}`" class="group-title">{{ g.title }}</h3>
              <p class="group-note" data-print="hide">{{ g.note }}</p>
            </div>
            <ol class="questions" :aria-label="`${g.title} 목록`">
              <QuestionCard
                v-for="it in g.items"
                :key="finalKey(it.q)"
                :rank="it.no"
                :print-no="printNoOf.get(finalKey(it.q))"
                :type-label="finalTypeLabel(it.q.type)"
                :tone="FINAL_TONES[it.q.type]"
                :meta-name="metaOf(it.q).name"
                :meta-tail="metaOf(it.q).tail"
                :text="it.q.text"
                :has-exp="false"
                :template="it.q.source === 'template'"
                :kept="kept.has(finalKey(it.q))"
                :basis="it.q.basis"
                :evidence-label="evidenceLabel(it.q.evidence)"
                :evidence-to="evidenceTo(it.q)"
                :watch-out="it.q.watch_out"
                :good-sign="it.q.good_sign"
                :type-note="finalTypeNote(it.q.type)"
                @copy="copy(it.q.text)"
                @keep="store.toggleFinalKept(applyId, finalKey(it.q))"
              />
            </ol>
          </section>
        </div>

        <aside class="result-side" aria-labelledby="final-side-title" data-print="hide">
          <div class="side-box">
            <h3 id="final-side-title" class="side-title">1차 면접 정리</h3>
            <p v-if="moodNote" class="side-line side-mood">{{ moodNote }}</p>
            <p class="side-line">정리를 고치면 최종 질문을 다시 만들 수 있어요.</p>
            <button type="button" class="btn btn-tertiary side-btn" @click="emit('edit')">1차 면접 정리 고치기</button>
            <button v-if="canRemake" type="button" class="btn btn-tertiary side-btn" @click="emit('remake')">AI로 다시 만들기</button>
          </div>
          <div class="side-box">
            <p class="side-line">꼭 물을 질문에 "면접에서 쓸 것 같아요"를 누르면 인쇄·복사 때 맨 위에 와요.</p>
            <RouterLink class="about-link tap-target" to="/about-ai">이 질문은 어떻게 만들어지나요</RouterLink>
          </div>
          <!-- 처우 질문 뒤 공공 정보로 잇는다(H1-21). 이 상자는 인쇄하지 않아 링크 주소도 종이에 찍히지 않는다 -->
          <div class="side-box">
            <p class="side-line">근로계약서에 꼭 적혀야 할 항목(임금·근로시간·휴일 등)은 표준근로계약서에서 볼 수 있어요.</p>
            <a class="about-link tap-target" :href="STANDARD_CONTRACT_URL" target="_blank" rel="noopener noreferrer">
              고용노동부 표준근로계약서<span class="sr-only"> (새 창)</span>
            </a>
          </div>
        </aside>
      </div>

      <!-- 질문 7~8개로 끝나지 않게 다음 할 일을 둔다(H2-13). 1차 ③ "1차 면접을 다녀오면"과 같은 모양, 인쇄하지 않음 -->
      <section class="next-box" aria-labelledby="final-next-title" data-print="hide">
        <h3 id="final-next-title" class="next-title">최종 면접을 다녀오면</h3>
        <p>
          들은 답이 기대와 달랐던 것은 처우 협의 때 한 번 더 물어보세요. 합격하면 서명하기 전에 근로계약서에 들은 조건이 그대로
          적혔는지 확인해 보세요.
        </p>
      </section>

      <!-- 아래 고정 바(1차 ③ .result-bar와 같은 모양, H2-08 나): "전체 복사"는 1차와 같은 자리, 채운 버튼은 면접에 들고 갈 한 장 -->
      <div class="result-bar" data-print="hide">
        <p class="result-bar-note">최종 질문 <strong>{{ questions.length }}개</strong>를 만들었어요</p>
        <div class="result-bar-actions">
          <button type="button" class="btn btn-tertiary btn-lg" @click="copyAll">전체 복사</button>
          <button type="button" class="btn btn-accent btn-lg" @click="printSheet">면접에 들고 갈 한 장 인쇄</button>
        </div>
      </div>
    </template>

    <div v-else-if="firstGenerating" class="empty">
      <p class="empty-title">1차 질문을 만들고 있어요</p>
    </div>

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

.question-groups {
  display: grid;
  gap: 2rem;
  min-width: 0;
}

.q-group {
  display: grid;
  gap: 1rem;
}

.group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 1.2rem;
}

.group-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.group-note {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

/* ── 다음 할 일(1차 ③ .next-box와 같은 모양) ───────────── */
.next-box {
  display: grid;
  gap: 0.4rem;
  padding: 1.6rem 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.next-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.next-box p {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

/* ── 아래 고정 바(1차 ③ .result-bar와 같은 모양) ───────── */
.result-bar {
  position: sticky;
  bottom: 0.8rem;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 2rem;
  padding: 1.2rem 1.6rem 1.2rem 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  box-shadow: var(--rq-shadow-pop);
}

.result-bar-note {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.result-bar-note strong {
  color: var(--rq-accent-strong);
}

.result-bar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-left: auto;
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

  .next-box {
    padding: 1.4rem 1.6rem;
  }

  /* 휴대폰: 바가 화면을 덜 가리게 버튼 두 개만 한 줄로(1차 ③과 같음) */
  .result-bar {
    padding: 1rem;
  }

  .result-bar-note {
    display: none;
  }

  .result-bar-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    width: 100%;
    margin-left: 0;
  }

  .result-bar-actions .btn {
    min-height: var(--rq-touch);
    padding: 0 0.8rem;
    font-size: var(--krds-pc-font-size-label-small);
  }
}

@media print {
  .final-step {
    gap: 0.8rem;
  }

  .question-groups {
    gap: 0.6rem;
  }

  .q-group {
    gap: 0.4rem;
  }

  .group-title {
    font-size: 10pt;
  }

  /* 인쇄물에서는 질문 수 안내 문장보다 질문이 먼저 */
  .intro .lead {
    display: none;
  }

  .result-layout {
    display: block;
  }

  .questions {
    gap: 0.5rem;
  }

  /* 최종은 질문이 7~8개라 1차(5개)와 같은 크기면 A4 2쪽이 된다(DA-01). 질문 글자와 "들은 답" 칸을 조금 줄여 한 장에 */
  .questions :deep(.question) {
    gap: 0.4rem;
    padding: 0.8rem 1.2rem;
  }

  .questions :deep(.q-text) {
    font-size: 10pt;
    line-height: 1.5;
  }

  .questions :deep(.print-memo) {
    min-height: 1cm;
  }

  .questions :deep(.print-memo-label) {
    font-size: 8pt;
  }
}
</style>
