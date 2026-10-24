<script setup lang="ts">
/**
 * S4 ① 공고 확인 — AI가 공고를 읽은 흔적. 맨 위 "AI 분석 요약"(확인할 곳 수 + 먼저 볼 두 곳),
 * 공고 원문(고용24 상세 표 모양, 직무내용은 원문 줄 그대로 글 블록) + 형광펜 + 설명 말풍선,
 * 옆(휴대폰은 아래)에 "AI가 찾은 확인할 점"과 회사 신호(출처 배지).
 * focusCard(주소 ?card=)가 오면 그 카드의 형광펜을 켜고 그 자리로 간다(③ "근거 보기").
 */
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { createReusableTemplate, onKeyStroke, useEventListener } from '@vueuse/core'
import { getCard } from '@shared/catalog'
import type { CompanySignal, Posting, PostingAnalysis } from '@shared/contract'
import PostingText from '@/features/jobs/PostingText.vue'
import { lastLineOf, postingLines, type PostingLine } from '@/features/jobs/postingText'
import { checkPoints, firstLooks, postingTag } from './checkpoints'
import { markKey, marksOf, splitByQuotes, type Segment } from './highlight'

const props = defineProps<{
  posting: Posting
  analysis?: PostingAnalysis
  signals: readonly CompanySignal[]
  nextLabel: string
  focusCard?: string | null
  /** 최종 흐름인데 1차 결과가 없다: 다음 단계 대신 1차 질문 만들기를 먼저 권한다(DR-r2-05) */
  needsFirst?: boolean
}>()
const emit = defineEmits<{ next: []; first: [] }>()

type PostingKey = keyof Posting & string

interface RowDef {
  key: string
  label: string
  fields: PostingKey[]
  /** 비어 있으면 줄을 숨긴다(비어 있음이 확인할 점이 아닌 칸) */
  hideEmpty?: boolean
  /** 긴 글 칸: 원문 줄·소제목·목록 기호 그대로 글 블록으로(S3 상세와 같은 부품) */
  block?: boolean
}

const ROWS: readonly RowDef[] = [
  { key: 'job', label: '직무내용', fields: ['jobCont'], block: true },
  { key: 'pf', label: '우대조건', fields: ['pfCond', 'etcPfCond'] },
  { key: 'emp', label: '고용형태', fields: ['empTpNm'] },
  { key: 'career', label: '경력', fields: ['enterTpNm'] },
  { key: 'edu', label: '학력', fields: ['eduNm'], hideEmpty: true },
  { key: 'sal', label: '임금', fields: ['salTpNm', 'sal'] },
  { key: 'hours', label: '근무시간', fields: ['workdayWorkhrCont'] },
  { key: 'region', label: '근무지역', fields: ['workRegion'], hideEmpty: true },
  { key: 'welfare', label: '복리후생', fields: ['etcWelfare'], hideEmpty: true },
  { key: 'sel', label: '전형방법', fields: ['selMthd'], hideEmpty: true },
]

interface MarkSpot {
  key: string
  row: string
  quote: string
  cardIds: string[]
}

const marks = computed(() => marksOf(props.analysis))

const rows = computed(() =>
  ROWS.flatMap((def) => {
    const parts = def.fields
      .map((field) => ({ field, text: String(props.posting[field] ?? '').trim() }))
      .filter((p) => p.text !== '')
      .map((p) => ({
        field: p.field,
        segments: splitByQuotes(
          p.text,
          marks.value.filter((m) => m.field === p.field),
        ),
      }))
    if (!parts.length && def.hideEmpty) return []
    return [{ ...def, parts }]
  }),
)

/** 문서 순서대로 모든 형광펜(확인할 점·주소에서 카드로 찾아갈 때 쓴다) */
const spots = computed<MarkSpot[]>(() =>
  rows.value.flatMap((row) =>
    row.parts.flatMap((part) =>
      part.segments
        .filter((s) => s.cardIds.length)
        .map((s) => ({ key: markKey(part.field, s), row: row.key, quote: s.text, cardIds: s.cardIds })),
    ),
  ),
)

const spotFor = (cardId: string): MarkSpot | undefined => spots.value.find((s) => s.cardIds.includes(cardId))

const openKey = ref<string | null>(null)
const activeKey = ref<string | null>(props.focusCard ? (spotFor(props.focusCard)?.key ?? null) : null)
const openSpot = computed(() => spots.value.find((s) => s.key === openKey.value) ?? null)

