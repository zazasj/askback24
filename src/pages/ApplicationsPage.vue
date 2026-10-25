<script setup lang="ts">
/**
 * S1 알선/입사지원 내역(메인). 고용24 표의 열은 그대로 두고 오른쪽에 "면접 준비" 열을 하나 더한다.
 * 그 열과 안내 띠만 우리 기능 강조색 + AI 라벨(DESIGN-REVIEW D4).
 */
import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { getPosting } from '@shared/catalog'
import AiLabel from '@/components/ui/AiLabel.vue'
import { daysBefore, formatDate, parseIsoDate, toIsoDate } from '@/lib/dates'
import { entryMode, entryStep, prepButtonLabel } from '@/features/interview-prep/steps'
import { vDemoOff } from '@/lib/demoOff'
import { useDemoStore } from '@/stores/demo'
import { useQuestionsStore } from '@/stores/questions'
import type { Application } from '@/types'

type ViewedFilter = 'all' | 'viewed' | 'unviewed'

interface Row {
  app: Application
  corpNm: string
  title: string
  /** 공고 목록에 공고가 없다(마감·데이터 교체). 행은 남기고 준비 버튼은 흐리게(H2-16) */
  closed: boolean
  appliedIso: string
  appliedText: string
  viewedText: string
  prepLabel: string
  /** 버튼 아래 회색 한 줄 "1차 질문 5개 준비됨"(H1-17). 만든 질문이 없으면 빈 문자열 */
  prepStatus: string
}

interface Filter {
  from: string
  to: string
  viewed: ViewedFilter
  q: string
}

const demo = useDemoStore()
const questions = useQuestionsStore()
const router = useRouter()

const OTHER_TABS = ['관심기업 관리', '채용담당자와 한마디'] as const

function appliedDate(app: Application, now: Date): Date {
  return (app.applied_on && parseIsoDate(app.applied_on)) || daysBefore(app.applied_days_ago ?? 0, now)
}

/** 내가 만든(저장된) 결과가 있으면 그 면접 종류로, 없으면 지원결과로(1차 합격 → 최종) 연다(H2-04) */
const modeOf = (app: Application) => entryMode(app.result, (m) => questions.hasSaved(app.apply_id, m))

function prepStatusOf(app: Application): string {
  const fin = questions.finalOf(app.apply_id)
  if (fin) return `최종 질문 ${fin.response.final_questions.length}개 준비됨`
  const first = questions.firstOf(app.apply_id)
  return first ? `1차 질문 ${first.response.questions.length}개 준비됨` : ''
}

const rows = computed<Row[]>(() => {
  const now = new Date()
  return demo.applications.map((app) => {
    const posting = getPosting(app.wantedAuthNo)
    const applied = appliedDate(app, now)
    return {
      app,
      corpNm: posting?.corpNm ?? app.corpNm ?? '공고 정보 없음',
      title: posting?.wantedTitle ?? app.wantedTitle ?? '',
      closed: !posting,
      appliedIso: toIsoDate(applied),
      appliedText: formatDate(applied),
      viewedText: app.viewed_days_ago === null ? '-' : formatDate(daysBefore(app.viewed_days_ago, now)),
      prepLabel: prepButtonLabel(modeOf(app)),
      prepStatus: posting ? prepStatusOf(app) : '',
    }
  })
})

const form = reactive<Filter>({ from: '', to: '', viewed: 'all', q: '' })
const applied = ref<Filter>({ ...form })

function search(): void {
  applied.value = { ...form }
}

const filtered = computed(() => {
  const f = applied.value
  const q = f.q.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (q && !`${r.corpNm} ${r.title}`.toLowerCase().includes(q)) return false
    if (f.from && r.appliedIso < f.from) return false
    if (f.to && r.appliedIso > f.to) return false
    if (f.viewed === 'viewed' && r.app.viewed_days_ago === null) return false
    if (f.viewed === 'unviewed' && r.app.viewed_days_ago !== null) return false
    return true
  })
})

const VIEWED_OPTIONS: ReadonlyArray<{ value: ViewedFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'viewed', label: '열람' },
  { value: 'unviewed', label: '미열람' },
]

