<script setup lang="ts">
/**
 * S3 채용정보 목록 — 모의 공고 표(휴대폰은 카드). 분석 JSON 이 있는 공고만 올린다(설계 노트 S3):
 * 분석이 없는 공고에 지원하면 역질문을 만들 수 없다.
 */
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { POSTINGS, getAnalysis } from '@shared/catalog'
import { EMPTY_TEXT, listOrder, matchesQuery, salaryChunks, salaryText } from '@/features/jobs/postingView'
import { useDemoStore } from '@/stores/demo'

const demo = useDemoStore()
// 표와 카드를 둘 다 그려 CSS로 숨기면 숨은 쪽 글자가 먼저 찾혀서(화면낭독기·찾기), 폭에 맞는 하나만 그린다
const isMobile = useMediaQuery('(max-width: 767px)')

const ALL = listOrder(POSTINGS.filter((p) => getAnalysis(p.wantedAuthNo)))

const query = ref('')
const appliedQuery = ref('')

function search(): void {
  appliedQuery.value = query.value
}

const rows = computed(() =>
  ALL.filter((p) => matchesQuery(p, appliedQuery.value)).map((p) => ({
    p,
    to: `/jobs/${p.wantedAuthNo}`,
    salary: salaryChunks(salaryText(p)),
    applied: demo.hasApplied(p.wantedAuthNo),
  })),
)
</script>