const bubbleCards = computed(() =>
  (openSpot.value?.cardIds ?? []).flatMap((id) => {
    const card = getCard(id)
    const found = props.analysis?.cards.find((c) => c.card_id === id)
    if (!card || !found) return []
    return [{ id, label: card.label, tag: postingTag(found), reason: found.reason }]
  }),
)

const points = computed(() => checkPoints(props.analysis))
/** 맨 위 "AI 분석 요약"의 먼저 볼 두 곳(확인할 점 순서대로, 형광펜이 있는 것) */
const looks = computed(() => firstLooks(points.value, spotFor))
// 오른쪽 열이 공고보다 길어지지 않게 앞의 것(모호한 업무·근무 방식부터)만 먼저 보인다(DR-r1-03)
const CHECKS_FIRST = 3
const checksOpen = ref(false)
const shownPoints = computed(() => (checksOpen.value ? points.value : points.value.slice(0, CHECKS_FIRST)))
const hiddenChecks = computed(() => Math.max(0, points.value.length - CHECKS_FIRST))

const root = useTemplateRef<HTMLElement>('root')

function markEl(key: string): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`mark[data-mark-key="${key}"]`) ?? null
}

/**
 * 말풍선은 형광펜 줄 아래에 펼쳐져 아래 고정 바에 가릴 수 있어 바 위까지 끌어올린다(DR-r3-01).
 * 바 높이만큼의 여백은 html scroll-padding-bottom(base.css)이 맡는다. 확인할 점에서 올 때는 형광펜 가운데 맞춤을 따른다.
 */
function open(key: string, reveal = true): void {
  openKey.value = key
  activeKey.value = key
  if (!reveal) return
  void nextTick(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('mark-bubble')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  })
}

function close(returnFocus: boolean): void {
  const key = openKey.value
  if (!key) return
  openKey.value = null
  if (returnFocus) markEl(key)?.focus()
}

function toggleMark(key: string): void {
  if (openKey.value === key) close(false)
  else open(key)
}

/** 형광펜 한 개의 속성. 글 블록(직무내용)과 짧은 칸이 같은 형광펜을 그린다 */
function markBind(field: string, seg: Segment) {
  const key = markKey(field, seg)
  const isOpen = openKey.value === key
  return {
    role: 'button',
    tabindex: 0,
    'data-bubble-keep': '',
    'data-mark-key': key,
    'data-active': activeKey.value === key ? 'true' : undefined,
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? 'mark-bubble' : undefined,
    'aria-describedby': 'mark-help',
  }
}

function onMarkKey(e: KeyboardEvent, field: string, seg: Segment): void {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  toggleMark(markKey(field, seg))
}

/** 확인할 점·주소에서 카드의 형광펜으로 간다 */
function goToCard(cardId: string, focus: boolean): void {
  const spot = spotFor(cardId)
  if (!spot) return
  open(spot.key, false)
  void nextTick(() => {
    const el = markEl(spot.key)
    el?.scrollIntoView({ block: 'center' })
    if (focus) el?.focus({ preventScroll: true })
  })
}

onKeyStroke('Escape', () => close(true))

// 바깥을 누르면 닫는다. 형광펜·말풍선·확인할 점 버튼은 각자 처리한다
useEventListener(document, 'click', (e: MouseEvent) => {
  if (!openKey.value) return
  if (e.target instanceof Element && e.target.closest('[data-bubble-keep]')) return
  close(false)
})

onMounted(() => {
  const card = props.focusCard
  // 주소 이동 뒤 라우터의 맨 위 스크롤이 끝난 다음에 형광펜 자리로 간다
  if (card) setTimeout(() => goToCard(card, true), 0)
})

const isMarked = (s: Segment) => s.cardIds.length > 0

/** 말풍선 하나를 글 블록 줄 밑과 짧은 칸 밑 두 자리에서 쓴다 */
const [DefineBubble, ReuseBubble] = createReusableTemplate()

/**
 * 긴 글 칸에서는 열린 형광펜이 있는 그 줄 바로 밑에 펼친다(칸 끝에 펼치면 형광펜과 수백 px 떨어짐, N6).
 * 형광펜이 줄을 넘으면 마지막 줄 밑 한 곳에만.
 */
