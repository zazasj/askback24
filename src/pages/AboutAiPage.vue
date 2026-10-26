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
import { TEAM_MEASURE, auditNumbers, sourceRows, wageBlankRate } from '@/features/about/aboutData'

const router = useRouter()
const isMock = API_MODE === 'mock'
const numbers = auditNumbers()
const sources = sourceRows()
const typeOrder = Object.values(CARD_BOOK.type_labels).join(' → ')
const team = TEAM_MEASURE
const wageRate = wageBlankRate()

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
    <!-- 서비스 목적과 근거 숫자(H1-03 ①③). 숫자는 현상만 말하고, 이 서비스가 그 숫자를 줄인다고 쓰지 않는다 -->
    <section class="purpose" aria-labelledby="about-purpose">
      <h2 id="about-purpose" class="sr-only">서비스 목적</h2>
      <p class="purpose-line">
        입사 전에 하게 될 일과 근로조건이 내 기대와 맞는지 면접에서 확인하도록 돕는 서비스예요. 지원할 곳을 추천하지 않고, 이미 지원한
        공고의 면접 준비를 도와요.
      </p>
      <p class="purpose-stat">
        <span class="stat-label">첫 직장 1년 안 이탈</span>
        <strong class="stat-value">38.5%</strong>
      </p>
      <p class="purpose-source">출처: 국가데이터처 MDIS 경제활동인구조사 청년층 부가조사(2024~2026.5) 팀 자체 분석</p>
    </section>
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
      <!-- 운영 그림(H1-07 ①②). 앞날 일은 약속이 아니라 계획으로 적고, 추정치가 없는 비용 숫자는 넣지 않는다 -->
      <section class="plan" aria-labelledby="about-plan">
        <h3 id="about-plan" class="plan-title">고용24에 붙이면</h3>
        <ul class="plan-list">
          <li>공고 분석은 공고마다 한 번 만들고, 공고가 고쳐지면 다시 만들 계획이에요.</li>
          <li>AI 문장은 "질문 만들기"를 누를 때만 써요.</li>
          <li>처음에는 백엔드 개발 공고부터 다룰 계획이에요. 지금 시연의 모의 공고 {{ numbers.postings }}건은 미리 분석해 둔 결과예요.</li>
          <li>채용정보 상세에서도 면접을 준비하도록 넓힐 계획이에요.</li>
        </ul>
      </section>
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
        <!-- 팀이 공개 화면에서 직접 센 숫자(H1-23). 늘 같은 "근거 n/n"과 달리 모의 공고를 왜 이렇게 만들었는지 보인다 -->
        <div class="number is-wide">
          <dt>팀 실측 · 고용24 '{{ team.query }}' 공개 공고 {{ team.postings }}건</dt>
          <dd>
            <span class="keep">임금 빈칸·협의 <strong>{{ team.wageBlank }}</strong>건({{ wageRate }}%)</span> ·
            <span class="keep">근무시간 빈칸 <strong>{{ team.hoursBlank }}</strong>건</span>
            <span class="measured">{{ team.measuredOn }} 팀 측정</span>
          </dd>
        </div>
      </dl>
      <p class="muted small">근거 인용이 원문에 없으면 형광펜이 칠해지지 않아요. 그래서 두 숫자가 같아야 해요.</p>
      <!-- 이용 기록은 모으지 않는다(H1-19 나). 품질은 팀이 직접 재는 점검으로 말한다 -->
      <p class="muted small">
        이용 기록(복사·인쇄 누름)은 모으지 않아요. 품질은 팀 점검으로 재요. 공고 분석 근거가 원문과 맞는지, 질문이
        공고에 없는 일을 있는 것처럼 말하지 않는지 팀이 직접 확인해요.
      </p>
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

    <!-- 기획안과 화면이 다른 곳을 밝힌다(H1-20). 근거는 DECISIONS D-182·D-183·D-191 -->
    <section class="block" aria-labelledby="about-changes">
      <h2 id="about-changes" class="section-title">기획안 뒤 달라진 점</h2>
      <ul class="changes">
        <li>질문 유형 "충돌 확인"을 "차이 확인"으로 바꿨어요. 회사와 맞서는 말로 읽힐 수 있어서예요.</li>
        <li>
          데이터는 출처마다 "실제"와 "모의"로 나눠 보여요. 직업정보는 공고 직종과 같은 응용 소프트웨어 개발자로 맞췄고, 강소기업 수는
          15,282건 기준이에요.
        </li>
        <li>1차 면접 질문만 주던 흐름에 1차 면접 정리와 최종 질문 단계를 더했어요.</li>
      </ul>
    </section>

    <section class="block" aria-labelledby="about-privacy">
      <h2 id="about-privacy" class="section-title">개인정보</h2>
      <ul class="privacy">
        <!-- 최종 요청(shared/contract.ts InterviewReview)에 실리는 것을 빠짐없이 적는다(A2-09).
             우리 서버로 가는 것과 AI 처리 기관으로 가는 것을 나눈다(A3-r1-09, docs/API-SPEC.md 「화면 입력 → 요청 값」).
             시연(가짜 응답 모드)은 브라우저 밖으로 나가는 것이 없어 두 줄은 "실제 서비스에서"로 시점을 밝힌다(A3-r2-05) -->
        <li>
          실제 서비스에서 우리 서버로 보내는 것은 고른 카드·경험 한 줄이고, 최종 면접 준비 때는 1차 면접 정리(들은 답·못 물은 이유·면접
          분위기·회사가 물어본 업무)까지예요. 이력서 전체는 보내지 않아요.
        </li>
        <li>
          실제 서비스에서 AI로 넘기는 것은 공고 원문과, 1차 질문 때는 질문에 쓸 상위 5개 카드와 그 카드의 기대·걱정, 붙일 질문이 있을 때의
          경험 한 줄이에요. 최종 면접 준비 때 답 판정에는 들은 답·구체적이었는지·기대·걱정을, 질문 문장에는 물어봤는지·회사가 물어본
          업무·1차 판정 결과·면접 분위기에 맞춘 말투를 넘기고, 들은 답은 넘기지 않아요.
        </li>
        <li v-if="isMock">
          지금 시연은 가짜 응답 모드라 고른 것과 적은 글이 이 브라우저 밖으로 나가지 않아요(우리 서버·AI 모두). 질문도 이 브라우저 안에서
          만들어요.
        </li>
        <li>서버는 경험 한 줄·들은 답·면접 분위기를 저장하거나 기록하지 않아요.</li>
        <li>고른 카드·경험 한 줄과 질문 결과는 이 브라우저에만 저장되고, 들은 답은 브라우저에도 저장하지 않아요.</li>
        <!-- 함께 쓰는 PC(H1-22)와 실제로 붙일 때의 계획(H2-05). 공공 서비스의 약속이 아니라 계획으로 적는다 -->
        <li>함께 쓰는 PC라면 다 본 뒤 "시연 도구"의 시연 초기화로 지워 주세요.</li>
        <li>
          고용24에 붙이면 AI 처리 기관을 개인정보 처리방침에 위탁으로 알리고, 보낸 글은 질문을 만든 뒤 남기지 않을 계획이에요. 만든
          질문은 마이페이지 계정에 저장할 계획이에요.
        </li>
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