// 이미 만든 질문이 있으면 ③으로 바로 연다(A2-01). 1행·3행 처음 상태와 2행(시드는 1차 결과뿐, 최종으로 엶)은 ①.
// 면접 종류는 주소에 넣지 않는다: S4가 같은 규칙(entryMode)으로 정한다(H2-04)
function openPrep(r: Row): void {
  if (r.closed) return
  const id = r.app.apply_id
  const step = entryStep(
    r.app.result,
    (mode) => questions.hasResult(id, mode),
    (mode) => questions.hasSaved(id, mode),
  )
  void router.push({ name: 'prep', params: { applyId: id }, query: { step: String(step) } })
}

/** 안내 띠 "바로 해 보기": 맨 위 지원 건의 면접 준비로(H1-02 가). 낮은 노트북 화면에서 표가 첫 화면 아래로 밀려도 바로 시작한다 */
const topRow = computed(() => filtered.value.find((r) => !r.closed) ?? rows.value.find((r) => !r.closed))
function tryNow(): void {
  if (topRow.value) openPrep(topRow.value)
}

const hasResult = (result: string) => result !== '-'

// 닫기 단추가 사라지면 초점이 문서 처음으로 튀므로 화면 제목으로 옮긴다
const titleEl = useTemplateRef<HTMLHeadingElement>('title')

// 휴대폰은 시연 띠·헤더·주 메뉴·경로·마이페이지 메뉴만으로 첫 화면 절반을 쓴다. 검색 상자가 지원 건 위에 있으면
// 1행 면접 준비 버튼이 첫 화면에 들지 않아(DA-07) 휴대폰에서만 지원 건 목록을 검색 상자 앞에 둔다.
// CSS order 대신 문서 순서를 바꿔 Tab 순서와 보이는 순서가 같다
const isMobile = useMediaQuery('(max-width: 767px)')
const parts = computed(() => (isMobile.value ? (['list', 'search'] as const) : (['search', 'list'] as const)))

// 휴대폰에서는 검색 상자가 목록 아래라, 검색하면 결과(건수)가 보이게 올린다
// v-for 안이라 이름 ref 는 배열이 되어 함수 ref 로 받는다
let countEl: HTMLElement | null = null
function setCount(el: unknown): void {
  countEl = el instanceof HTMLElement ? el : null
}
async function submitSearch(): Promise<void> {
  search()
  if (!isMobile.value) return
  await nextTick()
  countEl?.scrollIntoView({ block: 'nearest' })
}

function pulseClass(i: number): Record<string, boolean> {
  return { 'is-pulse': i === 0 && !demo.guideClosed }
}
async function closeGuide(): Promise<void> {
  demo.closeGuide()
  await nextTick()
  titleEl.value?.focus()
}
</script>

