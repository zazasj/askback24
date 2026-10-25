<script setup lang="ts">
/**
 * S4 ② 내 기대·걱정 — 업무 카드 17개(처음 12개 + "5개 더 보기") + 경험 한 줄 + 아래 고정 바(카운터·질문 만들기).
 * 선택은 지원 건마다 prep 저장소에 둔다.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { CARDS, CARD_BOOK, getCard } from '@shared/catalog'
import type { PostingAnalysis, Pref } from '@shared/contract'
import { EXPERIENCE_LEAD, experienceAnchor } from '@shared/rules'
import { API_MODE } from '@/api/client'
import { PERSONA } from '@/demoData'
import { JOB_INFO } from '@/realData'
import { useDemoToolsStore } from '@/stores/demoTools'
import { usePrepStore } from '@/stores/prep'
import { postingTag } from './checkpoints'
import { EXPERIENCE_MAX, PREFS, countByPref, experienceTarget, oneLine, prefOf } from './picks'
import TaskCard from './TaskCard.vue'

const props = defineProps<{ applyId: string; analysis?: PostingAnalysis }>()
const emit = defineEmits<{ make: [] }>()

const prep = usePrepStore()

const selection = computed(() => prep.selectionOf(props.applyId))
const picks = computed(() => selection.value.picks)

const CORE = CARDS.filter((c) => c.core)
const MORE = CARDS.filter((c) => !c.core)
const isMore = (id: string) => MORE.some((c) => c.id === id)

// 더 보기 카드를 이미 골랐으면(예시 구직자·저장값) 처음부터 펼친다
const expanded = ref(picks.value.some((p) => isMore(p.card_id)))
watch(picks, (list) => {
  if (list.some((p) => isMore(p.card_id))) expanded.value = true
})
const visible = computed(() => (expanded.value ? [...CORE, ...MORE] : CORE))

async function showMore(): Promise<void> {
  expanded.value = true
  await nextTick()
  // 버튼이 사라지므로 새로 나온 첫 카드로 초점을 옮긴다
  document.getElementById(`card-${MORE[0]?.id ?? ''}`)?.focus()
}

function tagOf(cardId: string): string | null {
  return postingTag(props.analysis?.cards.find((c) => c.card_id === cardId))
}

const counts = computed(() => countByPref(picks.value))
const total = computed(() => picks.value.length)
const breakdown = computed(() => PREFS.map((p) => `${CARD_BOOK.preference_options[p]} ${counts.value[p]}`).join(' · '))

function toggle(cardId: string, pref: Pref): void {
  prep.togglePref(props.applyId, cardId, pref)
}

// 휴대폰은 단계 표시로 스크롤해 와서(D-078) 시연 띠의 "시연 도구"가 화면 밖이다. 예시 구직자 채우기 단서를 ② 안에 둔다(DR-r3-03)
const demoTools = useDemoToolsStore()
const showDemoHint = computed(() => API_MODE === 'mock' || demoTools.pageActions.length > 0)

async function openDemoTools(): Promise<void> {
  window.scrollTo({ top: 0 })
  demoTools.open = true
  await nextTick()
  document.getElementById('demo-tools-toggle')?.focus({ preventScroll: true })
}

// ── 경험 한 줄 ────────────────────────────────────────
const CHIPS = PERSONA.experience_chips
const experience = computed(() => selection.value.experience)

// 한 줄 입력이라 붙여 넣은 줄바꿈은 띄어쓰기로 바꾼다(칸은 휴대폰에서 글이 잘리지 않게 textarea)
function onExperienceInput(e: Event): void {
  prep.setExperience(props.applyId, oneLine((e.target as HTMLTextAreaElement).value))
}

function useChip(chip: (typeof CHIPS)[number]): void {
  prep.setExperience(props.applyId, chip.text, chip.card_id)
}

/** 아래 바의 "경험 한 줄 붙이기(선택)" → 입력칸으로(초점 이동이 스크롤도 한다, 바 위에서 멈춤은 scroll-padding) */
function jumpToExperience(): void {
  document.getElementById('experience-input')?.focus()
}

// 경험 한 줄은 AI에 보내므로 사람·학교·회사를 알아볼 말을 빼 달라고 늘 같이 적는다(개인정보, A1-07)
const EXPERIENCE_PRIVACY = '이름·학교·회사 이름은 빼고 적어 주세요.'
// 붙이는 규칙을 그대로 적는다(picks.ts experienceTarget). 관련 있는 질문을 고르는 장치는 없다(A2-07)
const experienceHint = computed(() => {
  if (!experience.value.trim()) return `"기대돼요"를 고른 질문 하나 앞에 붙여요(이력서 칩은 그 업무 질문). 비워 둬도 돼요. ${EXPERIENCE_PRIVACY}`
  const target = experienceTarget(selection.value)
  if (!target) return `"기대돼요"를 고른 카드가 있으면 그 질문 앞에 붙여요. ${EXPERIENCE_PRIVACY}`
  const label = getCard(target)?.label ?? target
  // 끝말을 이을 수 없으면 경험 글 대신 중립 앞말이 붙는다(A2-06). 그렇다고 미리 알린다
  if (!experienceAnchor(experience.value)?.quoted)
    return `"${label}" 질문 앞에 "${EXPERIENCE_LEAD.trim()}"로 이어요. 경험을 그대로 넣으려면 "…했는데"처럼 끝내 주세요. ${EXPERIENCE_PRIVACY}`
  return `"${label}" 질문 앞에 붙여요. ${EXPERIENCE_PRIVACY}`
})
</script>