const bubbleLine = computed<{ field: string; index: number } | null>(() => {
  const key = openKey.value
  if (!key) return null
  for (const row of rows.value) {
    if (!row.block) continue
    for (const part of row.parts) {
      const index = lastLineOf(postingLines(part.segments), (seg) => seg.cardIds.length > 0 && markKey(part.field, seg) === key)
      if (index !== null) return { field: part.field, index }
    }
  }
  return null
})
const bubbleAfterLine = (field: string, line: PostingLine): boolean => bubbleLine.value?.field === field && bubbleLine.value.index === line.index
</script>

<template>
  <section ref="root" class="posting-step" aria-labelledby="posting-step-title">
    <!-- 말풍선 틀(그리지 않음). 아래 두 자리에서 ReuseBubble 로 쓴다 -->
    <DefineBubble>
      <div v-if="openSpot" id="mark-bubble" class="bubble" data-bubble-keep>
        <p class="bubble-quote">‘{{ openSpot.quote }}’</p>
        <ul class="bubble-cards">
          <li v-for="c in bubbleCards" :key="c.id">
            <p class="bubble-card">
              <strong>{{ c.label }}</strong>
              <span v-if="c.tag" class="tag">{{ c.tag }}</span>
            </p>
            <p class="bubble-reason">{{ c.reason }}</p>
          </li>
        </ul>
        <button type="button" class="bubble-close" aria-label="설명 닫기" @click="close(true)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </DefineBubble>

    <!-- "공고 확인"은 바로 위 단계 표시의 현재 단계와 같은 말이라 화면낭독기에만 남긴다(N4, D-089를 데스크톱까지) -->
    <h2 id="posting-step-title" class="sr-only">공고 확인</h2>

    <!-- 고용24식 안내 상자(채팅 말풍선 아님). 인용을 누르면 그 형광펜을 켜고 그리로 간다(F-04).
         제목·개수 줄·목록이 이 상자의 바로 아래 자식이어야 한 묶음으로 읽힌다(둘만 감싸는 칸을 두지 않음) -->
    <section v-if="points.length" class="ai-summary" aria-labelledby="ai-summary-title">
      <h3 id="ai-summary-title" class="ai-summary-title">AI 분석 요약</h3>
      <p class="ai-summary-count">확인할 곳 <strong>{{ points.length }}군데</strong>를 찾았어요.</p>
      <ol v-if="looks.length" class="looks" :aria-label="`먼저 볼 ${looks.length === 2 ? '두' : '한'} 곳`">
        <li v-for="(l, i) in looks" :key="l.key" class="look">
          <span class="look-no" aria-hidden="true">{{ i + 1 }}</span>
          <span class="look-body">
            <button type="button" class="look-quote tap-target" data-bubble-keep @click="goToCard(l.cardId, true)">‘{{ l.quote }}’</button>
            <span class="look-reason">{{ l.reason }}</span>
          </span>
        </li>
      </ol>
      <p class="ai-summary-help">
        <span v-if="looks.length">먼저 볼 곳을 누르면 공고의 그 문구로 가요. </span>
        <span class="help-full">노란 형광펜을 누르면 AI가 어떤 업무와 연결했는지 보여요.</span>
        <span class="help-short">형광펜을 누르면 AI가 연결한 업무가 보여요.</span>
        <span> 공고 분석은 미리 만들어 둔 결과예요.</span>
      </p>
    </section>

    <div class="layout">
      <section class="posting" aria-labelledby="posting-title">
        <header class="posting-head">
          <p class="corp">
            <strong>{{ posting.corpNm }}</strong>
            <span class="corp-meta">{{ posting.indTpNm }} · 근로자 {{ posting.totPsncnt }}명</span>
          </p>
          <h3 id="posting-title" class="posting-title">
            {{ posting.wantedTitle }}
            <span class="badge">모의 공고</span>
          </h3>
        </header>

        <p id="mark-help" class="sr-only">형광펜 문구예요. 누르면 AI 설명이 나와요.</p>
        <table class="posting-table">
          <caption class="sr-only">
            공고 원문
          </caption>
          <colgroup>
            <col class="col-head" />
            <col />
          </colgroup>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>
                <template v-if="row.parts.length && row.block">
                  <PostingText v-for="part in row.parts" :key="part.field" :segments="part.segments">
                    <template #mark="{ seg, text }"
                      ><mark
                        v-bind="markBind(part.field, seg)"
                        @click="toggleMark(markKey(part.field, seg))"
                        @keydown="onMarkKey($event, part.field, seg)"
                        >{{ text }}</mark
                      ></template
                    >
                    <template #after="{ line }"><ReuseBubble v-if="bubbleAfterLine(part.field, line)" /></template>
                  </PostingText>
                </template>
                <template v-else-if="row.parts.length">
                  <span v-for="part in row.parts" :key="part.field" class="part"
                    ><template v-for="seg in part.segments" :key="seg.start"
                      ><mark
                        v-if="isMarked(seg)"
                        v-bind="markBind(part.field, seg)"
                        @click="toggleMark(markKey(part.field, seg))"
                        @keydown="onMarkKey($event, part.field, seg)"
                        >{{ seg.text }}</mark
                      ><template v-else>{{ seg.text }}</template></template
                    ></span
                  >
                </template>
                <span v-else class="empty">공고에 적혀 있지 않아요</span>

                <ReuseBubble v-if="openSpot && openSpot.row === row.key && !row.block" />
              </td>
            </tr>
          </tbody>
        </table>
        <p class="posting-note">회사명과 공고는 예시예요. 고용24 채용정보 항목 이름을 따라 만든 모의 공고예요.</p>
      </section>

      <div class="side">
        <section class="side-box checks" aria-labelledby="checks-title">
          <h3 id="checks-title" class="side-title">AI가 찾은 확인할 점</h3>
          <p class="side-sub">면접에서 물어보면 좋을 곳을 골랐어요. 누르면 공고의 그 문구로 가요.</p>
          <ul v-if="points.length" id="check-list" class="check-list">
            <li v-for="p in shownPoints" :key="p.key">
              <button
                v-if="p.hasMark && p.cardId"
                type="button"
                class="check-item is-link"
                data-bubble-keep
                @click="goToCard(p.cardId, true)"
              >
                <span class="tag">{{ p.tag }}</span>
                <span class="check-title">{{ p.title }}</span>
                <span class="check-detail">{{ p.detail }}</span>
              </button>
              <div v-else class="check-item">
                <span class="tag" :class="{ 'is-blank': p.tag === '공고에 없음' }">{{ p.tag }}</span>
                <span class="check-title">{{ p.title }}</span>
                <span class="check-detail">{{ p.detail }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="side-sub">아직 이 공고는 분석하지 못했어요.</p>
          <button
            v-if="hiddenChecks > 0"
            type="button"
            class="btn btn-tertiary btn-sm more-checks"
            aria-controls="check-list"
            :aria-expanded="checksOpen"
            @click="checksOpen = !checksOpen"
          >
            {{ checksOpen ? '확인할 점 접기' : `확인할 점 ${hiddenChecks}개 더 보기` }}
          </button>
        </section>

        <section v-if="signals.length" class="side-box signals" aria-labelledby="signals-title">
          <h3 id="signals-title" class="side-title">회사 신호</h3>
          <p class="side-sub">회사를 평가하지 않아요. 면접에서 확인할 근거로만 보여 드려요.</p>
          <ul class="signal-list">
            <li v-for="s in signals" :key="s.text" class="signal">
              <span class="source" :class="s.source === '실제' ? 'is-real' : 'is-mock'">{{ s.source }}</span>
              <span class="signal-body">
                <span class="signal-text">{{ s.text }}</span>
                <span class="signal-from">{{ s.source_name }} · 값은 예시</span>
              </span>
            </li>
          </ul>
          <p class="signal-help">
            "실제"는 실제 서비스에서 공공데이터로 채울 항목이에요. 시연 회사는 가상이라 값은 예시예요. "모의"는 시연용으로 만든 항목이에요.
          </p>
          <p class="signal-help">신호는 면접에서 그대로 말하지 말고, '신입이 자리 잡도록 어떤 도움을 주시나요?'처럼 돌려 물어보세요.</p>
        </section>
      </div>
    </div>

    <!-- 다음 버튼이 긴 공고·확인할 점 아래로 묻히지 않게 아래 고정 바(② .pick-bar와 같은 모양, DR-r1-03) -->
    <div v-if="needsFirst" class="step-bar is-blocked">
      <p class="step-bar-notice">먼저 1차 면접 질문을 만들어 주세요</p>
      <div class="step-bar-actions">
        <button type="button" class="btn btn-tertiary btn-lg" @click="emit('next')">{{ nextLabel }}</button>
        <button type="button" class="btn btn-accent btn-lg" @click="emit('first')">1차 면접 질문 만들기</button>
      </div>
    </div>
    <div v-else class="step-bar">
      <p v-if="points.length" class="step-bar-note">확인할 곳 <strong>{{ points.length }}군데</strong>를 다 봤으면 다음 단계로 가요</p>
      <button type="button" class="btn btn-accent btn-lg next" @click="emit('next')">{{ nextLabel }}</button>
    </div>
  </section>
</template>

<style scoped>
.posting-step {
  display: grid;
  gap: 2rem;
}

/* ── AI 분석 요약(KRDS 안내 상자 모양 + 우리 강조색 왼쪽 선) ───────── */
.ai-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.8rem 1.2rem;
  padding: 1.4rem 2rem 1.4rem 1.8rem;
  border: 1px solid var(--rq-accent-border);
  border-left: 0.4rem solid var(--rq-accent);
  border-radius: var(--krds-radius-medium2);
  background: var(--rq-accent-subtler);
}

