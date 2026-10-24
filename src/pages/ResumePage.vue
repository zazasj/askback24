<script setup lang="ts">
/**
 * S2 이력서/자기소개서 관리 — 가상 인물 김00(data/persona.json, 설계 노트 S2 표 그대로).
 * 고용24 이력서 상세의 구조(버튼 줄 → 소유자 상자 → 섹션별 표)만 따르고, 출력 말고는 시연 범위 밖이다.
 * 경력·직업훈련·프로젝트의 경험 세 줄이 S4 ② "이력서에서 가져오기" 칩이 된다.
 */
import { PERSONA } from '@/demoData'
import { vDemoOff } from '@/lib/demoOff'

const p = PERSONA
/** 흐린 버튼(G-14)을 눌렀을 때의 알림 */
const NOT_IN_DEMO = '시연에서는 이력서 출력만 쓸 수 있어요'

const BASIC: ReadonlyArray<{ label: string; value: string; note?: string }> = [
  { label: '성명', value: p.basic.name },
  { label: '성별·나이', value: `${p.basic.gender} · ${p.basic.birth_year}년생 (${p.basic.age}세)` },
  { label: '휴대전화', value: p.basic.phone, note: '시연용' },
  { label: '이메일', value: p.basic.email, note: '시연용' },
  { label: '주소', value: p.basic.address },
  { label: '병역', value: p.basic.military },
]

const HOPE: ReadonlyArray<{ label: string; value: string }> = [
  { label: '희망직종', value: p.hope.job },
  { label: '경력 구분', value: p.hope.career },
  { label: '희망지역', value: p.hope.region },
  { label: '희망임금', value: p.hope.salary },
  { label: '고용형태', value: p.hope.employment },
  { label: '근무 형태', value: p.hope.workdays },
]

function printResume(): void {
  window.print()
}

</script>

