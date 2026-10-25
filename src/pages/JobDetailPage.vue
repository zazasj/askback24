<script setup lang="ts">
/**
 * S3 채용정보 상세 — 고용24 공고 상세처럼 요약 상자 + 모집요강 / 근무조건 / 기업정보 묶음.
 * "입사지원" → 대화상자 → 지원 내역 맨 위에 한 줄(지원결과 "-"). 이미 지원한 공고는 "지원 완료"(비활성).
 */
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { getPosting } from '@shared/catalog'
import NotFoundContent from '@/components/ui/NotFoundContent.vue'
import ApplyDialog from '@/features/jobs/ApplyDialog.vue'
import PostingText from '@/features/jobs/PostingText.vue'
import { DETAIL_SECTIONS, EMPTY_TEXT, rowCode, rowText, salaryText } from '@/features/jobs/postingView'
import { usePageTitle } from '@/lib/title'
import { useDemoStore } from '@/stores/demo'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const demo = useDemoStore()
const toast = useToastStore()

const posting = computed(() => getPosting(String(route.params.wantedAuthNo ?? '')))
usePageTitle(() => posting.value?.wantedTitle)

const applied = computed(() => (posting.value ? demo.hasApplied(posting.value.wantedAuthNo) : false))

const summary = computed(() => {
  const p = posting.value
  if (!p) return []
  return [
    { label: '경력', text: p.enterTpNm },
    { label: '학력', text: p.eduNm },
    { label: '임금', text: salaryText(p) },
    { label: '근무지역', text: p.workRegion },
    { label: '고용형태', text: p.empTpNm },
    { label: '접수마감', text: p.receiptCloseDt },
  ]
})

const sections = computed(() => {
  const p = posting.value
  if (!p) return []
  return DETAIL_SECTIONS.map((s) => ({
    ...s,
    rows: s.rows.map((r) => ({ label: r.label, text: rowText(p, r), code: rowCode(p, r), block: !!r.block })),
  }))
})

const dialogOpen = ref(false)
const applyButton = useTemplateRef<HTMLButtonElement>('applyButton')
const doneNote = useTemplateRef<HTMLElement>('doneNote')

function cancel(): void {
  dialogOpen.value = false
  void nextTick(() => applyButton.value?.focus())
}

function submit(): void {
  const p = posting.value
  if (!p || applied.value) return
  demo.apply(p.wantedAuthNo)
  dialogOpen.value = false
  toast.show('지원했어요. 알선/입사지원 내역에서 면접 역질문을 준비할 수 있어요', 4500)
  // "입사지원" 버튼이 사라지므로 초점을 다음 할 일 안내로 옮긴다
  void nextTick(() => doneNote.value?.focus())
}
</script>

