/**
 * AI가 쓴 질문 문장 검사. 하나라도 걸리면 그 질문은 검수 문장으로 바꾼다(shared/generate.ts).
 * 기획안 "근거 없는 전제 0건" 지표를 지키는 마지막 관문이라 규칙을 넓게 잡지 않고 확실한 것만 본다.
 */
import type { Evidence, Posting, PostingState } from './contract.js'
import { CARDS } from './catalog.js'

export type Issue =
  | 'empty'
  | 'too_short'
  | 'too_long'
  /** 근거 인용이 그 필드 원문에 글자 그대로 없음 */
  | 'evidence_not_in_posting'
  /** 질문 문장 속 '…' 인용이 공고 원문에 글자 그대로 없음(카드 이름 인용은 예외, H2-06) */
  | 'quote_not_in_posting'
  /** 공고에 없는 업무를 공고에 있는 것처럼 물음("공고에 … 있던데") */
  | 'absent_presupposition'
  /** 채용 질문에 넣지 않을 개인 사항·회사를 평가하는 말 */
  | 'forbidden_word'
  /** 최종 질문에 1차 면접관 말을 인용함 */
  | 'interviewer_quote'

/** 검수 틀(최대 75자) + 경험 한 줄(100자) + 앞말을 넉넉히 넣고도 한 번에 읽히는 길이 */
export const TEXT_MIN = 10
export const TEXT_MAX = 260

/** 면접에서 묻지 않는 개인 사항(채용절차법·고용상 차별 금지 항목)과 회사를 평가하는 말 */
export const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  // 앞 글자가 한글이면 '나이'로 보지 않음("업무 중 하나이고"·"하나이며" 오탐) — A3-r2-07
  /(?<![가-힣])나이|연령|몇\s*살/,
  // '배우자'는 명사로 쓸 때만("함께 배우자는" 오탐), '본적'은 '본적지'만("기본적으로"·"해 본적이" 오탐) — A3-r1-02
  /결혼|기혼|미혼|배우자(?:가|의|와|분|님)|이혼/,
  /출신|고향|본적지/,
  /종교|신앙/,
  /임신|출산\s*계획|자녀\s*계획/,
  /혈액형|외모|신체\s*조건|키와\s*몸무게/,
  /부모님?\s*(?:직업|재산)|가족\s*관계/,
  /정치\s*성향|지지\s*정당/,
  /나쁜\s*회사|블랙\s*기업|악덕/,
]

const PRESUPPOSE = /공고에[^.?!]*?(?:있던데|있는데)/
const INTERVIEWER_QUOTE = /아까|하셨는데|말씀하신/

/** 근거 인용이 공고 그 필드 값의 일부(글자 그대로)인지 */
export function quoteInPosting(posting: Posting, evidence: Evidence): boolean {
  const value: unknown = (posting as unknown as Record<string, unknown>)[evidence.field]
  return typeof value === 'string' && evidence.quote.trim() !== '' && value.includes(evidence.quote)
}

/** 질문 문장 속 따옴표 인용('…'·‘…’) */
export function quotesIn(text: string): string[] {
  return [...text.matchAll(/['‘]([^'‘’\n]+)['’]/g)].map((m) => (m[1] ?? '').trim()).filter(Boolean)
}

const CARD_LABELS: ReadonlySet<string> = new Set(CARDS.map((c) => c.label))

/**
 * 질문 문장에서 인용한 말이 공고 원문(어느 칸이든)에 글자 그대로 없는 것. 카드 이름("'고객사 상주 개발' 업무")은 공고 인용이 아니라 뺀다.
 * D-075는 인용 검사를 단위 시험에만 두었지만, 실제 LLM이 지어낸 인용을 막으려고 validate에 넣는다(H2-06 ①)
 * 문장은 공백을 한 칸으로 줄인 뒤 검사하므로(generate) 원문 칸 값도 연속 공백·줄바꿈을 한 칸으로 줄여 비교한다.
 * 칸 사이는 줄바꿈으로 나눠 두어 두 칸에 걸친 인용은 받지 않는다(A3-r2-10). 분석 근거 검사 quoteInPosting 은 글자 그대로(P-04)
 */
const squash = (s: string): string => s.replace(/\s+/g, ' ')

export function quotesNotInPosting(text: string, posting: Posting): string[] {
  const source = Object.values(posting)
    .filter((v): v is string => typeof v === 'string')
    .map(squash)
    .join('\n')
  return quotesIn(text).filter((q) => !CARD_LABELS.has(q) && !source.includes(squash(q)))
}

export function hasForbiddenWord(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

function commonIssues(text: string, evidence: Evidence | undefined, posting: Posting): Issue[] {
  const t = text.trim()
  if (!t) return ['empty']
  const issues: Issue[] = []
  if (t.length < TEXT_MIN) issues.push('too_short')
  if (t.length > TEXT_MAX) issues.push('too_long')
  if (evidence && !quoteInPosting(posting, evidence)) issues.push('evidence_not_in_posting')
  if (quotesNotInPosting(t, posting).length) issues.push('quote_not_in_posting')
  if (hasForbiddenWord(t)) issues.push('forbidden_word')
  return issues
}

export interface FirstQuestionCheck {
  text: string
  /** 그 카드가 공고에 어떻게 적혔는지(분석 JSON) */
  state: PostingState
  evidence?: Evidence
}

/** 1차·기술 면접 질문 검사. 빈 배열이면 통과 */
export function checkFirstQuestion(q: FirstQuestionCheck, posting: Posting): Issue[] {
  const issues = commonIssues(q.text, q.evidence, posting)
  if (q.state === 'absent' && PRESUPPOSE.test(q.text)) issues.push('absent_presupposition')
  return issues
}

export interface FinalQuestionCheck {
  text: string
  /** 처우 질문은 카드가 없어 상태도 없다 */
  state?: PostingState
  evidence?: Evidence
}

/** 이보다 짧은 들은 답("네")은 우연히 겹칠 수 있어 보지 않는다 */
export const HEARD_QUOTE_MIN = 6

/** 들은 답을 글자 그대로 옮겼는지(1차 면접관 말 인용과 같고, 들은 답이 결과에 남는다) */
export function quotesHeard(text: string, heard: readonly string[]): boolean {
  return heard.some((h) => {
    const t = h.trim()
    return t.length >= HEARD_QUOTE_MIN && text.includes(t)
  })
}

/** 최종 면접·처우 질문 검사. 1차 면접관 말을 인용하지 않는다(추가 개발 노트 7절) */
export function checkFinalQuestion(q: FinalQuestionCheck, posting: Posting, heard: readonly string[] = []): Issue[] {
  const issues = commonIssues(q.text, q.evidence, posting)
  if (q.state === 'absent' && PRESUPPOSE.test(q.text)) issues.push('absent_presupposition')
  if (INTERVIEWER_QUOTE.test(q.text) || quotesHeard(q.text, heard)) issues.push('interviewer_quote')
  return issues
}