<template>
  <div class="s2">
    <h1 class="page-title">이력서/자기소개서 관리</h1>

    <div class="toolbar" data-print="hide">
      <button v-demo-off="NOT_IN_DEMO" type="button" class="btn btn-tertiary">이메일 보내기</button>
      <button v-demo-off="NOT_IN_DEMO" type="button" class="btn btn-tertiary">항목 순서변경</button>
      <button v-demo-off="NOT_IN_DEMO" type="button" class="btn btn-tertiary">수정</button>
      <button type="button" class="btn btn-secondary" @click="printResume">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M5.5 7V2.8h9V7M5.5 14.5H3.2V8.2c0-.7.5-1.2 1.2-1.2h11.2c.7 0 1.2.5 1.2 1.2v6.3h-2.3M5.5 11.5h9v5.7h-9z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
        이력서 출력
      </button>
    </div>

    <section class="owner" aria-label="이력서 요약">
      <div class="photo" aria-hidden="true">
        <svg viewBox="0 0 48 56" width="48" height="56" focusable="false">
          <circle cx="24" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="2.4" />
          <path d="M6 54c1.5-10 9-16 18-16s16.5 6 18 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </div>
      <div class="owner-body">
        <p class="owner-title"><strong>{{ p.name }}</strong>님의 이력서입니다</p>
        <p class="resume-name">
          <span class="badge badge-primary">대표 이력서</span>
          <span>{{ p.hope.job }} {{ p.hope.career }} 이력서</span>
        </p>
        <p class="owner-note">{{ p.name }}은 시연용 가상 인물이에요. 연락처와 주소는 예시 값이에요.</p>
      </div>
    </section>

    <section class="resume-section" aria-labelledby="sec-basic">
      <h2 id="sec-basic" class="section-title">기본정보</h2>
      <dl class="kv">
        <div v-for="r in BASIC" :key="r.label" class="kv-row">
          <dt>{{ r.label }}</dt>
          <dd>
            {{ r.value }}
            <span v-if="r.note" class="kv-note">({{ r.note }})</span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="resume-section" aria-labelledby="sec-hope">
      <h2 id="sec-hope" class="section-title">희망조건</h2>
      <dl class="kv">
        <div v-for="r in HOPE" :key="r.label" class="kv-row">
          <dt>{{ r.label }}</dt>
          <dd>{{ r.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="resume-section" aria-labelledby="sec-edu">
      <h2 id="sec-edu" class="section-title">학력</h2>
      <ul class="entries">
        <li v-for="e in p.education" :key="e.school" class="entry">
          <p class="entry-head">
            <strong class="entry-title">{{ e.school }}</strong>
            <span class="entry-sub">{{ e.major }}</span>
          </p>
          <p class="entry-meta">{{ e.degree }} · {{ e.graduated }}</p>
        </li>
      </ul>
    </section>

    <section class="resume-section" aria-labelledby="sec-career">
      <h2 id="sec-career" class="section-title">경력</h2>
      <p v-if="p.careers.length === 0" class="entry-body">경력 사항이 없어요 (신입)</p>
      <ul v-else class="entries">
        <li v-for="c in p.careers" :key="c.company" class="entry">
          <p class="entry-head">
            <strong class="entry-title">{{ c.company }}</strong>
            <span class="entry-sub">{{ c.role }}</span>
          </p>
          <p class="entry-meta">{{ c.period }}</p>
          <p class="entry-body">{{ c.summary }}</p>
        </li>
      </ul>
    </section>

    <section class="resume-section" aria-labelledby="sec-training">
      <h2 id="sec-training" class="section-title">직업훈련</h2>
      <ul class="entries">
        <li v-for="t in p.trainings" :key="t.name" class="entry">
          <p class="entry-head">
            <strong class="entry-title">{{ t.name }}</strong>
          </p>
          <p class="entry-meta">{{ t.period }}</p>
          <p class="entry-body">{{ t.summary }}</p>
        </li>
      </ul>
    </section>

    <section class="resume-section" aria-labelledby="sec-project">
      <h2 id="sec-project" class="section-title">프로젝트</h2>
      <ul class="entries">
        <li v-for="j in p.projects" :key="j.name" class="entry">
          <p class="entry-head">
            <strong class="entry-title">{{ j.name }}</strong>
          </p>
          <p class="entry-meta">{{ j.stack }}</p>
          <p class="entry-body">{{ j.summary }}</p>
        </li>
      </ul>
    </section>

    <section class="resume-section" aria-labelledby="sec-cert">
      <h2 id="sec-cert" class="section-title">자격·어학</h2>
      <table class="cert-table">
        <caption class="sr-only">
          자격·어학: 이름과 취득일
        </caption>
        <thead>
          <tr>
            <th scope="col">자격·어학명</th>
            <th scope="col">취득일</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in p.certificates" :key="c.name">
            <td>{{ c.name }}</td>
            <td>{{ c.date }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="resume-section" aria-labelledby="sec-skill">
      <h2 id="sec-skill" class="section-title">보유 기술</h2>
      <ul class="skills">
        <li v-for="s in p.skills" :key="s" class="skill">{{ s }}</li>
      </ul>
    </section>

    <section class="resume-section" aria-labelledby="sec-intro">
      <h2 id="sec-intro" class="section-title">자기소개서</h2>
      <div class="intro-list">
        <article v-for="(item, i) in p.self_intro" :key="item.title" class="intro-item" :aria-labelledby="`intro-${i}`">
          <h3 :id="`intro-${i}`" class="intro-title">{{ item.title }}</h3>
          <p class="intro-body">{{ item.body }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.s2 {
  display: grid;
  gap: 3.2rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.8rem;
  margin-top: -1.6rem;
}

.toolbar svg {
  width: 1.8rem;
  height: 1.8rem;
}

/* ── 소유자 상자 ───────────────────────────────────── */
.owner {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 2.4rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
}

.photo {
  display: flex;
  flex: none;
  align-items: flex-end;
  justify-content: center;
  width: 8rem;
  height: 9.6rem;
  overflow: hidden;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-medium3);
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-element-gray-light);
}

.photo svg {
  width: 5.6rem;
  height: auto;
}

.owner-body {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}

.owner-title {
  font-size: var(--krds-pc-font-size-body-large);
  color: var(--krds-light-color-text-bolder);
}

.resume-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.8rem;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.owner-note {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

/* ── 섹션 ──────────────────────────────────────────── */
.resume-section {
  display: grid;
  gap: 1.2rem;
}

.kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
  font-size: var(--krds-pc-font-size-body-small);
}

.kv-row {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
}

.kv-row dt {
  padding: 1.4rem 1.6rem;
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.kv-row dd {
  padding: 1.4rem 1.6rem;
  color: var(--krds-light-color-text-basic);
}

.kv-note {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.entries {
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
}

.entry {
  display: grid;
  gap: 0.4rem;
  padding: 1.6rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  font-size: var(--krds-pc-font-size-body-small);
}

.entry-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 1.2rem;
}

.entry-title {
  font-size: var(--krds-pc-font-size-body-medium);
  color: var(--krds-light-color-text-bolder);
}

.entry-sub,
.entry-meta {
  color: var(--krds-light-color-text-subtle);
}

.entry-body {
  color: var(--krds-light-color-text-basic);
}

.cert-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
  font-size: var(--krds-pc-font-size-body-small);
}

.cert-table th,
.cert-table td {
  padding: 1.4rem 1.6rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  text-align: left;
}

.cert-table thead th {
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.cert-table th:last-child,
.cert-table td:last-child {
  width: 14rem;
}

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  padding-top: 1.6rem;
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
}

.skill {
  display: inline-flex;
  align-items: center;
  min-height: 3.2rem;
  padding: 0 1.2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.intro-list {
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
}

.intro-item {
  display: grid;
  gap: 0.6rem;
  padding: 1.6rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
}

.intro-title {
  font-size: var(--krds-pc-font-size-body-medium);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.intro-body {
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.75;
  color: var(--krds-light-color-text-basic);
}

@media (max-width: 1023px) {
  .kv {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .s2 {
    gap: 2.4rem;
  }

  .toolbar {
    justify-content: stretch;
    margin-top: -0.8rem;
  }

  .toolbar .btn {
    flex: 1;
  }

  .owner {
    align-items: flex-start;
    gap: 1.4rem;
    padding: 1.6rem;
  }

  .photo {
    width: 6.4rem;
    height: 7.6rem;
  }

  .photo svg {
    width: 4.4rem;
  }

  .kv-row {
    grid-template-columns: 9.6rem minmax(0, 1fr);
  }

  .kv-row dt,
  .kv-row dd,
  .cert-table th,
  .cert-table td {
    padding: 1.2rem 1rem;
  }

  .entry,
  .intro-item {
    padding: 1.4rem 1rem;
  }

  .cert-table th:last-child,
  .cert-table td:last-child {
    width: 9.6rem;
  }
}
</style>