<template>
  <NotFoundContent v-if="!posting" detail="이 공고를 찾을 수 없어요." />
  <article v-else class="s3-detail" aria-labelledby="posting-title">
    <header class="detail-head">
      <p class="corp">
        <strong>{{ posting.corpNm }}</strong>
        <span class="corp-meta">{{ posting.indTpNm }}</span>
      </p>
      <div class="title-row">
        <h1 id="posting-title" class="page-title">{{ posting.wantedTitle }}</h1>
        <span class="badge">모의 공고</span>
      </div>
    </header>

    <section class="summary" aria-label="공고 요약">
      <dl class="summary-list">
        <div v-for="s in summary" :key="s.label" class="summary-item">
          <dt>{{ s.label }}</dt>
          <dd :class="{ 'is-empty': !s.text }">{{ s.text || EMPTY_TEXT }}</dd>
        </div>
      </dl>
      <div class="apply-box">
        <button v-if="!applied" ref="applyButton" type="button" class="btn btn-primary btn-lg apply-btn" @click="dialogOpen = true">
          입사지원
        </button>
        <template v-else>
          <button type="button" class="btn btn-lg apply-btn" disabled>지원 완료</button>
          <p ref="doneNote" class="done-note" tabindex="-1">
            지원한 공고예요. <RouterLink to="/mypage/applications">알선/입사지원 내역</RouterLink>에서 면접 역질문을 준비할 수 있어요.
          </p>
        </template>
      </div>
    </section>

    <section v-for="s in sections" :key="s.id" class="detail-section" :aria-labelledby="`section-${s.id}`">
      <h2 :id="`section-${s.id}`" class="section-title">{{ s.title }}</h2>
      <table class="detail-table">
        <caption class="sr-only">
          {{ s.title }}
        </caption>
        <colgroup>
          <col class="col-head" />
          <col />
        </colgroup>
        <tbody>
          <tr v-for="r in s.rows" :key="r.label">
            <th scope="row">{{ r.label }}</th>
            <td>
              <PostingText v-if="r.text && r.block" :text="r.text" />
              <span v-else-if="r.text" class="cell-text"
                >{{ r.text }}<template v-if="r.code">{{ ' ' }}<span class="cell-code">{{ r.code }}</span></template></span
              >
              <span v-else class="is-empty">{{ EMPTY_TEXT }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p class="mock-note">회사명과 공고는 예시예요. 고용24 채용정보 항목 이름을 따라 만든 모의 공고예요.</p>

    <div class="bottom-actions">
      <RouterLink to="/jobs" class="btn btn-tertiary">목록으로</RouterLink>
    </div>

    <ApplyDialog :open="dialogOpen" :corp-nm="posting.corpNm" :wanted-title="posting.wantedTitle" @cancel="cancel" @submit="submit" />
  </article>
</template>

<style scoped>
.s3-detail {
  display: grid;
  gap: 3.2rem;
}

.detail-head {
  display: grid;
  gap: 0.6rem;
}

.corp {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
  font-size: var(--krds-pc-font-size-body-medium);
  color: var(--krds-light-color-text-bolder);
}

.corp-meta {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-subtle);
  align-self: center;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.2rem;
}

/* ── 요약 상자 ─────────────────────────────────────── */
.summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2.4rem;
  padding: 2.4rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
}

.summary-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.6rem 2.4rem;
}

.summary-item {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.summary-item dt {
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.summary-item dd {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-bolder);
}

.apply-box {
  display: grid;
  justify-items: stretch;
  gap: 0.8rem;
  width: 22rem;
}

.done-note {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-basic);
}

/* 회색 상자 위라 기본 링크색(primary-50)은 대비가 모자라 한 단계 진하게 */
.done-note a {
  color: var(--krds-light-color-link-hover);
  font-weight: 700;
}

.done-note:focus {
  outline: none;
}

.done-note:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
}

/* ── 상세 표 ───────────────────────────────────────── */
.detail-section {
  display: grid;
  gap: 1.2rem;
}

.detail-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
  font-size: var(--krds-pc-font-size-body-small);
}

.detail-table .col-head {
  width: 14rem;
}

.detail-table th,
.detail-table td {
  padding: 1.4rem 1.6rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  text-align: left;
  vertical-align: top;
}

.detail-table th {
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.detail-table td {
  line-height: 1.75;
}

.cell-text {
  white-space: pre-line;
}

/* 공통코드(실제 값)를 이름 뒤에 작게(H1-08) */
.cell-code {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.is-empty {
  color: var(--krds-light-color-text-subtle);
}

.mock-note {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.bottom-actions {
  display: flex;
  justify-content: center;
}

@media (max-width: 1023px) {
  .summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .apply-box {
    width: auto;
  }
}

@media (max-width: 767px) {
  .s3-detail {
    gap: 2.4rem;
  }

  .summary {
    padding: 1.6rem;
    gap: 1.6rem;
  }

  .summary-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.2rem 1.6rem;
  }

  .detail-table .col-head {
    width: 8.8rem;
  }

  .detail-table th,
  .detail-table td {
    padding: 1.2rem 1rem;
  }

  .bottom-actions .btn {
    width: 100%;
  }
}
</style>
