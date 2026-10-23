/**
 * POST /api/questions 요청 검사. 오류 문구에 입력값을 넣지 않는다(경험 한 줄·들은 답이 섞일 수 있음).
 */
import type { CardPick, FinalQuestionsRequest, FirstQuestionsRequest, InterviewReview, Pref, QuestionsRequest } from '../../shared/contract'
import { EXPERIENCE_MAX } from '../../shared/generate'

export const PICKS_MAX = 17
const PREFS: readonly Pref[] = ['want', 'avoid', 'unsure']

export type Parsed = { ok: true; value: QuestionsRequest } | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isShortString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

function parsePicks(v: unknown): CardPick[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > PICKS_MAX) return null
  const out: CardPick[] = []
  for (const p of v) {
    if (!isObject(p) || !isShortString(p.card_id, 16) || !PREFS.includes(p.pref as Pref)) return null
    if (p.has_exp !== undefined && typeof p.has_exp !== 'boolean') return null
    out.push({ card_id: p.card_id, pref: p.pref as Pref, has_exp: p.has_exp === true })
  }
  return out
}

/** 최종 요청은 M5에서 판정까지 붙인다. 지금은 모양만 본다 */
function isReview(v: unknown): v is InterviewReview {
  return (
    isObject(v) &&
    Array.isArray(v.asked) &&
    Array.isArray(v.not_asked) &&
    Array.isArray(v.received) &&
    isObject(v.impression)
  )
}

export function parseQuestionsRequest(body: unknown): Parsed {
  if (!isObject(body)) return { ok: false, error: 'body_not_object' }
  if (body.mode !== 'first' && body.mode !== 'final') return { ok: false, error: 'mode' }
  if (!isShortString(body.wantedAuthNo, 40)) return { ok: false, error: 'wantedAuthNo' }
  const picks = parsePicks(body.picks)
  if (!picks) return { ok: false, error: 'picks' }

  if (body.mode === 'first') {
    const req: FirstQuestionsRequest = { mode: 'first', wantedAuthNo: body.wantedAuthNo, picks }
    if (body.experience !== undefined) {
      if (typeof body.experience !== 'string' || body.experience.length > EXPERIENCE_MAX) return { ok: false, error: 'experience' }
      req.experience = body.experience
    }
    return { ok: true, value: req }
  }

  if (!isReview(body.review)) return { ok: false, error: 'review' }
  const req: FinalQuestionsRequest = { mode: 'final', wantedAuthNo: body.wantedAuthNo, picks, review: body.review }
  return { ok: true, value: req }
}