<template>
  <div class="s1">
    <h1 ref="title" class="page-title" tabindex="-1">알선/입사지원 내역</h1>

    <!-- 고용24 지원 내역의 탭 줄. 지금 화면만 동작하고 나머지는 흐림 표시(G-14) -->
    <nav class="sub-tabs" aria-label="알선/입사지원 메뉴">
      <ul>
        <li><span class="sub-tab is-current" aria-current="page">입사지원 관리</span></li>
        <li v-for="name in OTHER_TABS" :key="name">
          <button v-demo-off type="button" class="sub-tab">{{ name }}</button>
        </li>
      </ul>
    </nav>

    <section v-if="!demo.guideClosed" class="guide" aria-labelledby="guide-title">
      <div class="guide-body">
        <p id="guide-title" class="guide-title">
          <AiLabel />
          <span><strong>새 기능</strong> 지원한 공고로 면접에서 물어볼 질문을 준비해 보세요</span>
        </p>
        <!-- 시간 약속 없이 무엇을 차례로 하는지만(H2-17 ①) -->
        <p class="guide-text">맨 위 지원 건의 <strong>면접 역질문 준비</strong>를 누르면 공고 확인부터 질문 받기까지 차례로 안내해요.</p>
      </div>
      <!-- 낮은 노트북 화면(1366×768)에서는 표가 첫 화면 아래라 띠에서 바로 시작한다(H1-02 가). 휴대폰은 1행 버튼이 바로 아래라 숨김 -->
      <button v-if="topRow" type="button" class="btn btn-accent guide-try" @click="tryNow">바로 해 보기</button>
      <button type="button" class="guide-close" aria-label="안내 닫기" @click="closeGuide">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </section>

    <!-- 데스크톱: 검색 상자 → 목록(고용24 그대로) / 휴대폰: 목록 → 검색 상자(DA-07) -->
    <template v-for="part in parts" :key="part">
      <form v-if="part === 'search'" class="search-box" role="search" aria-label="지원 내역 검색" @submit.prevent="submitSearch">
        <div class="search-row">
          <span id="search-date" class="search-label">검색일자</span>
          <div class="date-range" role="group" aria-labelledby="search-date">
            <label class="sr-only" for="search-from">검색 시작일</label>
            <input id="search-from" v-model="form.from" type="date" class="input" />
            <span aria-hidden="true">~</span>
            <label class="sr-only" for="search-to">검색 종료일</label>
            <input id="search-to" v-model="form.to" type="date" class="input" />
          </div>
        </div>
        <fieldset class="search-row">
          <legend class="search-label">열람여부</legend>
          <div class="radio-row">
            <label v-for="o in VIEWED_OPTIONS" :key="o.value" class="radio">
              <input v-model="form.viewed" type="radio" name="search-viewed" :value="o.value" />
              <span>{{ o.label }}</span>
            </label>
          </div>
        </fieldset>
        <div class="search-row">
          <label class="search-label" for="search-q">검색어</label>
          <div class="query">
            <input id="search-q" v-model="form.q" type="text" class="input" placeholder="회사명이나 공고 제목" />
            <button type="submit" class="btn btn-primary">검색</button>
          </div>
        </div>
      </form>

      <template v-else>
        <p :ref="setCount" class="count">전체 <strong>{{ filtered.length }}</strong>건</p>

        <!-- 데스크톱: 표 -->
        <div class="table-wrap">
          <table class="gov-table app-table">
            <caption class="sr-only">
              알선/입사지원 내역: 회사명과 지원공고, 지원일, 열람일, 지원결과, 면접 준비
            </caption>
            <colgroup>
              <col />
              <col class="w-date" />
              <col class="w-date" />
              <col class="w-result" />
              <col class="w-prep" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">회사명 / 지원공고</th>
                <th scope="col">지원일</th>
                <th scope="col">열람일</th>
                <th scope="col">지원결과</th>
                <th scope="col" class="col-prep">
                  <span class="prep-head">면접 준비 <AiLabel /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in filtered" :key="r.app.apply_id">
                <td class="cell-posting">
                  <strong class="corp">{{ r.corpNm }}</strong>
                  <template v-if="r.closed">
                    <span class="posting">{{ r.title }}</span>
                    <span class="closed-tag">공고 마감</span>
                  </template>
                  <RouterLink v-else :to="`/jobs/${r.app.wantedAuthNo}`" class="posting tap-target">{{ r.title }}</RouterLink>
                </td>
                <td>{{ r.appliedText }}</td>
                <td>{{ r.viewedText }}</td>
                <td>
                  <span class="result" :class="{ 'has-result': hasResult(r.app.result) }">{{ r.app.result }}</span>
                </td>
                <td class="col-prep">
                  <button
                    type="button"
                    class="btn btn-accent btn-sm prep-btn"
                    :class="pulseClass(i)"
                    :disabled="r.closed"
                    :aria-describedby="r.prepStatus ? `prep-status-${r.app.apply_id}` : undefined"
                    @click="openPrep(r)"
                  >
                    {{ r.prepLabel }}
                  </button>
                  <p v-if="r.prepStatus" :id="`prep-status-${r.app.apply_id}`" class="prep-status">{{ r.prepStatus }}</p>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="5" class="empty">검색 결과가 없어요. 검색어나 날짜를 바꿔 보세요.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 휴대폰: 카드 -->
        <ul class="app-cards" aria-label="알선/입사지원 내역">
          <li v-for="(r, i) in filtered" :key="r.app.apply_id" class="app-card">
            <p class="corp">{{ r.corpNm }}</p>
            <p v-if="r.closed" class="posting-closed">
              <span class="posting">{{ r.title }}</span>
              <span class="closed-tag">공고 마감</span>
            </p>
            <RouterLink v-else :to="`/jobs/${r.app.wantedAuthNo}`" class="posting tap-target">{{ r.title }}</RouterLink>
            <dl class="meta">
              <div>
                <dt>지원일</dt>
                <dd>{{ r.appliedText }}</dd>
              </div>
              <div>
                <dt>열람일</dt>
                <dd>{{ r.viewedText }}</dd>
              </div>
              <div>
                <dt>지원결과</dt>
                <dd>
                  <span class="result" :class="{ 'has-result': hasResult(r.app.result) }">{{ r.app.result }}</span>
                </dd>
              </div>
            </dl>
            <div class="card-prep">
              <span class="card-prep-label">면접 준비 <AiLabel /></span>
              <button
                type="button"
                class="btn btn-accent prep-btn"
                :class="pulseClass(i)"
                :disabled="r.closed"
                :aria-describedby="r.prepStatus ? `prep-status-m-${r.app.apply_id}` : undefined"
                @click="openPrep(r)"
              >
                {{ r.prepLabel }}
              </button>
              <p v-if="r.prepStatus" :id="`prep-status-m-${r.app.apply_id}`" class="prep-status">{{ r.prepStatus }}</p>
            </div>
          </li>
          <li v-if="!filtered.length" class="empty">검색 결과가 없어요. 검색어나 날짜를 바꿔 보세요.</li>
        </ul>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page-title {
  margin-bottom: 2.4rem;
}