.ai-summary-title {
  font-size: var(--krds-pc-font-size-label-medium);
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.ai-summary-count {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.ai-summary-count strong {
  color: var(--krds-light-color-text-bolder);
}

.looks,
.ai-summary-help {
  grid-column: 1 / -1;
}

.looks {
  display: grid;
  gap: 0.4rem;
}

.look {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  font-size: var(--krds-pc-font-size-body-small);
}

.look-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 2rem;
  height: 2rem;
  border-radius: var(--krds-radius-max);
  background: var(--rq-accent-subtle);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.look-body {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  min-width: 0;
}

/* 인용은 공고 형광펜과 같은 노란 바탕(누르면 그 형광펜으로 간다) */
.look-quote {
  padding: 0.1rem 0.4rem;
  border: 0;
  border-radius: var(--krds-radius-small1);
  background: var(--rq-mark);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
  text-align: left;
  text-decoration: underline dotted;
  text-decoration-color: var(--krds-light-color-text-subtle);
  text-underline-offset: 0.4rem;
}

.look-quote:hover {
  background: var(--rq-mark-active);
}

.look-reason {
  color: var(--krds-light-color-text-basic);
}

.ai-summary-help {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.help-short {
  display: none;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 2.4rem;
  align-items: start;
}

/* ── 공고 원문 ─────────────────────────────────────── */
.posting {
  display: grid;
  gap: 1.6rem;
  min-width: 0;
}

.posting-head {
  display: grid;
  gap: 0.4rem;
}

.corp {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.corp-meta {
  color: var(--krds-light-color-text-subtle);
}

.posting-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  font-size: var(--krds-pc-font-size-heading-xsmall);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-bolder);
}

.posting-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
  font-size: var(--krds-pc-font-size-body-small);
}

.posting-table th,
.posting-table td {
  padding: 1.2rem 1.4rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  text-align: left;
  vertical-align: top;
}

.posting-table .col-head {
  width: 10.4rem;
}

.posting-table th {
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.posting-table td {
  line-height: 1.75;
}

.part {
  white-space: pre-line;
}

.part + .part::before {
  content: ' ';
}

.empty {
  color: var(--krds-light-color-text-subtle);
  font-style: normal;
}

mark {
  padding: 0.1rem 0.2rem;
  border-radius: var(--krds-radius-small1);
  background: var(--rq-mark);
  color: var(--krds-light-color-text-bolder);
  text-decoration: underline dotted;
  text-decoration-color: var(--krds-light-color-text-subtle);
  text-underline-offset: 0.4rem;
  cursor: pointer;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

mark:hover,
mark[data-active='true'] {
  background: var(--rq-mark-active);
}

mark[data-active='true'] {
  font-weight: 700;
}

.posting-note {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

/* ── 말풍선 ────────────────────────────────────────── */
.bubble {
  position: relative;
  margin-top: 1.2rem;
  padding: 1.4rem 4.4rem 1.4rem 1.6rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
  box-shadow: var(--rq-shadow-card);
}

/* 글 블록 줄 사이에 펼쳤을 때 다음 줄과 붙지 않게 */
.bubble:not(:last-child) {
  margin-bottom: 1.2rem;
}

.bubble::before {
  content: '';
  position: absolute;
  top: -0.7rem;
  left: 2rem;
  width: 1.2rem;
  height: 1.2rem;
  border-top: 1px solid var(--rq-accent-border);
  border-left: 1px solid var(--rq-accent-border);
  background: var(--rq-accent-subtler);
  transform: rotate(45deg);
}

.bubble-quote {
  margin-bottom: 0.8rem;
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.bubble-cards {
  display: grid;
  gap: 1rem;
}

.bubble-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  color: var(--krds-light-color-text-bolder);
}

.bubble-reason {
  color: var(--krds-light-color-text-basic);
}

.bubble-close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rq-touch);
  height: var(--rq-touch);
  border: 0;
  border-radius: var(--krds-radius-medium2);
  background: none;
  color: var(--krds-light-color-text-subtle);
}

.bubble-close:hover {
  background: var(--rq-accent-subtle);
  color: var(--krds-light-color-text-bolder);
}

/* ── 옆 상자 ───────────────────────────────────────── */
.side {
  display: grid;
  gap: 1.6rem;
  min-width: 0;
}

.side-box {
  display: grid;
  gap: 1rem;
  padding: 1.8rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.checks {
  border-color: var(--rq-accent-border);
  background: var(--rq-accent-subtler);
}

.side-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.checks .side-title {
  color: var(--rq-accent-strong);
}

.side-sub {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.check-list {
  display: grid;
  gap: 0.8rem;
}

.check-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: start;
  gap: 0.4rem;
  width: 100%;
  padding: 1.2rem 1.4rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-medium3);
  background: var(--krds-light-color-surface-white);
  text-align: left;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.check-item.is-link:hover {
  border-color: var(--rq-accent);
}

.check-title {
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.check-detail {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.tag {
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

.tag.is-blank {
  background: var(--krds-light-color-surface-gray-subtle);
  color: var(--krds-light-color-text-basic);
}

.signal-list {
  display: grid;
  gap: 1rem;
}

.signal {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  font-size: var(--krds-pc-font-size-body-small);
}

.signal-body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.signal-from {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.source {
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0 0.8rem;
  border: 1px solid transparent;
  border-radius: var(--krds-radius-small2);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  white-space: nowrap;
}

.source.is-real {
  border-color: var(--krds-light-color-border-information-light);
  background: var(--krds-light-color-surface-information-subtler);
  color: var(--krds-light-color-text-information);
}

.source.is-mock {
  border-color: var(--krds-light-color-border-gray);
  border-style: dashed;
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-text-subtle);
}

.signal-help {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.more-checks {
  justify-self: start;
}

/* ── 아래 고정 바 ───────────────────────────────────── */
.step-bar {
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

.step-bar-note {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.step-bar-note strong {
  color: var(--rq-accent-strong);
}

.step-bar .next {
  margin-left: auto;
}

.step-bar-notice {
  font-size: var(--krds-pc-font-size-body-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.step-bar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-left: auto;
}

@media (max-width: 1023px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  /* 첫 화면에 공고 첫 행(형광펜)이 고정 바 위로 보이게 머리를 줄인다(DR-r2-01).
     "공고 확인"은 바로 위 단계 표시와 같은 말이라 화면낭독기에만 남긴다 */
  .posting-step {
    gap: 1.6rem;
  }

  .ai-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    padding: 1.2rem 1.4rem 1.2rem 1.2rem;
  }

  .help-full {
    display: none;
  }

  .help-short {
    display: inline;
  }

  .corp-meta {
    display: none;
  }

  .posting {
    gap: 1.2rem;
  }

  .posting-table th,
  .posting-table td {
    padding: 1rem 1rem;
  }

  .posting-table .col-head {
    width: 8.4rem;
  }

  .side-box {
    padding: 1.4rem;
  }

  .more-checks {
    min-height: var(--rq-touch);
  }

  /* 휴대폰: 바가 화면을 덜 가리게 버튼만 */
  .step-bar {
    padding: 1rem;
  }

  .step-bar-note {
    display: none;
  }

  .step-bar .next {
    width: 100%;
    min-height: var(--rq-touch);
    font-size: var(--krds-pc-font-size-label-small);
  }

  /* 1차 결과가 없을 때: 안내 한 줄 + 버튼 두 개를 한 줄에 */
  .step-bar.is-blocked {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
  }

  .step-bar-notice {
    font-size: var(--krds-pc-font-size-body-xsmall);
  }

  .step-bar-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    margin-left: 0;
  }

  .step-bar-actions .btn {
    min-height: var(--rq-touch);
    padding: 0 0.8rem;
    font-size: var(--krds-pc-font-size-label-xsmall);
  }
}
</style>
