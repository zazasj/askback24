<script setup lang="ts">
/**
 * 업무 카드 하나. 세 선택은 실제 라디오 입력에 칩 모양만 입혀 키보드·화면낭독기가 저절로 되게 한다.
 * 고른 라디오를 다시 누르면(Space 포함) 선택이 풀린다 — 라디오 기본 동작에 없는 것이라 click 에서 처리한다.
 */
import { computed, ref, watch } from 'vue'
import { CARD_BOOK } from '@shared/catalog'
import type { CardDef, Pref } from '@shared/contract'
import { ncsLine } from '@/realData'
import { cardTerms } from './glossary'
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
// 고용24 직무정보에서 찾은 능력단위명(못 찾은 카드는 팀이 정리한 값) — data/real/ncs-cards.json
const basis = computed(() => ncsLine(props.card))

// "예를 들면"(U-01·02, D-175): 처음엔 접고, "모르겠어요"를 새로 고르면 펼친다 — 뜻을 몰라 고른 경우 다시 생각할 거리
const terms = computed(() => cardTerms(props.card))
const open = ref(false)
watch(
  () => props.pref,
  (p, before) => {
    if (p === 'unsure' && before !== 'unsure') open.value = true
  },
)
const moreId = computed(() => `card-${props.card.id}-more`)
</script>

<template>
  <div :id="`card-${card.id}`" class="task-card" :class="pref ? `is-${pref}` : undefined" tabindex="-1">
    <div class="head">
      <h3 :id="nameId" class="name">{{ card.label }}</h3>
      <span v-if="tag" class="posting-tag">{{ tag }}</span>
    </div>
    <p :id="descId" class="plain">{{ card.plain }}</p>
    <!-- "예를 들면"은 줄 왼쪽에 고정, NCS는 같은 줄 오른쪽. 펼친 내용은 이 줄 아래(버튼 자리가 움직이지 않게, 카드 높이 F-03 유지) -->
    <div class="meta-row">
      <button type="button" class="more-toggle" :aria-expanded="open" :aria-controls="moreId" @click="open = !open">
        예를 들면
      </button>
      <p class="basis">{{ basis }}</p>
    </div>
    <div v-show="open" :id="moreId" class="more-panel">
      <ul class="examples">
        <li v-for="ex in card.examples" :key="ex">{{ ex }}</li>
      </ul>
      <dl v-if="terms.length" class="terms" aria-label="용어 풀이">
        <div v-for="t in terms" :key="t.term" class="term">
          <dt>{{ t.term }}</dt>
          <dd>{{ t.def }}</dd>
        </div>
      </dl>
    </div>
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
/* 데스크톱 첫 화면에 카드 2줄(4개)이 보이게 안쪽 여백·칩 높이를 줄였다(N4, F-03). 휴대폰 칩은 44px 그대로 */
.task-card {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  gap: 0.4rem;
  height: 100%;
  padding: 1.2rem 1.6rem;
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
  line-height: 1.4;
  color: var(--krds-light-color-text-subtle);
}

.meta-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 1.2rem;
}

.meta-row .basis {
  flex: 1;
  min-width: 0;
  text-align: right;
}

/* "예를 들면": 줄 왼쪽 고정. 접힌 상태는 NCS 줄과 같은 높이라 첫 화면 카드 수(F-03)를 지킨다 */
.more-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--krds-pc-font-size-body-xsmall);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-primary);
  cursor: pointer;
}

.more-toggle::before {
  content: '›';
  display: inline-block;
  transition: transform 0.15s ease;
}

.more-toggle[aria-expanded='true']::before {
  transform: rotate(90deg);
}

.more-toggle:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.2rem;
}

.more-panel {
  display: grid;
  gap: 0.2rem;
}

.examples {
  margin: 0.4rem 0 0;
  padding-left: 1.8rem;
  list-style: disc;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.terms {
  display: grid;
  gap: 0.2rem;
  margin: 0.6rem 0 0;
  padding: 0.6rem 0.8rem;
  border-radius: var(--krds-radius-small2);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-xsmall);
  line-height: 1.5;
}

.term {
  display: flex;
  gap: 0.6rem;
}

.term dt {
  flex: none;
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.term dd {
  margin: 0;
  color: var(--krds-light-color-text-subtle);
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.4rem;
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
  min-height: 3.2rem;
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

  .more-toggle {
    min-height: var(--rq-touch);
  }

  .chip {
    min-height: var(--rq-touch);
    padding: 0 1.1rem;
  }
}
</style>
