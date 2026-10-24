<script setup lang="ts">
/**
 * S4 ③ 1차·기술 면접 질문. ②에서 "질문 만들기"를 누르면 만드는 중 → 질문 5개.
 * 결과는 지원 건마다 저장되어 새로고침해도 그대로다. 결과가 없이 이 단계를 열면 지금 선택으로 바로 만든다.
 * 처우 질문은 여기서 주지 않는다(D-012). 1차 면접을 다녀오면 최종 단계로 넘긴다.
 * "전체 복사"·"면접 다녀왔어요"는 ①②처럼 아래 고정 바에 둔다(F-05).
 */
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CARD_BOOK } from '@shared/catalog'
import type { Posting, Question } from '@shared/contract'
import { typeLabel } from '@shared/rules'
import { API_MODE } from '@/api/client'
import MockModeTag from '@/components/ui/MockModeTag.vue'
import { useCopy } from '@/composables/useCopy'
import { usePrepStore } from '@/stores/prep'
import { useQuestionsStore } from '@/stores/questions'
import GeneratingView from './GeneratingView.vue'
import { PREFS, countByPref } from './picks'
import QuestionCard from './QuestionCard.vue'
import { FIRST_TONES, cardMeta, evidenceLabel } from './questionView'

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
const stale = computed(() => !!result.value && !store.isCurrent(props.applyId, props.posting.wantedAuthNo))

const seeded = computed(() => result.value?.seed === true)
const templateCount = computed(() => questions.value.filter((q) => q.source === 'template').length)
const allTemplate = computed(() => questions.value.length > 0 && templateCount.value === questions.value.length)

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

const kept = computed(() => new Set(result.value?.kept ?? []))

// ── 오른쪽: 내가 고른 것 · 전체 동작 ──────────────────────
const breakdown = computed(() => {
  const n = countByPref(selection.value.picks)
  return PREFS.map((p) => `${CARD_BOOK.preference_options[p]} ${n[p]}`)
})

function copyAll(): void {
  const head = `${props.posting.corpNm} · ${props.posting.wantedTitle}\n1차·기술 면접 질문`
  const body = questions.value.map((q, i) => `${i + 1}. [${typeLabel(q.type)}] ${q.text}`).join('\n')
  void copy(`${head}\n\n${body}`)
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

      <div class="result-layout">
        <ol class="questions" aria-label="1차·기술 면접 질문 목록">
          <QuestionCard
            v-for="q in questions"
            :key="q.card_id"
            :rank="q.rank"
            :type-label="typeLabel(q.type)"
            :tone="FIRST_TONES[q.type]"
            :meta="cardMeta(q.card_id, q.type)"
            :text="q.text"
            :has-exp="q.has_exp"
            :template="q.source === 'template'"
            :kept="kept.has(q.card_id)"
            :basis="q.basis"
            :evidence-label="evidenceLabel(q.evidence)"
            :evidence-to="evidenceTo(q)"
            :watch-out="q.watch_out"
            :good-sign="q.good_sign"
            @copy="copy(q.text)"
            @keep="store.toggleKept(applyId, q.card_id)"
          />
        </ol>

        <aside class="result-side" aria-labelledby="side-title" data-print="hide">
          <div class="side-box">
            <h3 id="side-title" class="side-title">내가 고른 것</h3>
            <p class="side-line">
              <template v-for="(part, i) in breakdown" :key="part">
                <span v-if="i > 0" aria-hidden="true"> · </span>
                <span class="nowrap">{{ part }}</span>
              </template>
            </p>
            <p v-if="selection.experience" class="side-line side-exp">경험: {{ selection.experience }}</p>
            <button type="button" class="btn btn-tertiary side-btn" @click="emit('change')">선택 바꾸기</button>
          </div>
          <div class="side-box">
            <button type="button" class="btn btn-tertiary side-btn" @click="printSheet">면접에 들고 갈 한 장 인쇄</button>
            <button type="button" class="btn btn-tertiary side-btn" @click="make">AI로 다시 만들기</button>
            <RouterLink class="about-link tap-target" to="/about-ai">이 질문은 어떻게 만들어지나요</RouterLink>
          </div>
        </aside>
      </div>

      <section class="next-box" aria-labelledby="next-title" data-print="hide">
        <h3 id="next-title" class="next-title">1차 면접을 다녀오면</h3>
        <p>
          아래 "면접 다녀왔어요"를 눌러 물어본 질문과 들은 답을 정리해 주세요. 확인된 것은 빼고, 남은 것과 처우를 최종 면접
          질문으로 만들어 드려요.
        </p>
      </section>

      <!-- 아래 고정 바(①②와 같은 모양, F-05): 지금 할 일(전체 복사)과 다음 단계(면접 다녀왔어요). 채운 버튼은 다음 단계 하나 -->
      <div class="result-bar" data-print="hide">
        <p class="result-bar-note">질문 <strong>{{ questions.length }}개</strong>를 만들었어요</p>
        <div class="result-bar-actions">
          <button type="button" class="btn btn-tertiary btn-lg" @click="copyAll">전체 복사</button>
          <button type="button" class="btn btn-accent btn-lg" @click="emit('review')">면접 다녀왔어요</button>
        </div>
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

.result-side {
  position: sticky;
  top: 1.6rem;
  display: grid;
  gap: 1rem;
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

.result-bar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
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

@media (max-width: 1100px) {
  .result-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .result-side {
    position: static;
    grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
  }
}

@media (max-width: 767px) {
  .result-side {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-btn {
    min-height: var(--rq-touch);
  }

  .next-box {
    padding: 1.4rem 1.6rem;
  }

  /* 휴대폰: 바가 화면을 덜 가리게 버튼 두 개만 한 줄로 */
  .result-bar {
    padding: 1rem;
  }

  .result-bar-note {
    display: none;
  }

  .result-bar-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
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
