/**
 * 1차 면접 정리(최소판) 입력 모양과 요청 만들기. 판정·순서는 shared/finalRules 가 정하고,
 * 여기서는 "무엇을 적었는지"만 다룬다. 들은 답·분위기는 메모리에만 두고 저장하지 않는다(R-09).
 */
import { CARDS, FINAL_BOOK, REVIEW_EXAMPLE } from '@shared/catalog'
import type {
  CardPick,
  CardState,
  Clarity,
  FinalQuestionsRequest,
  InterviewReview,
  Mood,
  NotAskedReason,
  Question,
  ReviewState,
} from '@shared/contract'
import { HEARD_MAX } from '@shared/generate'

export { HEARD_MAX }

export type AskedChoice = 'asked' | 'not_asked'

export interface ReviewItemDraft {
  asked: AskedChoice | null
  heard: string
  clarity: Clarity | null
  reason: NotAskedReason | null
}

/** 지원 건 하나의 정리. items 키 = 1차 질문 카드 ID */
export interface ReviewDraft {
  items: Record<string, ReviewItemDraft>
  /** 회사가 물어본 업무(카드 ID) */
  received: string[]
  mood: Mood | null
}

export const emptyItem = (): ReviewItemDraft => ({ asked: null, heard: '', clarity: null, reason: null })
export const emptyReviewDraft = (): ReviewDraft => ({ items: {}, received: [], mood: null })

// ── 화면 문구(ACCEPTANCE 「정확한 문구」) ─────────────────────
export const ASKED_LABELS: Record<AskedChoice, string> = { asked: '물어봤어요', not_asked: '못 물어봤어요' }
export const CLARITY_LABELS: Record<Clarity, string> = { clear: '구체적이었어요', vague: '모호했어요' }
export const REASON_LABELS: Record<NotAskedReason, string> = {
  no_time: '시간이 없었어요',
  bad_mood: '분위기가 아니었어요',
  forgot: '잊어버렸어요',
  no_chance: '질문할 기회가 없었어요',
  explained: '회사가 먼저 설명해 줬어요',
}
export const MOOD_LABELS: Record<Mood, string> = { relaxed: '편했어요', normal: '보통이었어요', pressured: '압박이 있었어요' }
export const REASONS = Object.keys(REASON_LABELS) as NotAskedReason[]
export const MOODS = Object.keys(MOOD_LABELS) as Mood[]

export const STATE_LABELS: Record<ReviewState, string> = FINAL_BOOK.state_labels

const ASKED_RULE_BASES: ReadonlySet<string> = new Set([
  FINAL_BOOK.basis.asked_clear,
  FINAL_BOOK.basis.asked_vague,
  FINAL_BOOK.basis.asked_unmarked,
])

/**
 * 물어본 카드 중 단순 규칙으로 판정한 수. 응답에는 물어봤는지가 없어서 단순 규칙의 "물어봄" 근거 문장으로 가린다
 * (못 물은 카드·회사가 물은 업무는 늘 규칙 판정이라 세지 않는다). 새로고침 뒤에도 저장된 결과만으로 셀 수 있다.
 */
export function ruleJudgedAskedCount(states: readonly CardState[]): number {
  return states.filter((s) => s.source === 'rule' && ASKED_RULE_BASES.has(s.basis)).length
}

export function itemOf(draft: ReviewDraft, cardId: string): ReviewItemDraft {
  return draft.items[cardId] ?? emptyItem()
}

/** 질문 하나를 다 정리했는지(물어봤으면 답 모양까지, 못 물었으면 이유까지) */
export function isItemDone(item: ReviewItemDraft): boolean {
  if (item.asked === 'asked') return item.clarity !== null
  if (item.asked === 'not_asked') return item.reason !== null
  return false
}

/** 하나라도 정리했는지("최종 질문 만들기" 활성) */
export function isTouched(draft: ReviewDraft): boolean {
  return Object.values(draft.items).some((i) => i.asked !== null) || draft.received.length > 0 || draft.mood !== null
}

const CARD_ORDER = new Map(CARDS.map((c, i) => [c.id, i]))

/**
 * 요청용 정리. 질문 순번(q1~)은 1차 결과 순서, 정리하지 않은 질문은 못 물은 것(이유 없음 → 아직 모름),
 * 분위기를 고르지 않으면 보통.
 */
export function toReview(draft: ReviewDraft, questions: readonly Question[]): InterviewReview {
  const review: InterviewReview = { asked: [], not_asked: [], received: [], impression: { mood: draft.mood ?? 'normal' } }
  questions.forEach((q, i) => {
    const item = itemOf(draft, q.card_id)
    const question_id = `q${i + 1}`
    if (item.asked === 'asked') {
      const asked: InterviewReview['asked'][number] = { question_id, card_id: q.card_id, heard: item.heard.trim().slice(0, HEARD_MAX) }
      if (item.clarity) asked.clarity = item.clarity
      review.asked.push(asked)
    } else {
      const notAsked: InterviewReview['not_asked'][number] = { question_id, card_id: q.card_id }
      if (item.asked === 'not_asked' && item.reason) notAsked.reason = item.reason
      review.not_asked.push(notAsked)
    }
  })
  review.received = [...new Set(draft.received)]
    .filter((id) => CARD_ORDER.has(id))
    .sort((a, b) => (CARD_ORDER.get(a) ?? 0) - (CARD_ORDER.get(b) ?? 0))
    .map((card_id) => ({ card_id }))
  return review
}

export function toFinalRequest(
  wantedAuthNo: string,
  picks: readonly CardPick[],
  draft: ReviewDraft,
  questions: readonly Question[],
): FinalQuestionsRequest {
  // 최종 요청에는 경험 한 줄을 싣지 않는다
  return { mode: 'final', wantedAuthNo, picks: picks.map((p) => ({ ...p, has_exp: false })), review: toReview(draft, questions) }
}

/**
 * 시연 도구 "1차 면접 다녀온 것으로 채우기"(R-04). 예시 세트에 있는 카드는 그 값, 없는 카드 질문은
 * 「질문할 기회가 없었어요」로 채운다.
 */
export function exampleDraft(questions: readonly Question[]): ReviewDraft {
  const items: Record<string, ReviewItemDraft> = {}
  for (const q of questions) {
    const asked = REVIEW_EXAMPLE.asked.find((a) => a.card_id === q.card_id)
    const notAsked = REVIEW_EXAMPLE.not_asked.find((n) => n.card_id === q.card_id)
    items[q.card_id] = asked
      ? { asked: 'asked', heard: asked.heard, clarity: asked.clarity, reason: null }
      : { asked: 'not_asked', heard: '', clarity: null, reason: notAsked?.reason ?? REVIEW_EXAMPLE.other_reason }
  }
  return { items, received: [...REVIEW_EXAMPLE.received], mood: REVIEW_EXAMPLE.mood }
}
