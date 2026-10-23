/**
 * ② 카드 선택 모양과 요청용 CardPick 으로 바꾸기.
 * 질문 순서는 shared/rules.ts 가 정하고, 여기서는 "무엇을 골랐는지"와 "경험을 어느 카드에 붙일지"만 다룬다.
 */
import type { CardPick, FirstQuestionsRequest, Pref } from '@shared/contract'
import type { Preset } from '@shared/catalog'

export const EXPERIENCE_MAX = 100
export const PREFS: readonly Pref[] = ['want', 'avoid', 'unsure']

export interface Choice {
  card_id: string
  pref: Pref
}

/** 지원 건 하나의 ② 선택. picks 순서 = 고른 순서(규칙에서 우선순위가 같으면 먼저 고른 것이 위) */
export interface PrepSelection {
  picks: Choice[]
  experience: string
  /** 경험 한 줄을 붙일 카드(이력서 칩·예시 구직자가 정함) */
  exp_card: string | null
}

export const emptySelection = (): PrepSelection => ({ picks: [], experience: '', exp_card: null })

/** 카드 하나의 선택을 바꾼다. 이미 고른 카드는 자리를 지키고, null 이면 뺀다 */
export function choose(picks: readonly Choice[], cardId: string, pref: Pref | null): Choice[] {
  const at = picks.findIndex((p) => p.card_id === cardId)
  if (pref === null) return at < 0 ? [...picks] : picks.filter((_, i) => i !== at)
  if (at < 0) return [...picks, { card_id: cardId, pref }]
  return picks.map((p, i) => (i === at ? { card_id: cardId, pref } : p))
}

/** 같은 것을 다시 누르면 선택을 푼다 */
export function toggle(picks: readonly Choice[], cardId: string, pref: Pref): Choice[] {
  const cur = picks.find((p) => p.card_id === cardId)?.pref
  return choose(picks, cardId, cur === pref ? null : pref)
}

export function prefOf(picks: readonly Choice[], cardId: string): Pref | null {
  return picks.find((p) => p.card_id === cardId)?.pref ?? null
}

export function countByPref(picks: readonly Choice[]): Record<Pref, number> {
  const n: Record<Pref, number> = { want: 0, avoid: 0, unsure: 0 }
  for (const p of picks) n[p.pref]++
  return n
}

/**
 * 경험 한 줄을 붙일 카드. 칩·예시가 정한 카드가 "기대돼요"면 그 카드, 아니면 처음 고른 "기대돼요" 카드.
 * 경험은 "기대돼요" 질문 앞에만 붙는다(규칙 anchor).
 */
export function experienceTarget(sel: PrepSelection): string | null {
  if (!sel.experience.trim()) return null
  const wants = sel.picks.filter((p) => p.pref === 'want')
  if (sel.exp_card && wants.some((p) => p.card_id === sel.exp_card)) return sel.exp_card
  return wants[0]?.card_id ?? null
}

export function toCardPicks(sel: PrepSelection): CardPick[] {
  const target = experienceTarget(sel)
  return sel.picks.map((p) => ({ card_id: p.card_id, pref: p.pref, has_exp: p.card_id === target }))
}

/** 1차 질문 요청. 경험 한 줄은 붙일 카드가 있을 때만 보낸다 */
export function toFirstRequest(wantedAuthNo: string, sel: PrepSelection): FirstQuestionsRequest {
  const req: FirstQuestionsRequest = { mode: 'first', wantedAuthNo, picks: toCardPicks(sel) }
  const experience = sel.experience.trim()
  if (experience && experienceTarget(sel)) req.experience = experience.slice(0, EXPERIENCE_MAX)
  return req
}

/** 결과가 지금 선택으로 만든 것인지 비교할 짧은 표식(저장소에 선택을 두 번 담지 않게 해시로) */
export function requestKey(req: FirstQuestionsRequest): string {
  const src = `${req.wantedAuthNo}|${req.picks.map((p) => `${p.card_id}:${p.pref}:${p.has_exp ? 1 : 0}`).join(',')}|${req.experience ?? ''}`
  let h = 5381
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function fromPreset(preset: Preset): PrepSelection {
  return {
    picks: preset.picks.map((p) => ({ card_id: p.card_id, pref: p.pref })),
    experience: preset.experience.slice(0, EXPERIENCE_MAX),
    exp_card: preset.picks.find((p) => p.has_exp)?.card_id ?? null,
  }
}

const isPref = (v: unknown): v is Pref => v === 'want' || v === 'avoid' || v === 'unsure'

export function isSelection(v: unknown): v is PrepSelection {
  if (typeof v !== 'object' || v === null) return false
  const s = v as PrepSelection
  return (
    Array.isArray(s.picks) &&
    s.picks.every((p) => typeof p === 'object' && p !== null && typeof p.card_id === 'string' && isPref(p.pref)) &&
    typeof s.experience === 'string' &&
    (s.exp_card === null || typeof s.exp_card === 'string')
  )
}
