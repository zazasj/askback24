<script setup lang="ts">
/**
 * 신뢰 페이지(S4-24). 처리 단계 3개 · 점검 숫자 · 데이터 출처("실제"/"모의") · 개인정보 원칙.
 * 숫자와 출처는 정적 데이터에서 세므로 데이터를 바꾸면 이 페이지도 같이 바뀐다.
 */
import { useRouter } from 'vue-router'
import { CARD_BOOK } from '@shared/catalog'
import { API_MODE } from '@/api/client'
import AiLabel from '@/components/ui/AiLabel.vue'
import MockModeTag from '@/components/ui/MockModeTag.vue'
import { auditNumbers, sourceRows } from '@/features/about/aboutData'

const router = useRouter()
const isMock = API_MODE === 'mock'
const numbers = auditNumbers()
const sources = sourceRows()
const typeOrder = Object.values(CARD_BOOK.type_labels).join(' → ')

/** "2026-10-25" → ["2026.", "10.25"](휴대폰 좁은 칸에서 연도 뒤에서만 줄이 바뀌게) */
function dateParts(iso: string): [string, string] {
  const [y = '', m = '', d = ''] = iso.split('-')
  return [`${y}.`, `${m}.${d}`]
}

// 앞 화면(③ 등)에서 왔으면 뒤로 가기, 주소로 바로 열었으면 지원 내역으로
const cameFromApp = typeof window !== 'undefined' && typeof (window.history.state as { back?: unknown } | null)?.back === 'string'

function goBack(): void {
  router.back()
}
</script>

