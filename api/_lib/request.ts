/**
 * POST /api/questions 요청 검사. 오류 문구에 입력값을 넣지 않는다(경험 한 줄·들은 답이 섞일 수 있음).
 */
import type { CardPick, FinalQuestionsRequest, FirstQuestionsRequest, InterviewReview, Mood, NotAskedReason, Pref, QuestionsRequest } from '../../shared/contract'
import { EXPERIENCE_MAX, HEARD_MAX } from '../../shared/generate'

export const PICKS_MAX = 17
const PREFS: readonly Pref[] = ['want', 'avoid', 'unsure']

export type Parsed = { ok: true; value: QuestionsRequest } | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isShortString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** 최종 요청은 고른 카드가 없어도 받는다(회사가 물어본 업무·처우 질문만으로도 만든다) */
function parsePicks(v: unknown, allowEmpty = false): CardPick[] | null {
  if (!Array.isArray(v) || (v.length === 0 && !allowEmpty) || v.length > PICKS_MAX) return null
  const out: CardPick[] = []
  for (const p of v) {
    if (!isObject(p) || !isShortString(p.card_id, 16) || !PREFS.includes(p.pref as Pref)) return null
    if (p.has_exp !== undefined && typeof p.has_exp !== 'boolean') return null
    out.push({ card_id: p.card_id, pref: p.pref as Pref, has_exp: p.has_exp === true })
  }
  return out
}

const CLARITIES = ['clear', 'vague'] as const
const REASONS: readonly NotAskedReason[] = ['no_time', 'bad_mood', 'forgot', 'no_chance', 'explained']
const MOODS: readonly Mood[] = ['relaxed', 'normal', 'pressured']
const isList = (v: unknown): v is unknown[] => Array.isArray(v) && v.length <= PICKS_MAX

/** 1차 면접 정리. 알려진 키만 옮겨 담는다(소감 같은 다른 글이 섞여 들어와도 넘기지 않게) */
function parseReview(v: unknown): InterviewReview | null {
  if (!isObject(v) || !isList(v.asked) || !isList(v.not_asked) || !isList(v.received) || !isObject(v.impression)) return null
  if (!MOODS.includes(v.impression.mood as Mood)) return null
  const review: InterviewReview = { asked: [], not_asked: [], received: [], impression: { mood: v.impression.mood as Mood } }
  for (const a of v.asked) {
    if (!isObject(a) || !isShortString(a.question_id, 16) || !isShortString(a.card_id, 16)) return null
    if (typeof a.heard !== 'string' || a.heard.length > HEARD_MAX) return null
    if (a.clarity !== undefined && !CLARITIES.includes(a.clarity as 'clear')) return null
    const item: InterviewReview['asked'][number] = { question_id: a.question_id, card_id: a.card_id, heard: a.heard }
    if (a.clarity !== undefined) item.clarity = a.clarity as 'clear' | 'vague'
    review.asked.push(item)
  }
  for (const n of v.not_asked) {
    if (!isObject(n) || !isShortString(n.question_id, 16) || !isShortString(n.card_id, 16)) return null
    if (n.reason !== undefined && !REASONS.includes(n.reason as NotAskedReason)) return null
    const item: InterviewReview['not_asked'][number] = { question_id: n.question_id, card_id: n.card_id }
    if (n.reason !== undefined) item.reason = n.reason as NotAskedReason
    review.not_asked.push(item)
  }
  for (const r of v.received) {
    if (!isObject(r) || !isShortString(r.card_id, 16)) return null
    review.received.push({ card_id: r.card_id })
  }
  return review
}

export function parseQuestionsRequest(body: unknown): Parsed {
  if (!isObject(body)) return { ok: false, error: 'body_not_object' }
  if (body.mode !== 'first' && body.mode !== 'final') return { ok: false, error: 'mode' }
  if (!isShortString(body.wantedAuthNo, 40)) return { ok: false, error: 'wantedAuthNo' }
  const picks = parsePicks(body.picks, body.mode === 'final')
  if (!picks) return { ok: false, error: 'picks' }

  if (body.mode === 'first') {
    const req: FirstQuestionsRequest = { mode: 'first', wantedAuthNo: body.wantedAuthNo, picks }
    if (body.experience !== undefined) {
      if (typeof body.experience !== 'string' || body.experience.length > EXPERIENCE_MAX) return { ok: false, error: 'experience' }
      req.experience = body.experience
    }
    return { ok: true, value: req }
  }

  const review = parseReview(body.review)
  if (!review) return { ok: false, error: 'review' }
  const req: FinalQuestionsRequest = { mode: 'final', wantedAuthNo: body.wantedAuthNo, picks, review }
  return { ok: true, value: req }
}
