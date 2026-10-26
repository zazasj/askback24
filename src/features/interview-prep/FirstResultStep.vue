<script setup lang="ts">
/**
 * S4 ③ 1차·기술 면접 질문. ②에서 "질문 만들기"를 누르면 만드는 중 → 질문 5개.
 * 결과는 지원 건마다 저장되어 새로고침해도 그대로다. 결과가 없이 이 단계를 열면 지금 선택으로 바로 만든다.
 * 처우 질문은 여기서 주지 않는다(D-012). 1차 면접을 다녀오면 최종 단계로 넘긴다.
 * 아래 고정 바는 ①②처럼 다음 단계("면접 다녀왔어요") 하나만(F-05). "전체 복사"·인쇄는 오른쪽 상자에 하나씩(RS-02),
 * 상자가 질문 아래로 쌓이는 폭에서는 그 둘만 질문 위로 올린다(RS-03).
 */
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CARD_BOOK, getAnalysis, getCard } from '@shared/catalog'
import type { Posting, Question } from '@shared/contract'
import { interviewRounds } from '@shared/interviews'
import { QUESTION_LIMIT, pickExplore, typeLabel } from '@shared/rules'
import { API_MODE } from '@/api/client'
import MockModeTag from '@/components/ui/MockModeTag.vue'
import { useCopy } from '@/composables/useCopy'
import { FIRST_RESULT_TOUR } from '@/features/tour/tourSteps'
import { useScreenTour } from '@/features/tour/useScreenTour'
import { usePrepStore } from '@/stores/prep'
import { useQuestionsStore } from '@/stores/questions'
import { exploreTag } from './checkpoints'
import { firstCopyText } from './copyText'
import GeneratingView from './GeneratingView.vue'
import { PREFS, countByPref, toCardPicks } from './picks'
import QuestionCard from './QuestionCard.vue'
import { FIRST_TONES, evidenceLabel, firstMetaParts, firstTypeNote } from './questionView'

const props = defineProps<{ applyId: string; posting: Posting; apiFail?: boolean }>()
const emit = defineEmits<{ change: []; review: [] }>()

const route = useRoute()
const prep = usePrepStore()
const store = useQuestionsStore()
const { copy } = useCopy()

const selection = computed(() => prep.selectionOf(props.applyId))
const generating = computed(() => store.isGenerating(props.applyId))
const result = computed(() => store.firstOf(props.applyId))
const questions = computed<Question[]>(() => result.value?.response.questions ?? [])
const failed = computed(() => store.hasFailed(props.applyId))
/** 면접이 한 번인 공고(H3-r2-03) */
const singleInterview = computed(() => interviewRounds(props.posting.selMthd) === 1)
const stale = computed(() => !!result.value && !store.isCurrent(props.applyId, props.posting.wantedAuthNo))

const seeded = computed(() => result.value?.seed === true)
const templateCount = computed(() => questions.value.filter((q) => q.source === 'template').length)
const allTemplate = computed(() => questions.value.length > 0 && templateCount.value === questions.value.length)

// 질문을 다 만든 뒤 이 화면 안내(TR-02). 만드는 중·빈 화면에는 띄우지 않는다
useScreenTour('prep-first', () => [...FIRST_RESULT_TOUR], { ready: () => !generating.value && questions.value.length > 0, titleId: 'result-title' })

function make(): void {
  void store.makeFirst(props.applyId, props.posting.wantedAuthNo, { apiFail: props.apiFail === true })
}

onMounted(() => {
  // 주소로 바로 열었거나 새로고침 때 결과가 없으면 지금 선택으로 만든다
  if (!generating.value && !result.value && selection.value.picks.length > 0) make()
})

// 만드는 중 ↔ 결과가 바뀔 때 누른 버튼이 사라지므로 초점을 제목으로 옮긴다
const title = useTemplateRef<HTMLElement>('title')
watch(generating, async () => {
  await nextTick()
  title.value?.focus()
})

// ── 질문 카드 ─────────────────────────────────────────
function evidenceTo(q: Question) {
  return q.evidence ? { query: { ...route.query, step: '1', card: q.card_id } } : undefined
}