.purpose {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem 2.4rem;
  max-width: 80rem;
  margin-top: -1.6rem;
  padding: 1.6rem 2rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.purpose-line {
  grid-column: 1;
  font-size: var(--krds-pc-font-size-body-medium);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.purpose-stat {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: grid;
  justify-items: end;
  gap: 0.2rem;
  text-align: right;
}

.stat-label {
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.stat-value {
  font-size: var(--krds-pc-font-size-heading-medium);
  line-height: 1.2;
  color: var(--rq-accent-strong);
}

.purpose-source {
  grid-column: 1;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
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

.plan {
  display: grid;
  gap: 0.6rem;
  padding: 1.6rem 2rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-small);
  color: var(--krds-light-color-text-basic);
}

.plan-title {
  font-size: var(--krds-pc-font-size-label-medium);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.plan-list,
.changes {
  display: grid;
  gap: 0.4rem;
  padding-left: 2rem;
  list-style: disc;
}

.changes {
  gap: 0.8rem;
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

.number.is-wide {
  grid-column: 1 / -1;
}

.number.is-wide strong {
  margin-left: 0.2rem;
}

/* 숫자와 단위가 줄에서 떨어지지 않게 */
.keep {
  white-space: nowrap;
}

.measured {
  display: inline-block;
  margin-left: 0.8rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
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
  .mock-note,
  .purpose {
    margin-top: -0.8rem;
  }

  /* 휴대폰: 숫자를 문장 아래로 */
  .purpose {
    grid-template-columns: minmax(0, 1fr);
    padding: 1.4rem 1.6rem;
  }

  .purpose-stat {
    grid-column: 1;
    grid-row: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-items: start;
    gap: 0.2rem 0.8rem;
    text-align: left;
  }

  .plan {
    padding: 1.4rem 1.6rem;
  }

  .measured {
    display: block;
    margin-left: 0;
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
