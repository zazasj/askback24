<script setup lang="ts">
/**
 * 업무 카드 하나. 세 선택은 실제 라디오 입력에 칩 모양만 입혀 키보드·화면낭독기가 저절로 되게 한다.
 * 고른 라디오를 다시 누르면(Space 포함) 선택이 풀린다 — 라디오 기본 동작에 없는 것이라 click 에서 처리한다.
 */
import { computed, useTemplateRef } from 'vue'
import { CARD_BOOK } from '@shared/catalog'
import type { CardDef, Pref } from '@shared/contract'
import HelpPopup from '@/components/ui/HelpPopup.vue'
import { ncsDefinition, ncsLine } from '@/realData'
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
// 응답에서 찾은 능력단위의 정의 한 문장(H2-11 ②). 첫 화면 카드 수(F-03)를 지키려고 카드가 아니라 도움말 안에 둔다
const definition = computed(() => ncsDefinition(props.card))

// "도움말"(HP-01~04): 고른 것과 관계없이 모든 카드에 늘 있고, 누를 때만 열린다("모르겠어요"에 저절로 열지 않음).
// 팝업은 카드 밖(body)에 그려져 카드 높이가 바뀌지 않는다. 말풍선은 이 카드 왼끝·폭에 맞춘다
const root = useTemplateRef<HTMLElement>('root')
const terms = computed(() => cardTerms(props.card))
</script>

<template>
  <div :id="`card-${card.id}`" ref="root" class="task-card" :class="pref ? `is-${pref}` : undefined" tabindex="-1" data-tour="pick-card">
    <div class="head">
      <h3 :id="nameId" class="name">{{ card.label }}</h3>
      <span v-if="tag" class="posting-tag">{{ tag }}</span>
    </div>
    <!-- 넓은 화면은 한 줄 말줄임이라, 핵심 낱말이 잘리는 카드는 짧은 설명으로 바꿔 보인다(A3-r1-17). 전체 글은 화면낭독기 설명·도움말 맨 위 -->
    <p :id="descId" class="plain" :class="{ 'has-short': !!card.plain_short }">{{ card.plain }}</p>
    <p v-if="card.plain_short" class="plain plain-short">{{ card.plain_short }}</p>
    <!-- "도움말"은 줄 왼쪽, NCS는 같은 줄 오른쪽. 카드 높이가 모두 같고 이 줄은 아래에 붙어 카드마다 같은 자리다(D18) -->
    <div class="meta-row">
      <HelpPopup :title="card.label" :boundary="root" data-tour="card-help">
        <!-- 넓은 화면에서는 카드 설명을 한 줄로 자르므로(HP-06) 전체 글을 맨 위에 늘 둔다 -->
        <p class="help-desc">{{ card.plain }}</p>
        <h3 class="help-sub">예를 들면</h3>
        <ul class="examples">
          <li v-for="ex in card.examples" :key="ex">{{ ex }}</li>
        </ul>
        <ul v-if="terms.length" class="terms" aria-label="용어 풀이">
          <li v-for="t in terms" :key="t.term" class="term"><strong class="term-word">{{ t.term }}</strong> <span class="term-def">{{ t.def }}</span></li>
        </ul>
        <p v-if="definition" class="ncs-def">능력단위 정의(고용24 직무정보) · {{ definition }}</p>
      </HelpPopup>
      <p class="basis">{{ basis }}</p>
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

/*
 * 1280px 이상: 카드 높이를 모두 같게 하면(HP-05) 두 줄 설명 카드(168px)에 다 맞춰져 1440×900 첫 화면 카드가 2개뿐(F-03).
 * 설명을 한 줄로 자르고(말줄임) 전체 글은 도움말 맨 위에 둔다(HP-06). 화면낭독기는 라디오 묶음 설명으로 전체 글을 읽는다
 */
@media (min-width: 1280px) {
  .plain {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  /* 짧은 설명이 있는 카드는 전체 글 대신 짧은 글(A3-r1-17). 격자 칸은 하나만 쓰도록 다른 하나는 display:none */
  .plain.has-short {
    display: none;
  }
}

/* 1279px 이하는 전체 글이 줄바꿈되어 다 보이므로 짧은 글은 두지 않는다 */
@media (max-width: 1279px) {
  .plain-short {
    display: none;
  }
}

.basis {
  font-size: var(--krds-pc-font-size-body-xsmall);
  line-height: 1.4;
  color: var(--krds-light-color-text-subtle);
}

/* NCS 글이 두 줄이 되어도 "도움말"은 마지막 줄에 붙어 카드 아래끝에서 같은 자리(D18) */
.meta-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.2rem 1.2rem;
}

.meta-row .basis {
  flex: 1;
  min-width: 0;
  text-align: right;
}

/* ── 도움말 팝업 안(HelpPopup 슬롯): 설명 전체 + 옛 "예를 들면" 펼침 내용 그대로 ── */
.help-desc {
  margin-bottom: 0.6rem;
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.5;
  color: var(--krds-light-color-text-basic);
}

.help-sub {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-bolder);
}

.examples {
  padding-left: 1.8rem;
  list-style: disc;
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.5;
  color: var(--krds-light-color-text-basic);
}

.terms {
  display: grid;
  gap: 0.2rem;
  margin-top: 0.6rem;
  padding: 0.6rem 0.8rem;
  border-radius: var(--krds-radius-small2);
  background: var(--krds-light-color-surface-gray-subtler);
  list-style: none;
  font-size: var(--krds-pc-font-size-body-xsmall);
  line-height: 1.5;
}

.term {
  display: flex;
  gap: 0.6rem;
}

.term-word {
  flex: none;
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.term-def {
  color: var(--krds-light-color-text-subtle);
}

.ncs-def {
  margin-top: 0.4rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  line-height: 1.5;
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

/* 고대비(forced-colors)에서는 고른 칩의 채운 바탕이 없어져 굵기로만 구분됐다 → 시스템 선택 색(A3-r2-06) */
@media (forced-colors: active) {
  /* 위 세 규칙과 같은 무게로 덮는다 */
  .choice.is-want input:checked + .chip,
  .choice.is-avoid input:checked + .chip,
  .choice.is-unsure input:checked + .chip {
    border-color: Highlight;
    background-color: Highlight;
    color: HighlightText;
  }
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