/** 최종 질문을 만든 뒤 1차를 다시 만들었으면 최종 질문은 그 전 1차 기준이다(H2-04 ④) */
const finalBehind = computed(() => store.finalBehindFirst(props.applyId))

// ── 오른쪽: 내가 고른 것 · 전체 동작 ──────────────────────
const breakdown = computed(() => {
  const n = countByPref(selection.value.picks)
  return PREFS.map((p) => `${CARD_BOOK.preference_options[p]} ${n[p]}`)
})

/**
 * 고른 카드 중 질문이 되지 않은 것(5개 한도에서 밀림, A2-13). 선택이 바뀐 뒤(stale)에는 결과와 비교할 수 없어 숨긴다.
 * 어떤 선호·공고 상태든 규칙이 있어(cards.backend.json gap_rules) 빠지는 까닭은 개수 한도뿐이다
 */
/**
 * "더 알아볼 질문"(U-03, D-176): 질문 5개에 들지 못한 "모르겠어요" 카드의 탐색 질문(검수 문장) 최대 3개.
 * 선택이 바뀐 뒤(stale)에는 질문 5개와 맞지 않아 숨긴다. 인쇄 한 장(Q-02)에는 넣지 않는다.
 */
const explores = computed(() => {
  if (stale.value || !questions.value.length) return []
  const analysis = getAnalysis(props.posting.wantedAuthNo)
  if (!analysis) return []
  const made = new Set(questions.value.map((q) => q.card_id))
  return pickExplore({ picks: toCardPicks(selection.value), experience: selection.value.experience }, analysis)
    .filter((r) => !made.has(r.card_id))
    .map((r) => ({ card_id: r.card_id, label: getCard(r.card_id)?.label ?? r.card_id, tag: exploreTag(analysis, r.card_id), text: r.template_text }))
})

const DROPPED_SHOWN = 3
const dropped = computed(() => {
  if (stale.value || !questions.value.length) return []
  const made = new Set([...questions.value.map((q) => q.card_id), ...explores.value.map((e) => e.card_id)])
  return selection.value.picks.filter((p) => !made.has(p.card_id)).map((p) => getCard(p.card_id)?.label ?? p.card_id)
})
const droppedLine = computed(() => {
  const list = dropped.value
  const shown = list.slice(0, DROPPED_SHOWN).join(', ')
  return list.length > DROPPED_SHOWN ? `${shown} 외 ${list.length - DROPPED_SHOWN}개` : shown
})

// 화면 순서 그대로, 더 알아볼 질문은 끝에 소제목 아래(RS-04). 인쇄 한 장에는 더 알아볼 질문을 넣지 않는다(Q-02)
function copyAll(): void {
  const head = `${props.posting.corpNm} · ${props.posting.wantedTitle}\n1차·기술 면접 질문`
  void copy(
    firstCopyText(
      head,
      questions.value.map((q) => q.text),
      explores.value.map((e) => e.text),
    ),
  )
}

function printSheet(): void {
  window.print()
}
</script>

