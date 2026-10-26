/**
 * S4 ① 공고 원문 표의 줄(고용24 상세 표 모양). ① 형광펜과 ① 로딩의 근거 인용이 같은 문서 순서를 쓴다.
 */
import type { BlankTopic, Posting } from '@shared/contract'

export type PostingKey = keyof Posting & string

export interface RowDef {
  key: string
  label: string
  fields: PostingKey[]
  /** 비어 있으면 줄을 숨긴다(비어 있음이 확인할 점이 아닌 칸) */
  hideEmpty?: boolean
  /** 긴 글 칸: 원문 줄·소제목·목록 기호 그대로 글 블록으로(S3 상세와 같은 부품) */
  block?: boolean
  /** 이 칸에 해당하는 근로조건(분석 JSON blanks). 칸이 비어도 직무내용에 적혀 있으면 빈 칸 글에 밝힌다 */
  topic?: BlankTopic
}

export const POSTING_ROWS: readonly RowDef[] = [
  { key: 'job', label: '직무내용', fields: ['jobCont'], block: true },
  { key: 'pf', label: '우대조건', fields: ['pfCond', 'etcPfCond'] },
  { key: 'emp', label: '고용형태', fields: ['empTpNm'] },
  { key: 'career', label: '경력', fields: ['enterTpNm'] },
  { key: 'edu', label: '학력', fields: ['eduNm'], hideEmpty: true },
  { key: 'sal', label: '임금', fields: ['salTpNm', 'sal'], topic: 'sal' },
  { key: 'hours', label: '근무시간', fields: ['workdayWorkhrCont'], topic: 'workHours' },
  { key: 'region', label: '근무지역', fields: ['workRegion'], hideEmpty: true },
  { key: 'welfare', label: '복리후생', fields: ['etcWelfare'], hideEmpty: true },
  { key: 'sel', label: '전형방법', fields: ['selMthd'], hideEmpty: true },
]

/** ① 표에 그리는 필드 순서(문서 순서) */
export const POSTING_FIELD_ORDER: readonly PostingKey[] = POSTING_ROWS.flatMap((r) => r.fields)
