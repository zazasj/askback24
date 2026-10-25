<script setup lang="ts">
/**
 * S4 면접 역질문 준비 — 단계형(D-012).
 * 머리(지원 건 요약·준비할 면접 라디오) + 단계 표시(주소 ?step=) + 단계 본문.
 * 1차: ① 공고 확인 → ② 내 기대·걱정 → ③ 질문 받기. 최종: ① 공고 확인 → ② 1차 면접 정리 → ③ 최종 질문 받기.
 * ②의 "질문 만들기"·"최종 질문 만들기"는 질문 저장소에서 만들기를 시작하고 ③으로 간다(③이 만드는 중을 보여 준다).
 */
import { computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PRESETS, getAnalysis, getPosting, getSignals, type PresetKey } from '@shared/catalog'
import type { Mode } from '@shared/contract'
import NotFoundContent from '@/components/ui/NotFoundContent.vue'
import { useDemoStore } from '@/stores/demo'
import { useDemoToolActions, type DemoToolAction } from '@/stores/demoTools'
import { usePrepStore } from '@/stores/prep'
import { useQuestionsStore } from '@/stores/questions'
import { useReviewStore } from '@/stores/review'
import CardPickStep from '@/features/interview-prep/CardPickStep.vue'
import FinalResultStep from '@/features/interview-prep/FinalResultStep.vue'
import FirstResultStep from '@/features/interview-prep/FirstResultStep.vue'
import PostingStep from '@/features/interview-prep/PostingStep.vue'
import PrepHeader from '@/features/interview-prep/PrepHeader.vue'
import ReviewStep from '@/features/interview-prep/ReviewStep.vue'
import StepNav from '@/features/interview-prep/StepNav.vue'
import { NEXT_FROM_POSTING, STEP_LABELS, entryMode, type StepNo } from '@/features/interview-prep/steps'
import { usePrepRoute } from '@/features/interview-prep/usePrepRoute'

const route = useRoute()
const demo = useDemoStore()
const prep = usePrepStore()
const questions = useQuestionsStore()
const review = useReviewStore()

const application = computed(() => demo.findApplication(String(route.params.applyId ?? '')))
const posting = computed(() => (application.value ? getPosting(application.value.wantedAuthNo) : undefined))
const analysis = computed(() => (posting.value ? getAnalysis(posting.value.wantedAuthNo) : undefined))
const signals = computed(() => (posting.value ? getSignals(posting.value.wantedAuthNo) : []))

// 주소에 면접 종류가 없으면 내 준비 진행(저장된 결과)으로, 결과가 없을 때만 지원결과로 정한다(H2-04)
const { step, mode, goStep, setMode } = usePrepRoute(() => {
  const app = application.value
  return entryMode(app?.result ?? '-', (m) => !!app && questions.hasSaved(app.apply_id, m))
})
const labels = computed(() => STEP_LABELS[mode.value])
/** ③ "근거 보기"가 ①로 보낼 때 켤 카드(?card=BE15) */
const focusCard = computed(() => (typeof route.query.card === 'string' ? route.query.card : null))
/** 시험 장치: 가짜 응답 모드에서 질문 생성이 실패한 것처럼 */
const apiFail = computed(() => route.query.apiFail === '1')
/** 1차 결과(시드 포함)가 있어야 최종 흐름의 정리 단계로 갈 수 있다 */
const hasFirst = computed(() => !!(application.value && questions.firstOf(application.value.apply_id)))
/** 1차 질문을 만드는 중이면 곧 결과가 생기므로 "먼저 1차 면접 질문을 만들어 주세요"로 막지 않는다 */
const firstGenerating = computed(() => !!(application.value && questions.isGenerating(application.value.apply_id)))

/** "질문 만들기": 같은 선택으로 만든 질문이 있으면 다시 만들지 않고 ③만 연다(A2-01, 다시 만들기는 "AI로 다시 만들기") */
function makeQuestions(): void {
  const app = application.value
  const p = posting.value
  if (!app || !p) return
  questions.ensureFirst(app.apply_id, p.wantedAuthNo, { apiFail: apiFail.value })
  void goStep(3)
}

/**
 * 머리 "준비할 면접" 라디오. 단계 번호는 그대로 두되(D-020), 1차 ③에서 최종으로 바꿨는데 최종 결과가 없으면
 * 빈 ③ 대신 1차 면접 정리(②)로 간다(H2-03). 1차 질문을 만드는 중이면 ③이 그 진행을 보여 주므로 그대로 둔다
 */
function changeMode(m: Mode): void {
  const app = application.value
  const toReviewStep =
    m === 'final' &&
    mode.value === 'first' &&
    step.value === 3 &&
    !!app &&
    !questions.finalOf(app.apply_id) &&
    !questions.isGenerating(app.apply_id)
  void setMode(m, toReviewStep ? 2 : step.value)
}

/** "면접 다녀왔어요" → 최종 면접·처우 협의의 1차 면접 정리(D-020) */
function toReview(): void {
  void setMode('final', 2)
}

/** 1차 결과가 없을 때 "1차 면접 질문 만들기" → 1차·기술 면접의 내 기대·걱정 */
function toFirst(): void {
  void setMode('first', 2)
}

