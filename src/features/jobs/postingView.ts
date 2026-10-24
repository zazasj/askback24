/**
 * S3 채용정보 목록·상세가 공고 JSON(채용정보 API 상세 필드명)을 어떻게 보여 줄지.
 * 빈 문자열 = 그 칸이 비어 있음. S3는 고용24 기존 영역이라 빈 칸은 고용24처럼 "-"(A2-03).
 * 칸이 비어도 직무내용 글에 적혀 있을 수 있어 "공고에 적혀 있지 않아요" 같은 말은 쓰지 않는다.
 */
import type { Posting } from '@shared/contract'

export const EMPTY_TEXT = '-'

type PostingKey = keyof Posting & string

export interface DetailRow {
  label: string
  /** 여러 필드를 이어 붙이는 칸(임금 = 임금 형태 + 금액) */
  fields: PostingKey[]
  /** 붙일 단위(근로자 수 → "명") */
  suffix?: string
  /** 긴 글 칸: 원문 줄·소제목·목록 기호 그대로 글 블록(PostingText, S4 ①과 같은 부품) */
  block?: boolean
}

export interface DetailSection {
  id: string
  title: '모집요강' | '근무조건' | '기업정보'
  rows: DetailRow[]
}

/** 고용24 공고 상세의 세 묶음 */
export const DETAIL_SECTIONS: readonly DetailSection[] = [
  {
    id: 'recruit',
    title: '모집요강',
    rows: [
      { label: '모집직종', fields: ['jobsNm'] },
      { label: '직무내용', fields: ['jobCont'], block: true },
      { label: '모집인원', fields: ['collectPsncnt'], suffix: '명' },
      { label: '경력', fields: ['enterTpNm'] },
      { label: '학력', fields: ['eduNm'] },
      { label: '우대조건', fields: ['pfCond', 'etcPfCond'] },
      { label: '전형방법', fields: ['selMthd'] },
      { label: '접수마감', fields: ['receiptCloseDt'] },
    ],
  },
  {
    id: 'work',
    title: '근무조건',
    rows: [
      { label: '고용형태', fields: ['empTpNm'] },
      { label: '임금', fields: ['salTpNm', 'sal'] },
      { label: '근무시간', fields: ['workdayWorkhrCont'] },
      { label: '근무지역', fields: ['workRegion'] },
      { label: '사회보험', fields: ['fourIns'] },
      { label: '퇴직급여', fields: ['retirepay'] },
      { label: '복리후생', fields: ['etcWelfare'] },
    ],
  },
  {
    id: 'corp',
    title: '기업정보',
    rows: [
      { label: '기업명', fields: ['corpNm'] },
      { label: '업종', fields: ['indTpNm'] },
      { label: '기업규모', fields: ['busiSize'] },
      { label: '근로자 수', fields: ['totPsncnt'], suffix: '명' },
      { label: '주요사업', fields: ['busiCont'] },
    ],
  },
]

/** 한 칸의 글. 필드가 모두 비어 있으면 빈 문자열 */
export function rowText(posting: Posting, row: DetailRow): string {
  const parts = row.fields.map((f) => String(posting[f] ?? '').trim()).filter((t) => t !== '')
  if (!parts.length) return ''
  // 임금 형태(연봉)와 금액은 띄어 쓰고, 우대조건 두 칸은 쉼표로 잇는다
  const joined = row.fields.includes('salTpNm') ? parts.join(' ') : parts.join(', ')
  return row.suffix ? `${joined}${row.suffix}` : joined
}

/** 목록의 임금 칸: "연봉 3,200만 원 ~ 3,800만 원", 금액이 없으면 빈 문자열 */
export function salaryText(posting: Posting): string {
  return posting.sal.trim() ? [posting.salTpNm, posting.sal].map((t) => t.trim()).filter(Boolean).join(' ') : ''
}

/**
 * 임금 글을 줄이 바뀌어도 되는 조각으로 나눈다. 금액과 단위("3,200만 원"), "~"와 뒤 금액, 괄호 묶음("(협의 가능)")은
 * 한 조각이라 그 안에서는 줄이 바뀌지 않는다(DA-06: "3,400만 / 원", "(협의 / 가능)"처럼 끝말만 떨어짐).
 */
export function salaryChunks(text: string): string[] {
  const out: string[] = []
  let glueNext = false
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const prev = out[out.length - 1]
    const openParen = prev !== undefined && (prev.match(/\(/g)?.length ?? 0) > (prev.match(/\)/g)?.length ?? 0)
    if (prev !== undefined && (glueNext || openParen || /^(?:만원?|원)[),.]*$/.test(token))) out[out.length - 1] = `${prev} ${token}`
    else out.push(token)
    glueNext = token === '~'
  }
  return out
}

/** 목록 순서: 최근 등록(공고 번호가 큰 것) 먼저 */
export function listOrder(postings: readonly Posting[]): Posting[] {
  return [...postings].sort((a, b) => b.wantedAuthNo.localeCompare(a.wantedAuthNo))
}

/** 검색어: 회사명·채용제목·직무내용·근무지역에서 찾는다(띄어쓰기·대소문자 무시) */
export function matchesQuery(posting: Posting, query: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const q = norm(query)
  if (!q) return true
  return norm(`${posting.corpNm} ${posting.wantedTitle} ${posting.jobCont} ${posting.workRegion}`).includes(q)
}
