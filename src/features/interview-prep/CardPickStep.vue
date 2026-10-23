<script setup lang="ts">
/**
 * S4 ② 내 기대·걱정 — 업무 카드 17개(처음 12개 + "5개 더 보기") + 경험 한 줄 + 아래 고정 바(카운터·질문 만들기).
 * 선택은 지원 건마다 prep 저장소에 둔다.
 */
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { CARDS, CARD_BOOK, getCard } from '@shared/catalog'
import type { PostingAnalysis, PostingState, Pref } from '@shared/contract'
import { PERSONA } from '@/demoData'
import { usePrepStore } from '@/stores/prep'
import { useDemoToolsStore } from '@/stores/demoTools'
import { POSTING_TAGS } from './checkpoints'
import { EXPERIENCE_MAX, PREFS, countByPref, experienceTarget, prefOf } from './picks'
import TaskCard from './TaskCard.vue'

const props = defineProps<{ applyId: string; analysis?: PostingAnalysis }>()
const emit = defineEmits<{ make: [] }>()

const prep = usePrepStore()
const tools = useDemoToolsStore()

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

function stateOf(cardId: string): PostingState {
  return props.analysis?.cards.find((c) => c.card_id === cardId)?.state ?? 'absent'
}

const counts = computed(() => countByPref(picks.value))
const total = computed(() => picks.value.length)
const breakdown = computed(() => PREFS.map((p) => `${CARD_BOOK.preference_options[p]} ${counts.value[p]}`).join(' · '))

function toggle(cardId: string, pref: Pref): void {
  prep.togglePref(props.applyId, cardId, pref)
}

// ── 경험 한 줄 ────────────────────────────────────────
const CHIPS = PERSONA.experience_chips
const experience = computed(() => selection.value.experience)

function onExperienceInput(e: Event): void {
  prep.setExperience(props.applyId, (e.target as HTMLInputElement).value)
}

function useChip(chip: (typeof CHIPS)[number]): void {
  prep.setExperience(props.applyId, chip.text, chip.card_id)
}

const experienceHint = computed(() => {
  if (!experience.value.trim()) return 'AI가 관련 있는 질문에만 붙여요. 비워 둬도 돼요.'
  const target = experienceTarget(selection.value)
  if (!target) return '"기대돼요"를 고른 카드가 있으면 그 질문 앞에 붙여요.'
  return `"${getCard(target)?.label ?? target}" 질문 앞에 붙여요.`
})

// ── 아래 고정 바: 시연 도구 버튼이 가리지 않게 높이를 알린다 ─────────
const bar = useTemplateRef<HTMLElement>('bar')
const { height: barHeight } = useElementSize(bar, undefined, { box: 'border-box' })
watch(barHeight, (h) => {
  tools.bottomInset = Math.round(h)
})
onBeforeUnmount(() => {
  tools.bottomInset = 0
})
</script>

<template>
  <section class="pick-step" aria-labelledby="pick-step-title">
    <div class="intro">
      <h2 id="pick-step-title" class="section-title">내 기대·걱정</h2>
      <p class="lead">백엔드 개발자가 실제로 하는 일 17가지예요. 아는 만큼만 골라도 돼요.</p>
      <p class="hint">카드마다 기대돼요 · 걱정돼요 · 모르겠어요 중 하나를 골라요. 고른 것을 다시 누르면 풀려요.</p>
    </div>

    <ul class="card-grid">
      <li v-for="card in visible" :key="card.id">
        <TaskCard
          :card="card"
          :pref="prefOf(picks, card.id)"
          :tag="POSTING_TAGS[stateOf(card.id)]"
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
        <input
          id="experience-input"
          class="input experience-input"
          type="text"
          :maxlength="EXPERIENCE_MAX"
          autocomplete="off"
          placeholder="예: 인턴 때 FastAPI로 API를 설계부터 배포까지 맡아 봤는데"
          aria-describedby="experience-hint experience-count"
          :value="experience"
          @input="onExperienceInput"
        />
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

    <div ref="bar" class="pick-bar">
      <p class="counter" aria-live="polite">
        <strong class="count">{{ total }}개 골랐어요</strong>
        <span class="count-detail">({{ breakdown }})</span>
        <span v-if="total > 0 && total < 3" class="count-tip">3개 이상이면 더 정확해요</span>
      </p>
      <button type="button" class="btn btn-accent btn-lg make" :disabled="total === 0" @click="emit('make')">
        질문 만들기
      </button>
    </div>
  </section>
</template>

<style scoped>
.pick-step {
  display: grid;
  gap: 2.4rem;
}

.intro {
  display: grid;
  gap: 0.6rem;
}

.lead {
  color: var(--krds-light-color-text-basic);
}

.hint {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .pick-bar .make {
    flex: none;
    min-height: var(--rq-touch);
    padding: 0 2rem;
    font-size: var(--krds-pc-font-size-label-small);
  }
}
</style>