/* ── 탭 줄(고용24 기존 영역, KRDS tab 모양) ─────────── */
.sub-tabs {
  margin-bottom: 2.4rem;
}

.sub-tabs ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-medium2);
  overflow: hidden;
}

.sub-tabs li + li {
  border-left: 1px solid var(--krds-light-color-border-gray-light);
}

.sub-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 4.8rem;
  padding: 0.6rem 1.2rem;
  border: 0;
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  color: var(--krds-light-color-text-basic);
}

.sub-tab.is-current {
  background: var(--krds-light-color-button-primary-fill);
  font-weight: 700;
  color: var(--krds-light-color-text-basic-inverse);
}

/* ── 안내 띠(우리 기능) ─────────────────────────────── */
.guide {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.6rem;
  margin-bottom: 2.4rem;
  padding: 1.6rem 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtle);
}

.guide-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.8rem;
  font-size: var(--krds-pc-font-size-body-medium);
  color: var(--krds-light-color-text-bolder);
}

.guide-title strong {
  color: var(--rq-accent-strong);
}

.guide-text {
  margin-top: 0.4rem;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
}

.guide-try {
  flex: none;
  align-self: center;
  margin-left: auto;
}

.guide-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--rq-touch);
  height: var(--rq-touch);
  margin: -0.8rem -1.2rem 0 0;
  border: 0;
  border-radius: var(--krds-radius-medium2);
  background: none;
  color: var(--krds-light-color-text-subtle);
}

.guide-close:hover {
  background: var(--rq-accent-border);
}

/* ── 검색 상자 ──────────────────────────────────────── */
.search-box {
  display: grid;
  gap: 1.2rem;
  padding: 2rem 2.4rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
}

.search-row {
  display: grid;
  grid-template-columns: 9.6rem minmax(0, 1fr);
  align-items: center;
  gap: 1.2rem;
}

