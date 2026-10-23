<script setup lang="ts">
/**
 * S1 알선/입사지원 내역(메인). 고용24 표의 열은 그대로 두고 오른쪽에 "면접 준비" 열을 하나 더한다.
 * 그 열과 안내 띠만 우리 기능 강조색 + AI 라벨(DESIGN-REVIEW D4).
 */
import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { getPosting } from '@shared/catalog'
import AiLabel from '@/components/ui/AiLabel.vue'
import { daysBefore, formatDate, parseIsoDate, toIsoDate } from '@/lib/dates'
import { useDemoStore } from '@/stores/demo'
import type { Application } from '@/types'

type ViewedFilter = 'all' | 'viewed' | 'unviewed'

interface Row {
  app: Application
  corpNm: string
  title: string
  appliedIso: string
  appliedText: string
  viewedText: string
  prepLabel: string
}

interface Filter {
  from: string
  to: string
  viewed: ViewedFilter
  q: string
}

const demo = useDemoStore()
const router = useRouter()

function appliedDate(app: Application, now: Date): Date {
  return (app.applied_on && parseIsoDate(app.applied_on)) || daysBefore(app.applied_days_ago ?? 0, now)
}

const rows = computed<Row[]>(() => {
  const now = new Date()
  return demo.applications.flatMap((app) => {
    const posting = getPosting(app.wantedAuthNo)
    if (!posting) return []
    const applied = appliedDate(app, now)
    return [
      {
        app,
        corpNm: posting.corpNm,
        title: posting.wantedTitle,
        appliedIso: toIsoDate(applied),
        appliedText: formatDate(applied),
        viewedText: app.viewed_days_ago === null ? '-' : formatDate(daysBefore(app.viewed_days_ago, now)),
        // 1차 합격이면 최종·처우 단계로 연다(설계 노트 S1)
        prepLabel: app.result === '1차 합격' ? '최종 면접 준비' : '면접 역질문 준비',
      },
    ]
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

function openPrep(r: Row): void {
  void router.push({ name: 'prep', params: { applyId: r.app.apply_id }, query: { step: '1' } })
}

const hasResult = (result: string) => result !== '-'

// 닫기 단추가 사라지면 초점이 문서 처음으로 튀므로 화면 제목으로 옮긴다
const titleEl = useTemplateRef<HTMLHeadingElement>('title')

// 휴대폰은 검색 상자 아래에 지원 건이 있어 첫 화면에 안 보인다. 안내 띠에서 첫 버튼으로 바로 보내고
// 깜빡임을 그때 다시 한 번 보인다(애니메이션 이름을 바꿔야 다시 돈다, DR-r1-07)
const root = useTemplateRef<HTMLElement>('root')
const pulseRun = ref(0)
async function jumpToFirst(): Promise<void> {
  const first = Array.from(root.value?.querySelectorAll<HTMLButtonElement>('.prep-btn') ?? []).find((b) => b.offsetParent !== null)
  if (!first) return
  pulseRun.value++
  await nextTick()
  first.scrollIntoView({ block: 'center' })
  first.focus({ preventScroll: true })
}

function pulseClass(i: number): Record<string, boolean> {
  const on = i === 0 && !demo.guideClosed
  return { 'is-pulse': on && pulseRun.value % 2 === 0, 'is-pulse-again': on && pulseRun.value % 2 === 1 }
}
async function closeGuide(): Promise<void> {
  demo.closeGuide()
  await nextTick()
  titleEl.value?.focus()
}
</script>

<template>
  <div ref="root" class="s1">
    <h1 ref="title" class="page-title" tabindex="-1">알선/입사지원 내역</h1>

    <section v-if="!demo.guideClosed" class="guide" aria-labelledby="guide-title">
      <div class="guide-body">
        <p id="guide-title" class="guide-title">
          <AiLabel />
          <span><strong>새 기능</strong> 지원한 공고로 면접에서 물어볼 질문을 준비해 보세요</span>
        </p>
        <p class="guide-text">맨 위 지원 건의 <strong>면접 역질문 준비</strong>를 누르면 1분 안에 질문까지 받아 볼 수 있어요.</p>
        <button type="button" class="btn btn-accent-outline btn-sm guide-jump" @click="jumpToFirst">맨 위 지원 건으로 가기</button>
      </div>
      <button type="button" class="guide-close" aria-label="안내 닫기" @click="closeGuide">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </section>

    <form class="search-box" role="search" aria-label="지원 내역 검색" @submit.prevent="search">
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

    <p class="count">전체 <strong>{{ filtered.length }}</strong>건</p>

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
              <RouterLink :to="`/jobs/${r.app.wantedAuthNo}`" class="posting tap-target">{{ r.title }}</RouterLink>
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
                @click="openPrep(r)"
              >
                {{ r.prepLabel }}
              </button>
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
        <RouterLink :to="`/jobs/${r.app.wantedAuthNo}`" class="posting tap-target">{{ r.title }}</RouterLink>
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
            @click="openPrep(r)"
          >
            {{ r.prepLabel }}
          </button>
        </div>
      </li>
      <li v-if="!filtered.length" class="empty">검색 결과가 없어요. 검색어나 날짜를 바꿔 보세요.</li>
    </ul>
  </div>
</template>

<style scoped>
.page-title {
  margin-bottom: 2.4rem;
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

.prep-btn.is-pulse-again {
  animation: prep-pulse-again 2.4s ease-in-out 2;
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

@keyframes prep-pulse-again {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--rq-accent-border);
  }

  50% {
    box-shadow: 0 0 0 0.6rem var(--rq-accent-border);
  }
}

/* 데스크톱은 표가 첫 화면에 보여 필요 없다 */
.guide-jump {
  display: none;
}

/* ── 휴대폰 카드 ────────────────────────────────────── */
.app-cards {
  display: none;
}

@media (max-width: 767px) {
  .guide {
    padding: 1.4rem 1.6rem;
  }

  .guide-jump {
    display: inline-flex;
    margin-top: 1rem;
  }

  .search-box {
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

  .card-prep {
    display: grid;
    gap: 0.8rem;
    margin-top: 1.4rem;
    padding: 1.2rem;
    border-radius: var(--krds-radius-medium3);
    background: var(--rq-accent-subtle);
  }

  .card-prep-label {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--krds-pc-font-size-label-xsmall);
    font-weight: 700;
    color: var(--rq-accent-strong);
  }

  .card-prep .prep-btn {
    width: 100%;
  }

  .app-cards .empty {
    padding: 3.2rem 1.6rem !important;
    border: 1px dashed var(--krds-light-color-border-gray);
    border-radius: var(--krds-radius-large1);
  }
}
</style>
