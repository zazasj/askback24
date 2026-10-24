/** 질문 카드에 보일 글·색(1차·최종 공용). 판단은 하지 않고 형식만 바꾼다 */
import { CARD_BOOK, FINAL_BOOK, getCard } from '@shared/catalog'
import type { Evidence, EvidenceField, FinalQType, FinalQuestion, OfferBlank, Pref, QType } from '@shared/contract'
import { BLANK_TAGS } from './checkpoints'

/**
 * 유형 칩 색: 충돌 주황 · 기회 초록 · 깊이 파랑 · 예방/탐색 회색(DESIGN-REVIEW D7).
 * 최종: 다시 확인 노랑 · 신호 확인 파랑 · 범위 확인 주황 · 처우 확인 보라(우리 강조색) · 기회 확인 초록
 */
export type ChipTone = 'conflict' | 'opportunity' | 'depth' | 'muted' | 'warning' | 'offer'

export const FIRST_TONES: Record<QType, ChipTone> = {
  conflict: 'conflict',
  opportunity: 'opportunity',
  depth: 'depth',
  prevent: 'muted',
  explore: 'muted',
}

/** 유형은 내 선호 하나에서만 나온다(gap_rules): 충돌 → 걱정돼요, 기회·깊이 → 기대돼요, 탐색 → 모르겠어요 */
export function prefOfType(type: QType): Pref | undefined {
  return CARD_BOOK.gap_rules.find((r) => r.type === type)?.preference
}

/** "고객사 상주 개발 · 걱정돼요" */
export function cardMeta(cardId: string, type: QType): string {
  const label = getCard(cardId)?.label ?? cardId
  const pref = prefOfType(type)
  return pref ? `${label} · ${CARD_BOOK.preference_options[pref]}` : label
}

/** 근거 필드 이름은 ① 공고 표의 칸 이름과 같다 */
export const FIELD_LABELS: Record<EvidenceField, string> = {
  jobCont: '직무내용',
  pfCond: '우대조건',
  etcPfCond: '우대조건',
  empTpNm: '고용형태',
  salTpNm: '임금',
  sal: '임금',
  workdayWorkhrCont: '근무시간',
  etcWelfare: '복리후생',
}

/** "우대조건 '고객사 상주 가능자'" */
export function evidenceLabel(e: Evidence | undefined): string | undefined {
  return e ? `${FIELD_LABELS[e.field] ?? '공고'} '${e.quote}'` : undefined
}

export const FINAL_TONES: Record<FinalQType, ChipTone> = {
  recheck: 'warning',
  signal: 'depth',
  scope: 'conflict',
  offer: 'offer',
  opportunity: 'opportunity',
}

/** 처우 질문 칩 옆 설명: "근로시간 · 공고에 없음". 상태 글자는 ① 확인할 점과 같은 BLANK_TAGS(DR-r1-12) */
export function offerMeta(blank: OfferBlank): string {
  return `${blank.label} · ${BLANK_TAGS[blank.status]}`
}

/** 최종 질문 칩 옆 설명: "고객사 상주 개발 · 걱정돼요 · 아직 모름". 처우 질문은 offerMeta */
export function finalMeta(q: FinalQuestion, pref: Pref | null, stateLabel: string | undefined, offerLabel: string | undefined): string {
  if (!q.card_id) return offerLabel ?? ''
  const parts = [getCard(q.card_id)?.label ?? q.card_id]
  if (pref) parts.push(CARD_BOOK.preference_options[pref])
  if (stateLabel) parts.push(stateLabel)
  return parts.join(' · ')
}

export function finalTypeLabel(type: FinalQType): string {
  return FINAL_BOOK.type_labels[type]
}

/** "왜 이 질문인가요" 첫 줄: "충돌 확인: 걱정한 일이 …". 유형 이름과 뜻을 한 글로 둬 칩 이름만 따로 보이지 않게 한다 */
export function firstTypeNote(type: QType): string {
  return `${CARD_BOOK.type_labels[type]}: ${CARD_BOOK.type_descriptions[type]}`
}

export function finalTypeNote(type: FinalQType): string {
  return `${FINAL_BOOK.type_labels[type]}: ${FINAL_BOOK.type_descriptions[type]}`
}
