/**
 * /about-ai 신뢰 페이지에 보일 점검 숫자와 데이터 출처. 정적 데이터에서 그때그때 세어
 * 데이터가 바뀌어도 페이지 글이 따로 낡지 않게 한다.
 */
import { ANALYSES, CARDS, POSTINGS, getPosting, getSignals } from '@shared/catalog'
import type { CompanySignal } from '@shared/contract'
import { quoteInPosting } from '@shared/validate'
import { NCS_CARDS, SMALL_GIANTS, TEAM_NCS_LABEL, apiOf, fetchedOn, type RealSourceId } from '@/realData'

export interface AuditNumbers {
  cards: number
  postings: number
  /** 분석 JSON 의 업무 카드 근거 인용 수 */
  quotes: number
  /** 그중 공고 원문에 글자 그대로 있는 것(형광펜이 칠해지는 것) */
  quotesFound: number
  /** 검사에 떨어지면 대신 쓰는 검수 문장 틀 수 */
  templates: number
}

export function auditNumbers(): AuditNumbers {
  let quotes = 0
  let quotesFound = 0
  for (const a of ANALYSES) {
    const posting = getPosting(a.wantedAuthNo)
    for (const c of a.cards) {
      if (!c.evidence) continue
      quotes++
      if (posting && quoteInPosting(posting, c.evidence)) quotesFound++
    }
  }
  const templates = CARDS.reduce((n, c) => n + Object.values(c.questions).filter(Boolean).length, 0)
  return { cards: CARDS.length, postings: POSTINGS.length, quotes, quotesFound, templates }
}

export interface SourceRow {
  data: string
  origin: string
  source: CompanySignal['source']
  note: string
  /** 받은 날짜 "2026-10-25"(고용24 오픈API에서 받은 것만), 없으면 "" */
  fetched: string
}

const REAL_SIGNAL_NOTE = '실제 서비스에서는 이 공공데이터 값을 써요. 시연 회사는 가상이라 값은 예시예요.'
const MOCK_SIGNAL_NOTE = '시연용으로 만든 값이에요.'
// 강소기업은 실제 명단을 받았지만 시연 회사가 가상이라 회사별 여부는 지어낼 수밖에 없어 "모의"다(DATA-04)
const SIGNAL_NOTES: Record<string, string> = {
  '고용24 강소기업 정보': '시연 회사는 가상이라 명단에 올라 있는지도 예시예요. 실제 명단으로 센 숫자는 "강소기업 통계" 줄에 있어요.',
  // 근로기준법 제43조의2 명단은 일부 사업주만 공개해 "명단에 없음"이 "체불 없음"으로 읽히면 안 된다(A2-04)
  '임금체불 사업주 명단': `${MOCK_SIGNAL_NOTE} 명단은 체불로 유죄가 두 번 이상 확정된 일부 사업주만 공개해요. 명단에 없다고 체불이 없다는 뜻은 아니에요.`,
}

const num = (n: number): string => n.toLocaleString('ko-KR')
const openApi = (id: RealSourceId, name: string): string => `고용24 오픈API ${name}(${apiOf(id)})`

/**
 * 강소기업 통계 한 줄. 정보통신업·인증 종류는 똑같은 줄을 뺀 건수로 셌으므로 전국 수도 같은 기준(counted)으로 쓰고
 * 응답 total 과의 차이를 괄호에 밝힌다(A1-05). 숫자는 모두 파일 값.
 */
export function giantsNote(): string {
  const g = SMALL_GIANTS
  const years = [...new Set(g.by_year.map((y) => y.year))].join('·')
  return (
    `전국 ${num(g.counted)}건(응답 ${num(g.total)}건 중 겹친 ${num(g.total - g.counted)}건 뺌, 회사 ${num(g.counted_companies)}곳, ${years}년 선정) ` +
    `중 ${g.ict.label} ${num(g.ict.count)}건, 강소기업 구분(인증·선정 등) ${g.by_brand.length}가지. 시연 회사는 가상이라 회사별로는 쓰지 않아요.`
  )
}