function startFinal(): void {
  const app = application.value
  const p = posting.value
  if (app && p) void questions.makeFinal(app.apply_id, p.wantedAuthNo, { apiFail: apiFail.value })
}

/** "최종 질문 만들기" → ③ 최종 질문 받기(③이 만드는 중을 보여 준다) */
function makeFinal(): void {
  startFinal()
  void goStep(3)
}

/** 시연 도구 "1차 면접 다녀온 것으로 채우기"(R-04). 채우기만 하고 만들기는 사람이 누른다 */
function fillReviewExample(): void {
  const app = application.value
  const first = app ? questions.firstOf(app.apply_id) : undefined
  if (app && first) review.fillExample(app.apply_id, first.response.questions)
}

// 알림은 띄우지 않는다: 아래 고정 바의 "N개 골랐어요"가 바로 바뀌고, 알림이 그 바를 가린다
function fillPreset(key: PresetKey): void {
  const app = application.value
  if (app) prep.fillPreset(app.apply_id, key)
}

const demoActions = computed<DemoToolAction[]>(() => {
  const app = application.value
  if (!app || step.value !== 2) return []
  if (mode.value === 'first')
    return [
      { id: 'preset-a', label: '예시 구직자 A로 채우기', description: PRESETS.A.summary, run: () => fillPreset('A') },
      { id: 'preset-b', label: '예시 구직자 B로 채우기', description: PRESETS.B.summary, run: () => fillPreset('B') },
    ]
  return questions.firstOf(app.apply_id) ? [{ id: 'review-example', label: '1차 면접 다녀온 것으로 채우기', run: fillReviewExample }] : []
})
useDemoToolActions(demoActions)

// ── 단계가 바뀔 때 초점(A2-02) ─────────────────────────
// 누른 버튼(S1 면접 준비·내 기대·걱정 고르기·면접 다녀왔어요 등)이 사라지면 초점이 문서 처음으로 떨어져
// 화면낭독기 사용자는 단계가 바뀐 줄 모른다. 그때만 새 단계 제목으로 옮긴다. 라디오로 면접 종류를 바꾼 것처럼
// 누른 것이 남아 있으면 그대로 둔다. 스크롤은 라우터(D-078)가 정하므로 건드리지 않는다
const STEP_HEADINGS: Record<Mode, Record<StepNo, string>> = {
  first: { 1: 'posting-step-title', 2: 'pick-step-title', 3: 'result-title' },
  final: { 1: 'posting-step-title', 2: 'review-title', 3: 'final-title' },
}

function focusLost(): boolean {
  const el = document.activeElement
  return !el || el === document.body || !el.isConnected
}

async function focusStepHeading(): Promise<void> {
  await nextTick()
  // ① "근거 보기"·확인할 점(?card=)은 PostingStep 이 그 형광펜에 초점을 준다
  if (step.value === 1 && focusCard.value) return
  if (!focusLost()) return
  document.getElementById(STEP_HEADINGS[mode.value][step.value])?.focus({ preventScroll: true })
}

watch([step, mode], () => void focusStepHeading())
onMounted(() => {
  // 앱 안에서 들어왔을 때만(S1 버튼이 사라짐). 주소로 처음 열면 초점은 문서 처음 그대로
  if (typeof (window.history.state as { back?: unknown } | null)?.back === 'string') void focusStepHeading()
})
</script>

<template>
  <NotFoundContent v-if="!application || !posting" detail="이 지원 건을 찾을 수 없어요. 지원 내역에서 다시 골라 주세요." />
  <div v-else class="s4">
    <PrepHeader
      :corp-nm="posting.corpNm"
      :wanted-title="posting.wantedTitle"
      :result="application.result"
      :mode="mode"
      @update:mode="changeMode"
    />

    <StepNav class="steps" :labels="labels" :current="step" />

    <PostingStep
      v-if="step === 1"
      :posting="posting"
      :analysis="analysis"
      :signals="signals"
      :next-label="NEXT_FROM_POSTING[mode]"
      :focus-card="focusCard"
      :needs-first="mode === 'final' && !hasFirst && !firstGenerating"
      @next="goStep(2)"
      @first="toFirst"
    />
    <CardPickStep
      v-else-if="mode === 'first' && step === 2"
      :apply-id="application.apply_id"
      :analysis="analysis"
      @make="makeQuestions"
    />
    <FirstResultStep
      v-else-if="mode === 'first'"
      :apply-id="application.apply_id"
      :posting="posting"
      :api-fail="apiFail"
      @change="goStep(2)"
      @review="toReview"
    />
    <ReviewStep v-else-if="step === 2" :apply-id="application.apply_id" @make="makeFinal" @first="toFirst" />
    <FinalResultStep
      v-else
      :apply-id="application.apply_id"
      :posting="posting"
      @edit="goStep(2)"
      @first="toFirst"
      @remake="startFinal"
    />
  </div>
</template>

<style scoped>
/* 머리·단계 표시·본문 사이를 좁혀 첫 화면에 단계 본문이 더 보이게(N4) */
.steps {
  margin: 1.6rem 0 1.6rem;
}

@media (max-width: 767px) {
  .steps {
    margin: 1.2rem 0 1.6rem;
  }
}
</style>