<template>
  <section class="result-step" aria-labelledby="result-title">
    <div class="intro">
      <div class="title-row">
        <h2 id="result-title" ref="title" class="section-title" tabindex="-1">1차·기술 면접 질문</h2>
        <MockModeTag />
      </div>
      <p v-if="generating" class="lead">고른 카드와 공고를 맞춰 보고 있어요.</p>
      <p v-else-if="questions.length" class="lead">
        고른 카드 {{ selection.picks.length }}개 중 공고와 차이가 큰 순서로 {{ questions.length }}개를 골랐어요.
      </p>
    </div>

    <GeneratingView v-if="generating" />

    <template v-else-if="questions.length">
      <p class="sr-only" aria-live="polite">질문 {{ questions.length }}개를 만들었어요.</p>
      <p v-if="seeded" class="notice">
        시연용 예시 지원 건이라 예시 구직자 A의 1차 질문을 미리 검수한 문장으로 만들어 두었어요. "AI로 다시 만들기"를 누르면
        {{ API_MODE === 'mock' ? '새 문장으로' : 'AI 문장으로' }} 바꿔요.
      </p>
      <p v-else-if="allTemplate" class="notice is-fallback">
        AI 응답을 받지 못해 미리 검수한 문장으로 보여 드려요. 질문 순서와 근거는 같아요.
      </p>
      <p v-else-if="templateCount > 0" class="notice is-fallback">
        질문 {{ templateCount }}개는 AI 문장이 검사를 통과하지 못해 미리 검수한 문장으로 바꿨어요.
      </p>
      <p v-if="stale" class="notice" data-print="hide">
        고른 카드나 경험이 바뀌었어요. 바뀐 선택으로 보려면 "AI로 다시 만들기"를 눌러 주세요.
      </p>
      <p v-if="finalBehind" class="notice" data-print="hide">
        최종 질문은 이전 1차 질문 기준이에요. 새 1차 질문으로 최종 질문을 만들려면 1차 면접 정리를 다시 해 주세요.
      </p>

      <div class="result-layout">
        <div class="questions-col">
          <ol class="questions" aria-label="1차·기술 면접 질문 목록">
            <QuestionCard
              v-for="q in questions"
              :key="q.card_id"
              :rank="q.rank"
              :type-label="typeLabel(q.type)"
              :tone="FIRST_TONES[q.type]"
              :meta-name="firstMetaParts(q.card_id, q.type, !!q.evidence).name"
              :meta-tail="firstMetaParts(q.card_id, q.type, !!q.evidence).tail"
              :text="q.text"
              :has-exp="q.has_exp"
              :template="q.source === 'template'"
              :basis="q.basis"
              :evidence-label="evidenceLabel(q.evidence)"
              :evidence-to="evidenceTo(q)"
              :watch-out="q.watch_out"
              :good-sign="q.good_sign"
              :type-note="firstTypeNote(q.type)"
              data-tour="result-question"
            />
          </ol>
          <!-- 5개 한도로 빠진 카드(A2-13). 오른쪽 상자(sticky)에 넣으면 1440×900에서 상자가 화면 아래끝까지 늘어나
               F-02 시험이 아래 고정 바로 읽어 질문 목록 바로 아래에 둔다(휴대폰은 오른쪽 상자 바로 위라 같은 자리) -->
          <section v-if="explores.length" class="explore-box" aria-labelledby="explore-title" data-print="hide">
            <h3 id="explore-title" class="explore-title">더 알아볼 질문</h3>
            <p class="explore-lead">
              "모르겠어요"로 고른 일 중 이 공고와 가까운 것부터 골랐어요. 모르는 일을 물어보는 건 감점이 아니라 배우려는
              태도로 보여요.
            </p>
            <ul class="explore-list" aria-label="더 알아볼 질문 목록">
              <li v-for="e in explores" :key="e.card_id" class="explore-item">
                <p class="explore-meta">
                  <span class="explore-chip">탐색</span>
                  <span>{{ e.label }} · 모르겠어요</span>
                  <span v-if="e.tag" class="explore-in">{{ e.tag }}</span>
                </p>
                <p class="explore-text">{{ e.text }}</p>
              </li>
            </ul>
          </section>
          <p v-if="dropped.length" class="dropped" data-print="hide">
            질문에서 빠진 것: {{ droppedLine }} ({{ QUESTION_LIMIT }}개까지만 만들어요)
          </p>
        </div>

        <!-- 오른쪽 상자 둘: 데스크톱은 함께 오른쪽에서 따라오고(sticky), 쌓이는 폭(1100px 이하)에서는 묶음을 풀어
             복사·인쇄 상자만 질문 위로 올린다(RS-03). 버튼은 화면 전체에서 하나씩이라 두 번 그리지 않는다 -->
        <div class="side-col" data-print="hide">
          <aside class="side-box side-tools" aria-label="복사·인쇄" data-print="hide" data-tour="result-tools">
            <div class="side-actions">
              <button type="button" class="btn btn-tertiary side-btn" @click="copyAll">전체 복사</button>
              <button type="button" class="btn btn-tertiary side-btn" @click="printSheet">면접에 들고 갈 한 장 인쇄</button>
            </div>
            <!-- 실제로는 한두 개만 물을 수 있다는 안내와 꺼낼 순서(H1-14·H2-15 ③) -->
            <p class="side-line side-tip">면접에서는 보통 한두 개만 물을 수 있어요. 기대되는 일을 묻는 질문부터 꺼내도 좋아요.</p>
          </aside>
          <aside class="side-box side-more" aria-labelledby="side-title" data-print="hide">
            <h3 id="side-title" class="side-title">내가 고른 것</h3>
            <p class="side-line">
              <template v-for="(part, i) in breakdown" :key="part">
                <span v-if="i > 0" aria-hidden="true"> · </span>
                <span class="nowrap">{{ part }}</span>
              </template>
            </p>
            <p v-if="selection.experience" class="side-line side-exp">경험: {{ selection.experience }}</p>
            <button type="button" class="btn btn-tertiary side-btn" @click="emit('change')">선택 바꾸기</button>
            <button type="button" class="btn btn-tertiary side-btn" @click="make">AI로 다시 만들기</button>
            <RouterLink class="about-link tap-target" to="/about-ai">이 질문은 어떻게 만들어지나요</RouterLink>
          </aside>
        </div>
      </div>

      <section class="next-box" aria-labelledby="next-title" data-print="hide">
        <!-- 면접이 한 번인 공고(전형 방법에 "면접"이 한 단계)는 "1차·최종"이라 하지 않고 사실대로(H3-r2-03). 흐름은 그대로 -->
        <h3 id="next-title" class="next-title">{{ singleInterview ? '면접을 다녀오면' : '1차 면접을 다녀오면' }}</h3>
        <p v-if="singleInterview">
          이 공고는 면접이 한 번이에요. 면접에서 못 물은 것과 처우는 합격 뒤 처우 협의 때 물어보세요. 면접에 다녀와 아래
          "면접 다녀왔어요"를 누르면 그때 물을 질문을 만들어 드려요.
        </p>
        <p v-else>
          아래 "면접 다녀왔어요"를 눌러 물어본 질문과 들은 답을 정리해 주세요. 확인된 것은 빼고, 남은 것과 처우를 최종 면접
          질문으로 만들어 드려요.
        </p>
      </section>

      <!-- 아래 고정 바(①②와 같은 모양, F-05·RS-02): 다음 단계 "면접 다녀왔어요" 하나. 이 화면의 채운 버튼은 이것 하나(Q-04) -->
      <div class="result-bar" data-print="hide">
        <!-- 질문을 만든 바로 그 화면의 채운 버튼이라 잘못 누르지 않게 언제 누르는지 적는다(데스크톱, H2-18 가) -->
        <p class="result-bar-note"><strong>면접 다녀왔어요</strong>는 면접에 다녀온 뒤 눌러 주세요</p>
        <button type="button" class="btn btn-accent btn-lg result-bar-btn" data-tour="result-went" @click="emit('review')">면접 다녀왔어요</button>
      </div>
    </template>

    <div v-else-if="failed" class="empty">
      <p>질문을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
      <div class="empty-actions">
        <button type="button" class="btn btn-accent" @click="make">AI로 다시 만들기</button>
        <button type="button" class="btn btn-tertiary" @click="emit('change')">선택 바꾸기</button>
      </div>
    </div>

    <div v-else class="empty">
      <p>아직 고른 카드가 없어요. 기대되거나 걱정되는 업무를 골라 주세요.</p>
      <div class="empty-actions">
        <button type="button" class="btn btn-accent" @click="emit('change')">선택 바꾸기</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.result-step {
  display: grid;
  gap: 1.6rem;
}