.search-label {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

fieldset.search-row > legend {
  float: left;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.date-range .input {
  width: 16rem;
  min-width: 0;
}

.radio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 2rem;
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 3.2rem;
  font-size: var(--krds-pc-font-size-body-small);
}

.radio input {
  width: 2rem;
  height: 2rem;
  margin: 0;
  accent-color: var(--krds-light-color-element-primary);
}

.query {
  display: flex;
  gap: 0.8rem;
}

.query .input {
  flex: 1;
  min-width: 0;
  max-width: 40rem;
}

.count {
  margin: 3.2rem 0 1.2rem;
  font-size: var(--krds-pc-font-size-body-small);
}

.count strong {
  color: var(--krds-light-color-text-primary);
}

/* ── 표 ─────────────────────────────────────────────── */
.app-table .w-date {
  width: 12rem;
}

.app-table .w-result {
  width: 11rem;
}

.app-table .w-prep {
  width: 18rem;
}

.cell-posting {
  text-align: left !important;
}

.corp {
  display: block;
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.posting {
  display: inline-block;
  margin-top: 0.2rem;
  color: var(--krds-light-color-text-subtle);
  text-decoration: none;
}

.posting:hover {
  color: var(--krds-light-color-link-hover);
  text-decoration: underline;
}

.result.has-result {
  font-weight: 700;
  color: var(--krds-light-color-text-primary);
}

/* 공고 목록에서 빠진 지원 건(H2-16) */
.closed-tag {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  margin-left: 0.6rem;
  padding: 0 0.7rem;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-small2);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
  vertical-align: middle;
}

/* 내 준비 상태(H1-17): 버튼 아래 회색 한 줄 */
.prep-status {
  margin-top: 0.4rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.gov-table th.col-prep {
  background: var(--rq-accent-subtle);
  color: var(--rq-accent-strong);
}

.gov-table td.col-prep {
  background: var(--rq-accent-subtler);
}

.prep-head {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.empty {
  padding: 4rem 1.2rem !important;
  color: var(--krds-light-color-text-subtle);
  text-align: center;
}

/* 처음 온 사람에게 첫 행 버튼을 은은하게 알린다. 두 번(4.8초)만: 5초 넘게 움직이면 멈출 방법이 있어야 함(WCAG 2.2.2) */
.prep-btn.is-pulse {
  animation: prep-pulse 2.4s ease-in-out 2;
}

@keyframes prep-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--rq-accent-border);
  }

  50% {
    box-shadow: 0 0 0 0.6rem var(--rq-accent-border);
  }
}

/* ── 휴대폰 카드 ────────────────────────────────────── */
.app-cards {
  display: none;
}

@media (max-width: 767px) {
  .sub-tabs {
    margin-bottom: 1.6rem;
  }

  .sub-tab {
    min-height: var(--rq-touch);
    padding: 0.4rem 0.6rem;
    font-size: var(--krds-pc-font-size-label-xsmall);
  }

  .guide {
    margin-bottom: 1.6rem;
    padding: 1.2rem 1.6rem;
  }

  /* AI 라벨을 문장 앞에 붙여 한 줄을 아낀다 */
  .guide-title {
    display: block;
  }

  .guide-title :deep(.ai-label) {
    margin-right: 0.6rem;
  }

  /* 휴대폰은 1행 버튼이 바로 아래 보여 "바로 해 보기"를 두지 않는다(첫 화면에 1행 버튼, Q-04) */
  .guide-try {
    display: none;
  }

  /* 휴대폰은 1행 버튼이 바로 아래 보이고 깜빡여 가리키므로 둘째 문장은 화면낭독기에만 남긴다(DA-07) */
  .guide-text {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  /* 목록이 검색 상자 앞에 온다(DA-07) */
  .count {
    margin: 0 0 1.2rem;
  }

  .search-box {
    margin-top: 2.4rem;
    padding: 1.6rem;
  }

  .search-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
  }

  .radio {
    min-height: var(--rq-touch);
  }

  .date-range .input {
    flex: 1;
    width: auto;
  }

  .table-wrap {
    display: none;
  }

  .app-cards {
    display: grid;
    gap: 1.2rem;
  }

  .app-card {
    padding: 1.6rem;
    border: 1px solid var(--krds-light-color-border-gray-light);
    border-radius: var(--krds-radius-large1);
    background: var(--krds-light-color-surface-white);
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8rem;
    margin-top: 1.2rem;
    font-size: var(--krds-pc-font-size-body-small);
  }

  .meta dt {
    font-size: var(--krds-pc-font-size-label-xsmall);
    color: var(--krds-light-color-text-subtle);
  }

  /* 이름표와 버튼을 한 줄에(DA-07: 1행 버튼이 첫 화면에 들게) */
  .card-prep {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 1.2rem;
    margin-top: 1.4rem;
    padding: 1rem 1rem 1rem 1.2rem;
    border-radius: var(--krds-radius-medium3);
    background: var(--rq-accent-subtle);
  }

  .card-prep-label {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--krds-pc-font-size-label-xsmall);
    font-weight: 700;
    color: var(--rq-accent-strong);
  }

  .card-prep .prep-btn {
    flex: 1;
    min-width: 0;
  }

  .card-prep .prep-status {
    flex-basis: 100%;
    text-align: right;
  }

  .app-cards .empty {
    padding: 3.2rem 1.6rem !important;
    border: 1px dashed var(--krds-light-color-border-gray);
    border-radius: var(--krds-radius-large1);
  }
}
</style>