/** 고용24 오픈API에서 받은 4종: 직무정보 · 직업정보 · 공통코드 · 강소기업 */
function realApiRows(): SourceRow[] {
  const ncsCards = NCS_CARDS.cards.length
  const matched = NCS_CARDS.cards.filter((c) => c.matched).length
  const rows: SourceRow[] = [
    {
      data: '업무 카드 NCS 표시',
      origin: openApi('duty', '직무정보'),
      source: '실제',
      // 파일 경로는 화면에서 열 수 없어 README에만 둔다. API가 카드를 이어 준 것이 아니라 팀이 고른 이름으로 찾은 것이다(A2-12)
      // 응답 값과 팀 값을 한 줄 "실제"로 묶지 않고 나눈다(H1-09 ①). 팀 값 줄은 teamNcsRow
      note: `NCS 카드 ${ncsCards}개마다 팀이 고른 능력단위명으로 직무정보 API를 찾아, 같은 이름이 나온 ${matched}개는 응답 값을 그대로 보여요. 능력단위 정의는 ② 카드의 "도움말"에 있어요.`,
      fetched: fetchedOn('duty'),
    },
    {
      data: '응용 소프트웨어 개발자 직무 개요',
      origin: openApi('job', '직업정보'),
      source: '실제',
      note: '"내 기대·걱정" 단계 맨 위 한 줄이에요.',
      fetched: fetchedOn('job'),
    },
    {
      data: '지역·직종 코드',
      origin: openApi('codes', '공통코드'),
      source: '실제',
      note: `모의 공고 ${POSTINGS.length}건의 지역·직종 코드를 실제 코드로 맞췄어요.`,
      fetched: fetchedOn('codes'),
    },
    {
      data: '강소기업 통계',
      origin: openApi('giants', '강소기업'),
      source: '실제',
      note: giantsNote(),
      fetched: fetchedOn('giants'),
    },
  ]
  return rows.filter((r) => r.fetched)
}

/** 직무정보 응답에서 같은 이름이 나오지 않았거나 뜻이 달라(H2-11 ①) 팀이 고른 NCS 값 — "모의"(H1-09 ①) */
function teamNcsRow(): SourceRow {
  const team = NCS_CARDS.cards.filter((c) => !c.matched).length
  return {
    data: '업무 카드 NCS 참고 표시',
    origin: 'NCS 국가직무능력표준 능력단위(팀이 고른 이름)',
    source: '모의',
    note: `나머지 ${team}개는 응답에서 같은 이름이 나오지 않았거나 뜻이 달라 팀이 고른 값이라 카드에 "${TEAM_NCS_LABEL}"로 보여요.`,
    fetched: '',
  }
}

/** 데이터 출처 표: 업무 카드 · 고용24 오픈API 4종 · NCS 팀 값 · 공고 · 회사 참고 정보(출처별 한 줄, "실제" 먼저) · 김00 이력서 */
export function sourceRows(): SourceRow[] {
  const signals = new Map<string, CompanySignal['source']>()
  for (const p of POSTINGS) for (const s of getSignals(p.wantedAuthNo)) if (!signals.has(s.source_name)) signals.set(s.source_name, s.source)
  const signalRows = [...signals]
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === '실제' ? -1 : 1))
    .map(([origin, source]) => ({
      data: '회사 참고 정보',
      origin,
      source,
      note: SIGNAL_NOTES[origin] ?? (source === '실제' ? REAL_SIGNAL_NOTE : MOCK_SIGNAL_NOTE),
      fetched: '',
    }))
  return [
    {
      data: `업무 카드 ${CARDS.length}개`,
      origin: 'NCS 국가직무능력표준 능력단위, 한국직업사전(웹프로그래머)',
      // 업무를 나눈 것은 팀이라 "모의"(H1-09 ②)
      source: '모의',
      note: '공공 자료를 참고해 팀이 나눈 업무예요.',
      fetched: '',
    },
    ...realApiRows(),
    teamNcsRow(),
    {
      data: '채용 공고',
      origin: '고용24 채용정보 항목 이름(직무내용·우대조건·임금·근무시간 등)',
      source: '모의',
      note: '채용정보 오픈API는 개인회원은 쓸 수 없어서 항목 이름만 따랐어요. 회사명과 공고는 예시예요.',
      fetched: '',
    },
    ...signalRows,
    { data: '김00 이력서', origin: '가상 인물', source: '모의', note: '연락처와 주소는 예시 값이에요.', fetched: '' },
  ]
}

/**
 * 팀이 고용24 공개 채용 화면에서 직접 센 숫자(H1-23). API·파일에서 셀 수 없어 측정 날짜와 함께 값으로 둔다.
 * 모의 공고(P-02)가 임금·근무시간을 비워 둔 근거다.
 */
export const TEAM_MEASURE = {
  query: '개발자',
  postings: 50,
  wageBlank: 40,
  hoursBlank: 37,
  measuredOn: '2026-10-05',
} as const

/** 임금 빈칸·협의 비율(%) — 정수로 */
export function wageBlankRate(): number {
  return Math.round((TEAM_MEASURE.wageBlank / TEAM_MEASURE.postings) * 100)
}
