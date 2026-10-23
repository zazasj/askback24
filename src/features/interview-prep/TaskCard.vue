<script setup lang="ts">
/**
 * 업무 카드 하나. 세 선택은 실제 라디오 입력에 칩 모양만 입혀 키보드·화면낭독기가 저절로 되게 한다.
 * 고른 라디오를 다시 누르면(Space 포함) 선택이 풀린다 — 라디오 기본 동작에 없는 것이라 click 에서 처리한다.
 */
import { computed } from 'vue'
import { CARD_BOOK } from '@shared/catalog'
import type { CardDef, Pref } from '@shared/contract'
import { PREFS } from './picks'

const props = defineProps<{ card: CardDef; pref: Pref | null; tag: string | null }>()
const emit = defineEmits<{ toggle: [pref: Pref] }>()

const LABELS = CARD_BOOK.preference_options

/** 크롬은 이미 고른 라디오에서 Space 를 무시한다. 그때만 직접 풀고 기본 동작(가짜 click)을 막는다 */
function onSpaceUp(e: KeyboardEvent, p: Pref): void {
  if (props.pref !== p) return
  e.preventDefault()
  emit('toggle', p)
}
const nameId = computed(() => `card-${props.card.id}-name`)
const descId = computed(() => `card-${props.card.id}-desc`)
const basis = computed(() =>
  props.card.ncs.length ? `NCS · ${props.card.ncs.map((n) => n.unit).join(', ')}` : '근무 방식·환경 카드',
)
</script>

<template>
  <div :id="`card-${card.id}`" class="task-card" :class="pref ? `is-${pref}` : undefined" tabindex="-1">
    <div class="head">
      <h3 :id="nameId" class="name">{{ card.label }}</h3>
      <span v-if="tag" class="posting-tag">{{ tag }}</span>
    </div>
    <p :id="descId" class="plain">{{ card.plain }}</p>
    <p class="basis">{{ basis }}</p>
    <div role="radiogroup" class="choices" :aria-labelledby="nameId" :aria-describedby="descId">
      <label v-for="p in PREFS" :key="p" class="choice" :class="`is-${p}`">
        <input
          type="radio"
          class="choice-input"
          :name="`pref-${card.id}`"
          :value="p"
          :checked="pref === p"
          @click="emit('toggle', p)"
          @keyup.space="onSpaceUp($event, p)"
        />
        <span class="chip">{{ LABELS[p] }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  gap: 0.6rem;
  height: 100%;
  padding: 1.6rem 1.8rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.task-card:focus {
  outline: none;
}

.task-card:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.2rem;
}

.task-card.is-want {
  border-color: var(--krds-light-color-border-success);
  background: var(--krds-light-color-surface-success-subtler);
}

.task-card.is-avoid {
  border-color: var(--krds-light-color-border-warning);
  background: var(--krds-light-color-surface-warning-subtler);
}

.task-card.is-unsure {
  border-color: var(--krds-light-color-border-gray-dark);
  background: var(--krds-light-color-surface-gray-subtler);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.8rem;
}

.name {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-bolder);
}

.posting-tag {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0 0.7rem;
  border-radius: var(--krds-radius-small2);
  background: var(--rq-accent-subtle);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--rq-accent-strong);
  white-space: nowrap;
}

.plain {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.basis {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.6rem;
}

.choice {
  position: relative;
  display: inline-flex;
}

/*
 * 라디오는 보이지 않게 칩 크기로 덮어 둔다. sr-only(1px, 칩 왼쪽 위)면 Tab 초점이 갈 때 브라우저가 그 1px만
 * 고정 바 위로 들여 칩 아래쪽이 바에 가린다(DR-r3-02 실측). 누르기는 칩(label)이 받는다
 */
.choice-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  pointer-events: none;
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

.choice.is-want input:checked + .chip {
  border-color: var(--krds-light-color-text-success);
  background: var(--krds-light-color-text-success);
  color: var(--krds-light-color-text-basic-inverse);
  font-weight: 700;
}

.choice.is-avoid input:checked + .chip {
  border-color: var(--krds-light-color-text-warning);
  background: var(--krds-light-color-text-warning);
  color: var(--krds-light-color-text-basic-inverse);
  font-weight: 700;
}

.choice.is-unsure input:checked + .chip {
  border-color: var(--krds-light-color-text-subtle);
  background: var(--krds-light-color-text-subtle);
  color: var(--krds-light-color-text-basic-inverse);
  font-weight: 700;
}

@media (max-width: 767px) {
  .task-card {
    padding: 1.4rem;
  }

  .chip {
    min-height: var(--rq-touch);
    padding: 0 1.1rem;
  }
}
</style>
