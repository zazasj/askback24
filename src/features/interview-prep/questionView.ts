/** 질문 카드에 보일 글·색(1차·최종 공용). 판단은 하지 않고 형식만 바꾼다 */
import { CARD_BOOK, getCard } from '@shared/catalog'
import type { Evidence, EvidenceField, Pref, QType } from '@shared/contract'

/** 유형 칩 색: 충돌 주황 · 기회 초록 · 깊이 파랑 · 예방/탐색 회색(DESIGN-REVIEW D7) */
export type ChipTone = 'conflict' | 'opportunity' | 'depth' | 'muted'

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