<template>
  <section class="pick-step" aria-labelledby="pick-step-title">
    <!-- "내 기대·걱정"은 바로 위 단계 표시의 현재 단계와 같은 말이라 화면낭독기에만 남긴다(N4) -->
    <h2 id="pick-step-title" class="sr-only" tabindex="-1">내 기대·걱정</h2>
    <div class="intro">
      <!-- 안내는 두 줄(N4): 고르는 법 + 꼬리표·"모르겠어요" 뜻(H1-15, 휴대폰은 넘치면 다음 줄) / 직업정보 + 시연 단서.
           첫 화면 카드 4개(F-03)를 지키려고 줄 수를 늘리지 않는다 -->
      <p class="lead">
        백엔드 업무 17가지 중 아는 만큼만 골라요. 고른 것을 다시 누르면 풀려요.
        <span class="lead-tip">꼬리표는 AI가 찾은 확인할 점 · "모르겠어요"는 더 알고 싶은 일</span>
      </p>
      <div class="intro-row">
        <!-- 카드가 어떤 직업의 일인지 공공 자료로 받친다(고용24 직업정보 직무 개요, data/real/job-info.json) -->
        <p v-if="JOB_INFO.summary_short" class="job-info">
          <span class="job-info-text">{{ JOB_INFO.summary_short }}</span>
          <span class="job-info-src">고용24 직업정보 · {{ JOB_INFO.job_name }} 직무 개요</span>
        </p>
        <p v-if="showDemoHint" class="demo-hint">
          <span>시연: 예시 구직자로 채우려면</span>
          <button type="button" class="btn btn-tertiary btn-sm" @click="openDemoTools">시연 도구 열기</button>
        </p>
      </div>
    </div>

    <ul class="card-grid">
      <li v-for="card in visible" :key="card.id">
        <TaskCard
          :card="card"
          :pref="prefOf(picks, card.id)"
          :tag="tagOf(card.id)"
          @toggle="(p) => toggle(card.id, p)"
        />
      </li>
    </ul>
    <div v-if="!expanded" class="more">
      <button type="button" class="btn btn-tertiary" @click="showMore">5개 더 보기</button>
    </div>

    <section class="experience" aria-labelledby="experience-title">
      <h3 id="experience-title" class="sub-title">내 경험을 질문에 붙이기 <span class="optional">(선택)</span></h3>
      <div class="field">
        <label for="experience-input" class="field-label">경험 한 줄</label>
        <textarea
          id="experience-input"
          class="input input-multiline experience-input"
          rows="2"
          :maxlength="EXPERIENCE_MAX"
          autocomplete="off"
          placeholder="예: 팀 프로젝트에서 FastAPI로 API를 만들어 본 경험이 있습니다."
          aria-describedby="experience-hint experience-count"
          :value="experience"
          @keydown.enter.prevent
          @input="onExperienceInput"
        ></textarea>
        <p class="field-foot">
          <span id="experience-hint" class="field-hint">{{ experienceHint }}</span>
          <span id="experience-count" class="field-count">{{ experience.length }}/{{ EXPERIENCE_MAX }}자</span>
        </p>
      </div>
      <div class="chips" role="group" aria-labelledby="chips-title">
        <span id="chips-title" class="chips-title">이력서에서 가져오기</span>
        <button
          v-for="chip in CHIPS"
          :key="chip.card_id"
          type="button"
          class="resume-chip"
          :aria-pressed="experience === chip.text"
          @click="useChip(chip)"
        >
          {{ chip.label }}
        </button>
      </div>
    </section>

    <div class="pick-bar">
      <div class="counter-wrap">
        <p class="counter" aria-live="polite">
          <strong class="count">{{ total }}개 골랐어요</strong>
          <span class="count-detail">({{ breakdown }})</span>
          <span v-if="total > 0 && total < 3" class="count-tip">3개 이상이면 더 정확해요</span>
        </p>
        <!-- 카드 17개 아래 맨 끝의 "경험 한 줄"을 직접 고르는 사람도 보게(H2-20). 경험이 비어 있을 때만 -->
        <button v-if="!experience.trim()" type="button" class="exp-jump tap-target" @click="jumpToExperience">경험 한 줄 붙이기(선택)</button>
      </div>
      <button type="button" class="btn btn-accent btn-lg make" :disabled="total === 0" @click="emit('make')">
        질문 만들기
      </button>
    </div>
  </section>