<template>
  <div class="s3">
    <h1 class="page-title">채용정보</h1>
    <p class="lead">백엔드 신입 모의 공고예요. 공고를 열어 입사지원하면 알선/입사지원 내역에 한 줄이 늘어요.</p>

    <form class="search-box" role="search" aria-label="채용정보 검색" @submit.prevent="search">
      <label class="search-label" for="jobs-q">검색어</label>
      <div class="query">
        <input id="jobs-q" v-model="query" type="text" class="input" placeholder="회사명, 채용제목, 직무내용, 지역" />
        <button type="submit" class="btn btn-primary">검색</button>
      </div>
    </form>

    <div class="list-head">
      <p class="count">전체 <strong>{{ rows.length }}</strong>건</p>
      <p class="mock-note"><span class="badge">모의 공고</span> 회사명과 공고는 예시예요</p>
    </div>

    <!-- 데스크톱: 표 -->
    <div v-if="!isMobile" class="table-wrap">
      <table class="gov-table jobs-table">
        <caption class="sr-only">
          채용정보 목록: 회사명과 채용제목, 임금, 근무지역, 경력·학력, 접수마감
        </caption>
        <colgroup>
          <col />
          <col class="w-sal" />
          <col class="w-region" />
          <col class="w-career" />
          <col class="w-close" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">회사명 / 채용제목</th>
            <th scope="col">임금</th>
            <th scope="col">근무지역</th>
            <th scope="col">경력·학력</th>
            <th scope="col">접수마감</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.p.wantedAuthNo">
            <td class="cell-posting">
              <strong class="corp">{{ r.p.corpNm }}</strong>
              <span class="title-line">
                <RouterLink :to="r.to" class="posting tap-target">{{ r.p.wantedTitle }}</RouterLink>
                <span v-if="r.applied" class="badge badge-primary">지원함</span>
              </span>
            </td>
            <td :class="{ 'is-empty': !r.salary.length }">
              <template v-for="(c, i) in r.salary" :key="i"><span class="keep">{{ c }}</span>{{ i < r.salary.length - 1 ? ' ' : '' }}</template>
              <template v-if="!r.salary.length">{{ EMPTY_TEXT }}</template>
            </td>
            <td>{{ r.p.workRegion }}</td>
            <td>
              {{ r.p.enterTpNm }}<br />
              <span class="sub">{{ r.p.eduNm }}</span>
            </td>
            <td>{{ r.p.receiptCloseDt }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="empty">찾는 공고가 없어요. 검색어를 바꿔 보세요.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 휴대폰: 카드 -->
    <ul v-else class="job-cards" aria-label="채용정보 목록">
      <!-- 카드 어디를 눌러도 상세로 가게 제목 링크를 카드 전체로 늘린다(링크는 하나라 화면낭독기에는 제목만, DR-r3-06) -->
      <li v-for="r in rows" :key="r.p.wantedAuthNo" class="job-card">
        <p class="corp">{{ r.p.corpNm }}</p>
        <p class="title-line">
          <RouterLink :to="r.to" class="posting">{{ r.p.wantedTitle }}</RouterLink>
          <span v-if="r.applied" class="badge badge-primary">지원함</span>
        </p>
        <svg class="card-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <dl class="meta">
          <div>
            <dt>임금</dt>
            <dd :class="{ 'is-empty': !r.salary.length }">
              <template v-for="(c, i) in r.salary" :key="i"><span class="keep">{{ c }}</span>{{ i < r.salary.length - 1 ? ' ' : '' }}</template>
              <template v-if="!r.salary.length">{{ EMPTY_TEXT }}</template>
            </dd>
          </div>
          <div>
            <dt>근무지역</dt>
            <dd>{{ r.p.workRegion }}</dd>
          </div>
          <div>
            <dt>경력</dt>
            <dd>{{ r.p.enterTpNm }}</dd>
          </div>
          <div>
            <dt>접수마감</dt>
            <dd>{{ r.p.receiptCloseDt }}</dd>
          </div>
        </dl>
      </li>
      <li v-if="!rows.length" class="empty">찾는 공고가 없어요. 검색어를 바꿔 보세요.</li>
    </ul>
  </div>
</template>

<style scoped>
.page-title {
  margin-bottom: 0.8rem;
}

.lead {
  margin-bottom: 2.4rem;
  color: var(--krds-light-color-text-subtle);
}

/* ── 검색 상자 ──────────────────────────────────────── */
.search-box {
  display: grid;
  grid-template-columns: 9.6rem minmax(0, 1fr);
  align-items: center;
  gap: 1.2rem;
  padding: 2rem 2.4rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
}

.search-label {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.query {
  display: flex;
  gap: 0.8rem;
}

.query .input {
  flex: 1;
  min-width: 0;
  max-width: 48rem;
}

.list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem 1.6rem;
  margin: 3.2rem 0 1.2rem;
}

.count {
  font-size: var(--krds-pc-font-size-body-small);
}

.count strong {
  color: var(--krds-light-color-text-primary);
}

.mock-note {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

/* 임금 글은 금액·단위·괄호 묶음 사이에서만 줄이 바뀐다(DA-06, postingView salaryChunks) */
.keep {
  white-space: nowrap;
}

/* ── 표 ─────────────────────────────────────────────── */
.jobs-table .w-sal {
  width: 20rem;
}

.jobs-table .w-region {
  width: 15rem;
}

.jobs-table .w-career {
  width: 17rem;
}

.jobs-table .w-close {
  width: 11rem;
}

.cell-posting {
  text-align: left !important;
}

.corp {
  display: block;
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.title-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  margin-top: 0.2rem;
}

.posting {
  color: var(--krds-light-color-text-basic);
  font-size: var(--krds-pc-font-size-body-medium);
  text-decoration: none;
}

.posting:hover {
  color: var(--krds-light-color-link-hover);
  text-decoration: underline;
}

.sub {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.is-empty {
  color: var(--krds-light-color-text-subtle);
}

.empty {
  padding: 4rem 1.2rem !important;
  color: var(--krds-light-color-text-subtle);
  text-align: center;
}

/* ── 휴대폰 카드 ────────────────────────────────────── */
.job-cards {
  display: grid;
  gap: 1.2rem;
}

@media (max-width: 767px) {
  .search-box {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    padding: 1.6rem;
  }

  .job-card {
    position: relative;
    padding: 1.6rem 4rem 1.6rem 1.6rem;
    border: 1px solid var(--krds-light-color-border-gray-light);
    border-radius: var(--krds-radius-large1);
    background: var(--krds-light-color-surface-white);
  }

  .job-card:active,
  .job-card:focus-within {
    border-color: var(--krds-light-color-border-primary);
  }

  .job-card .posting {
    font-weight: 700;
  }

  .job-card .posting::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .card-chevron {
    position: absolute;
    top: 1.8rem;
    right: 1.4rem;
    width: 1.8rem;
    height: 1.8rem;
    color: var(--krds-light-color-text-subtle);
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem 1.2rem;
    margin-top: 1.2rem;
    font-size: var(--krds-pc-font-size-body-small);
  }

  .meta dt {
    font-size: var(--krds-pc-font-size-label-xsmall);
    color: var(--krds-light-color-text-subtle);
  }

  .job-cards .empty {
    padding: 3.2rem 1.6rem !important;
    border: 1px dashed var(--krds-light-color-border-gray);
    border-radius: var(--krds-radius-large1);
  }
}
</style>