<template>
  <div class="about">
    <div class="title-row">
      <h1 class="page-title">이 질문은 어떻게 만들어지나요</h1>
      <AiLabel />
    </div>
    <p class="lead">
      면접 역질문 준비는 AI 혼자 질문을 정하지 않아요. 공고 근거와 정해 둔 순서 규칙이 먼저 질문을 고르고, AI는 그 질문의 문장을 써요. AI가 쓴
      문장도 검사를 통과해야 화면에 나와요.
    </p>
    <!-- 결과·만드는 중 화면과 같은 태그(D-082). 확인하러 온 이 자리에서 실제 AI 결과로 읽히지 않게(DR-r2-04) -->
    <p v-if="isMock" class="mock-note">
      <MockModeTag />
      <span>
        지금 시연은 가짜 응답 모드라 1단계 공고 분석은 공고 {{ numbers.postings }}건을 미리 분석해 둔 결과이고, 3단계 문장과 1차 면접 답 판정은 AI 대신
        규칙과 예시 문장으로 만들어요. 순서·근거·검사는 같아요.
      </span>
    </p>

    <section class="block" aria-labelledby="about-steps">
      <h2 id="about-steps" class="section-title">처리 단계</h2>
      <ol class="steps">
        <li class="step">
          <span class="step-no" aria-hidden="true">1</span>
          <div class="step-body">
            <h3 class="step-title">공고 근거 확인</h3>
            <p>
              AI가 공고 문장을 백엔드 업무 카드 {{ numbers.cards }}개와 맞춰 봐요. 근거는 공고 원문의 글자 그대로만 써요. 원문에 없는 근거는 형광펜이 칠해지지
              않고 질문에도 쓰지 않아요.
            </p>
          </div>
        </li>
        <li class="step">
          <span class="step-no" aria-hidden="true">2</span>
          <div class="step-body">
            <h3 class="step-title">질문 순서 정하기</h3>
            <p>
              내가 고른 기대·걱정과 공고에 적힌 정도를 견줘 차이가 큰 것부터 5개를 골라요. 순서는 AI가 아니라 정해 둔 규칙이 정해요. 유형은 {{ typeOrder }}
              순서예요.
            </p>
          </div>
        </li>
        <li class="step">
          <span class="step-no" aria-hidden="true">3</span>
          <div class="step-body">
            <h3 class="step-title">AI가 문장 쓰고 검사하기</h3>
            <p>
              <!-- shared/validate.ts 가 실제로 보는 것만 적는다(A2-11) -->
              AI가 쓴 문장마다 질문의 근거 인용과 문장 속 '…' 인용(카드 이름은 빼고)이 공고 원문에 글자 그대로 있는지, 공고에 없는 업무를
              "공고에 …있던데"처럼 말하는지, 나이·결혼·출신 같은 금지어, 길이를 검사해요. 통과하지 못하거나 AI 응답이 늦으면 미리 검수한 문장으로 바꾸고 "검수 문장" 표시를 달아요.
            </p>
          </div>
        </li>
      </ol>
      <p class="after">
        1차 면접을 다녀와 물어본 질문과 들은 답을 정리하면, 아직 모르는 것과 처우(임금·근무시간·수습) 질문을 최종 면접용으로 다시 골라요. 들은 답은
        구체적이었는지만 보고 회사를 평가하지 않아요. 걱정한 업무는 답이 구체적이어도 걱정이 풀렸는지 알 수 없어 아직 모름으로 남겨요.
      </p>
    </section>

    <section class="block" aria-labelledby="about-numbers">
      <h2 id="about-numbers" class="section-title">점검 숫자</h2>
      <dl class="numbers">
        <div class="number">
          <dt>업무 카드</dt>
          <dd><strong>{{ numbers.cards }}</strong>개</dd>
        </div>
        <div class="number">
          <dt>분석한 모의 공고</dt>
          <dd><strong>{{ numbers.postings }}</strong>건</dd>
        </div>
        <div class="number">
          <dt>원문에 그대로 있는 근거</dt>
          <dd>
            <strong>{{ numbers.quotesFound }}</strong>개 / {{ numbers.quotes }}개
          </dd>
        </div>
        <div class="number">
          <dt>검수 문장 틀</dt>
          <dd><strong>{{ numbers.templates }}</strong>개</dd>
        </div>
      </dl>
      <p class="muted small">근거 인용이 원문에 없으면 형광펜이 칠해지지 않아요. 그래서 두 숫자가 같아야 해요.</p>
    </section>

    <section class="block" aria-labelledby="about-sources">
      <h2 id="about-sources" class="section-title">데이터 출처</h2>
      <p class="muted">
        "실제"는 실제 공공 자료를 출처로 쓰는 항목, "모의"는 시연용으로 만든 항목이에요. 고용24 오픈API 값은 미리 받아 저장해 두고, 화면에서는
        API를 부르지 않아요.
      </p>
      <table class="source-table">
        <caption class="sr-only">
          데이터 출처: 데이터, 출처, 구분, 받은 날짜
        </caption>
        <colgroup>
          <col class="w-data" />
          <col />
          <col class="w-source" />
          <col class="w-date" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">데이터</th>
            <th scope="col">출처</th>
            <th scope="col">구분</th>
            <th scope="col">받은 날짜</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in sources" :key="`${r.data}-${r.origin}`">
            <th scope="row">{{ r.data }}</th>
            <td>
              <span class="origin">{{ r.origin }}</span>
              <span class="note">{{ r.note }}</span>
            </td>
            <td>
              <span class="source" :class="r.source === '실제' ? 'is-real' : 'is-mock'">{{ r.source }}</span>
            </td>
            <td class="date">
              <time v-if="r.fetched" :datetime="r.fetched">{{ dateParts(r.fetched)[0] }}<wbr />{{ dateParts(r.fetched)[1] }}</time>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="block" aria-labelledby="about-privacy">
      <h2 id="about-privacy" class="section-title">개인정보</h2>
      <ul class="privacy">
        <!-- 최종 요청(shared/contract.ts InterviewReview)에 실리는 것을 빠짐없이 적는다(A2-09) -->
        <li>
          질문을 만들 때 AI에 보내는 것은 고른 카드와 경험 한 줄이고, 최종 면접 준비 때는 1차 면접에서 들은 답·못 물은 이유·면접 분위기·회사가
          물어본 업무까지예요. 이력서 전체는 보내지 않아요.
        </li>
        <li v-if="isMock">지금 시연은 가짜 응답 모드라 AI에 아무것도 보내지 않아요.</li>
        <li>서버는 경험 한 줄·들은 답·면접 분위기를 저장하거나 기록하지 않아요.</li>
        <li>고른 카드와 질문 결과는 이 브라우저에만 저장되고, 들은 답은 브라우저에도 저장하지 않아요.</li>
      </ul>
    </section>

    <div class="bottom-actions">
      <button v-if="cameFromApp" type="button" class="btn btn-tertiary" @click="goBack">이전 화면으로</button>
      <RouterLink v-else to="/mypage/applications" class="btn btn-tertiary">지원 내역에서 시작하기</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.about {
  display: grid;
  gap: 3.2rem;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.2rem;
}