</template>

<style scoped>
.pick-step {
  display: grid;
  gap: 1.6rem;
}

.intro {
  display: grid;
  gap: 0.6rem;
}

.intro-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1.6rem;
}

.lead {
  color: var(--krds-light-color-text-basic);
}

/* 공공 자료 인용: 고용24 상세 화면의 출처 문단처럼 회색 왼쪽 선 하나(우리 강조색은 쓰지 않음) */
.job-info {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 1rem;
  padding: 0.2rem 0 0.2rem 1.2rem;
  border-left: 0.3rem solid var(--krds-light-color-border-gray);
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.job-info-src {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

/* 시연용 단서: 우리 기능 강조색이 아니라 시연 띠·가짜 응답 태그와 같은 회색 점선 계열 */
.demo-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.2rem 0.2rem 0.2rem 1rem;
  border: 1px dashed var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-basic);
}

/* 카드는 제 내용 높이만 쓴다(start). stretch면 옆 카드의 "예를 들면"이 펼쳐질 때 같은 줄 카드가 빈 채로 늘어난다(D-178) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 1.2rem;
}

.more {
  display: flex;
  justify-content: center;
  margin-top: -0.8rem;
}

/* ── 경험 한 줄 ─────────────────────────────────────── */
.experience {
  display: grid;
  gap: 1.2rem;
  padding: 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.sub-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.optional {
  font-weight: 500;
  color: var(--krds-light-color-text-subtle);
}

.field {
  display: grid;
  gap: 0.6rem;
}

.field-label {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.experience-input {
  width: 100%;
  min-height: 4.8rem;
  font-size: var(--krds-pc-font-size-body-medium);
}

.field-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem 1.2rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.field-count {
  margin-left: auto;
  white-space: nowrap;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.8rem;
}

.chips-title {
  margin-right: 0.4rem;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.resume-chip {
  display: inline-flex;
  align-items: center;
  min-height: 3.6rem;
  padding: 0 1.4rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-small);
  color: var(--rq-accent-strong);
  text-align: left;
}

.resume-chip:hover {
  border-color: var(--rq-accent);
}

.resume-chip[aria-pressed='true'] {
  border-color: var(--rq-accent);
  background: var(--rq-accent-subtle);
  font-weight: 700;
}

/* ── 아래 고정 바 ───────────────────────────────────── */
.pick-bar {
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

.counter-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 1.6rem;
  min-width: 0;
}

.counter {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
}

/* 링크 모양 버튼(같은 화면 안 입력칸으로 간다) */
.exp-jump {
  padding: 0;
  border: 0;
  background: none;
  font-size: var(--krds-pc-font-size-body-small);
  font-weight: 700;
  color: var(--krds-light-color-text-primary);
  text-decoration: underline;
  text-underline-offset: 0.3rem;
  cursor: pointer;
}

.lead-tip {
  white-space: nowrap;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.count {
  font-size: var(--krds-pc-font-size-label-large);
  color: var(--rq-accent-strong);
}

/* 비활성 → 활성 색이 바로 바뀌게(중간 색에서 대비가 모자라지 않게) */
.make {
  transition: none;
}

.count-detail,
.count-tip {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

@media (max-width: 767px) {
  .card-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 글과 버튼을 한 줄에(카드가 덜 밀리게) */
  .lead {
    font-size: var(--krds-pc-font-size-body-small);
  }

  .demo-hint {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    padding: 0.2rem 0.2rem 0.2rem 1.2rem;
  }

  .demo-hint > span {
    flex: 1;
    min-width: 0;
    text-wrap: balance;
  }

  .demo-hint .btn {
    flex: none;
  }

  /* 직업정보 개요는 휴대폰에서 두 줄까지만(카드가 덜 밀리게, H1-10) */
  .job-info-text {
    display: -webkit-box;
    flex: 1 1 100%;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .experience {
    padding: 1.6rem;
  }

  .resume-chip {
    min-height: var(--rq-touch);
  }

  /* 휴대폰: 바가 화면을 덜 가리게 개수와 버튼만 한 줄로 */
  .pick-bar {
    flex-wrap: nowrap;
    gap: 1.2rem;
    padding: 1rem 1rem 1rem 1.6rem;
  }

  .count-detail,
  .count-tip {
    display: none;
  }

  /* 개수 아래 줄에 작게(버튼과 한 줄을 지키려고) */
  .counter-wrap {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }

  .exp-jump {
    min-height: 2.4rem;
    font-size: var(--krds-pc-font-size-body-xsmall);
  }

  .lead-tip {
    display: block;
    white-space: normal;
    font-size: var(--krds-pc-font-size-body-xsmall);
  }

  .pick-bar .make {
    flex: none;
    min-height: var(--rq-touch);
    padding: 0 2rem;
    font-size: var(--krds-pc-font-size-label-small);
  }
}
</style>
