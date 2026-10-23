/**
 * /about-ai 신뢰 페이지에 보일 점검 숫자와 데이터 출처. 정적 데이터에서 그때그때 세어
 * 데이터가 바뀌어도 페이지 글이 따로 낡지 않게 한다.
 */
import { ANALYSES, CARDS, POSTINGS, getPosting, getSignals } from '@shared/catalog'
import type { CompanySignal } from '@shared/contract'
import { quoteInPosting } from '@shared/validate'

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
}

const REAL_SIGNAL_NOTE = '실제 서비스에서는 이 공공데이터 값을 써요. 시연 회사는 가상이라 값은 예시예요.'
const MOCK_SIGNAL_NOTE = '시연용으로 만든 값이에요.'

/** 데이터 출처 표: 업무 카드 · 공고 · 회사 신호(출처별 한 줄, "실제" 먼저) · 김00 이력서 */
export function sourceRows(): SourceRow[] {
  const signals = new Map<string, CompanySignal['source']>()
  for (const p of POSTINGS) for (const s of getSignals(p.wantedAuthNo)) if (!signals.has(s.source_name)) signals.set(s.source_name, s.source)
  const signalRows = [...signals]
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === '실제' ? -1 : 1))
    .map(([origin, source]) => ({
      data: '회사 신호',
      origin,
      source,
      note: source === '실제' ? REAL_SIGNAL_NOTE : MOCK_SIGNAL_NOTE,
    }))
  return [
    {
      data: `업무 카드 ${CARDS.length}개`,
      origin: 'NCS 국가직무능력표준 능력단위, 한국직업사전(웹프로그래머)',
      source: '실제',
      note: '공공 자료를 바탕으로 팀이 백엔드 업무를 나눠 정리했어요.',
    },
    {
      data: '채용 공고',
      origin: '고용24 채용정보 항목 이름(직무내용·우대조건·임금·근무시간 등)',
      source: '모의',
      note: '항목 이름만 따랐어요. 회사명과 공고는 예시예요.',
    },
    ...signalRows,
    { data: '김00 이력서', origin: '가상 인물', source: '모의', note: '연락처와 주소는 예시 값이에요.' },
  ]
}