.lead {
  max-width: 80rem;
  margin-top: -1.6rem;
  font-size: var(--krds-pc-font-size-body-medium);
  color: var(--krds-light-color-text-basic);
}

.mock-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  max-width: 80rem;
  margin-top: -1.6rem;
  padding: 1.2rem 1.6rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.block {
  display: grid;
  gap: 1.6rem;
}

/* ── 처리 단계 ─────────────────────────────────────── */
.steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.6rem;
}

.step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 1.2rem;
  padding: 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: var(--krds-radius-max);
  background: var(--rq-accent);
  color: var(--rq-on-accent);
  font-weight: 700;
}

.step-body {
  display: grid;
  gap: 0.6rem;
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.step-title {
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.after {
  padding: 1.6rem 2rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-small);
}

/* ── 점검 숫자 ─────────────────────────────────────── */
.numbers {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.2rem;
}

.number {
  display: grid;
  gap: 0.4rem;
  padding: 1.6rem 2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.number dt {
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.number dd {
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.number strong {
  margin-right: 0.2rem;
  font-size: var(--krds-pc-font-size-heading-medium);
  line-height: 1.2;
  color: var(--krds-light-color-text-bolder);
}

.small {
  font-size: var(--krds-pc-font-size-body-xsmall);
}

/* ── 데이터 출처 표 ────────────────────────────────── */
.source-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
  font-size: var(--krds-pc-font-size-body-small);
}

.source-table .w-data {
  width: 16rem;
}

.source-table .w-source {
  width: 9.6rem;
}

.source-table .w-date {
  width: 11.2rem;
}

.source-table .date {
  color: var(--krds-light-color-text-basic);
  white-space: nowrap;
}

.source-table th,
.source-table td {
  padding: 1.4rem 1.6rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  text-align: left;
  vertical-align: top;
}

.source-table thead th {
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.source-table tbody th {
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.origin {
  display: block;
  color: var(--krds-light-color-text-basic);
}

.note {
  display: block;
  margin-top: 0.2rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

/* S4 ① 회사 신호 배지와 같은 모양 */
.source {
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

/* ── 개인정보 ──────────────────────────────────────── */
.privacy {
  display: grid;
  gap: 0.8rem;
  padding-left: 2rem;
  list-style: disc;
  font-size: var(--krds-pc-font-size-body-small);
}

.bottom-actions {
  display: flex;
  justify-content: center;
}

@media (max-width: 1023px) {
  .steps {
    grid-template-columns: minmax(0, 1fr);
  }

  .numbers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .about {
    gap: 2.4rem;
  }

  .lead,
  .mock-note {
    margin-top: -0.8rem;
  }

  .mock-note {
    padding: 1rem 1.2rem;
  }

  .step {
    padding: 1.6rem;
  }

  .number {
    padding: 1.2rem 1.4rem;
  }

  .source-table .w-data {
    width: 8.8rem;
  }

  .source-table .w-source {
    width: 6.4rem;
  }

  .source-table .w-date {
    width: 6.4rem;
  }

  .source-table .date {
    white-space: normal;
  }

  .source-table th,
  .source-table td {
    padding: 1.2rem 0.8rem;
  }

  .bottom-actions .btn {
    width: 100%;
  }
}
</style>
