/**
 * 질문 문장을 쓰는 공급자(LLM) 형식. 순서·유형·근거는 규칙(shared/rules)이 정하고 공급자는 문장만 쓴다.
 * 공급자가 틀리거나 늦어도 shared/generate.ts 가 검수 문장으로 대신한다.
 */
import type { Evidence, Posting, PostingState, Pref, QType } from '../contract'

export interface DraftItem {
  rank: number
  card_id: string
  card_label: string
  pref: Pref
  state: PostingState
  type: QType
  evidence?: Evidence
  /** 검수 틀. {anchor} 자리에 경험 한 줄이 붙는다 */
  template: string
  /** 검수 문장(틀 + 경험). 공급자가 뜻을 바꾸지 않게 기준으로 준다 */
  template_text: string
  /** 이 질문에만 경험 한 줄을 붙인다 */
  has_exp: boolean
}

export interface FirstDraftInput {
  mode: 'first'
  posting: Posting
  /** 경험을 붙일 질문이 있을 때만 채운다. 공급자는 저장·기록하지 않는다 */
  experience: string
  items: DraftItem[]
}

/** 공급자가 돌려주는 문장 하나. evidence 를 주면 그 인용도 검사한다 */
export interface Draft {
  card_id: string
  text: string
  evidence?: Evidence
}

export interface LlmProvider {
  /** 로그용 이름(mock · ennoia) */
  readonly name: string
  writeFirst(input: FirstDraftInput, signal: AbortSignal): Promise<Draft[]>
}