/* 제목과 안내 한 줄을 같은 줄에(넓은 화면), 좁으면 아래로(N4) */
.intro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 1.6rem;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1.2rem;
}

/* 이 제목(tabindex="-1")의 초점 테두리는 base.css 가 없앤다(A3-r1-15) */

.lead {
  color: var(--krds-light-color-text-subtle);
}

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

/* 데스크톱: 오른쪽 상자 둘이 함께 따라온다(질문을 내려 읽는 동안 복사·인쇄가 손 닿는 곳에) */
.side-col {
  position: sticky;
  top: 1.6rem;
  display: grid;
  gap: 1rem;
}

.side-actions {
  display: grid;
  gap: 0.6rem;
}

.side-box {
  display: grid;
  gap: 0.6rem;
  padding: 1.4rem 1.6rem;
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
  color: var(--krds-light-color-text-basic);
}

.nowrap {
  white-space: nowrap;
}

.side-exp {
  color: var(--krds-light-color-text-subtle);
  overflow-wrap: anywhere;
}

.side-tip {
  color: var(--krds-light-color-text-subtle);
}

.questions-col {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.dropped {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

/* 더 알아볼 질문(U-03): 질문 5개보다 한 단계 낮은 위계 — 회색 바탕 상자, 문장은 본문 크기 */
.explore-box {
  display: grid;
  gap: 1rem;
  padding: 1.6rem 2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
}

.explore-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.explore-lead {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.explore-list {
  display: grid;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.explore-item {
  display: grid;
  gap: 0.6rem;
  padding: 1.2rem 1.4rem;
  border-radius: var(--krds-radius-medium2, var(--krds-radius-large1));
  background: var(--krds-light-color-surface-white);
}

.explore-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  font-size: var(--krds-pc-font-size-label-small);
  color: var(--krds-light-color-text-subtle);
}

.explore-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0 0.8rem;
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-basic);
}

.explore-in {
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.explore-text {
  font-size: var(--krds-pc-font-size-body-medium);
  font-weight: 500;
  line-height: 1.6;
  color: var(--krds-light-color-text-bolder);
}

@media (max-width: 767px) {
  .explore-box {
    padding: 1.4rem;
  }
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

/* ── 아래 고정 바(① .step-bar · ② .pick-bar와 같은 모양) ───────── */
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

.result-bar-btn {
  margin-left: auto;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 1.6rem;
  padding: 3.2rem 2rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
  color: var(--krds-light-color-text-subtle);
  text-align: center;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.8rem;
}

/*
 * 쌓이는 폭: 묶음(.side-col)을 풀어 두 상자를 바로 격자 칸으로 만들고, 복사·인쇄 상자만 질문 위로(RS-03, 세진 2-2).
 * 그 상자는 버튼 한 줄 + 안내로 낮게 — 960×600에서도 ③으로 옮긴 직후 1번 질문 전체와 2번 칩이 보이게(V-06)
 */
@media (max-width: 1100px) {
  .result-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.2rem;
  }

  .side-col {
    display: contents;
  }

  .side-tools {
    order: -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.6rem;
    padding: 1rem 1.2rem;
  }

  .side-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
  }

  .side-tools .side-btn {
    width: auto;
  }

  .side-tools .side-tip {
    flex: 1 1 24rem;
  }

  .side-more {
    justify-items: start;
  }

  .side-more .side-btn {
    width: auto;
  }
}

@media (max-width: 767px) {
  .side-btn {
    min-height: var(--rq-touch);
  }

  /* 휴대폰: 두 버튼을 한 줄에(인쇄가 더 넓게) */
  .side-tools .side-actions {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    width: 100%;
  }

  .side-tools .side-btn {
    width: 100%;
    padding: 0 1rem;
  }

  .side-more .side-btn {
    width: 100%;
  }

  .side-more {
    justify-items: stretch;
  }

  .next-box {
    padding: 1.4rem 1.6rem;
  }

  /* 휴대폰: 바가 화면을 덜 가리게 버튼 하나만 */
  .result-bar {
    padding: 1rem;
  }

  .result-bar-note {
    display: none;
  }

  .result-bar-btn {
    width: 100%;
    min-height: var(--rq-touch);
    margin-left: 0;
  }
}

@media print {
  .result-step {
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
