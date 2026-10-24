import { describe, expect, it } from 'vitest'
import { PRESETS, REVIEW_EXAMPLE } from '@shared/catalog'
import { buildTemplateFirst, generateFinal } from '@shared/generate'
import { createMockProvider } from '@shared/providers/mock'
import { emptyReviewDraft, exampleDraft, isItemDone, isTouched, ruleJudgedAskedCount, toFinalRequest, toReview } from './review'

const first = buildTemplateFirst({ mode: 'first', wantedAuthNo: 'K-MOCK-0001', picks: PRESETS.A.picks, experience: PRESETS.A.experience })
const questions = first.questions

describe('1차 면접 정리 → 요청', () => {
  it('아무것도 정리하지 않으면 isTouched=false("최종 질문 만들기" 비활성)', () => {
    expect(isTouched(emptyReviewDraft())).toBe(false)
    expect(isTouched({ ...emptyReviewDraft(), mood: 'normal' })).toBe(true)
    expect(isTouched({ ...emptyReviewDraft(), received: ['BE08'] })).toBe(true)
  })

  it('R-04 예시 채우기: 들은 답 4 · 못 물음 1(시간이 없었어요) · 회사가 물어본 업무 BE08 · 압박', () => {
    const draft = exampleDraft(questions)
    const review = toReview(draft, questions)
    expect(review.asked.map((a) => a.card_id)).toEqual(['BE15', 'BE07', 'BE02', 'BE01'])
    expect(review.asked.map((a) => a.heard).sort()).toEqual(REVIEW_EXAMPLE.asked.map((a) => a.heard).sort())
    expect(review.not_asked).toEqual([{ question_id: 'q4', card_id: 'BE03', reason: 'no_time' }])
    expect(review.received).toEqual([{ card_id: 'BE08' }])
    expect(review.impression).toEqual({ mood: 'pressured' })
    expect(questions.every((q) => isItemDone(draft.items[q.card_id]!))).toBe(true)
  })

  it('정리하지 않은 질문은 못 물은 것(이유 없음), 분위기를 안 고르면 보통, 들은 답은 100자까지', () => {
    const draft = emptyReviewDraft()
    draft.items.BE15 = { asked: 'asked', heard: `  ${'가'.repeat(120)}  `, clarity: null, reason: null }
    draft.items.BE07 = { asked: 'not_asked', heard: '지운 답', clarity: null, reason: null }
    const review = toReview(draft, questions)
    expect(review.asked).toEqual([{ question_id: 'q1', card_id: 'BE15', heard: '가'.repeat(100) }])
    expect(review.not_asked.map((n) => n.card_id)).toEqual(['BE07', 'BE02', 'BE03', 'BE01'])
    expect(review.not_asked.every((n) => n.reason === undefined)).toBe(true)
    expect(JSON.stringify(review)).not.toContain('지운 답')
    expect(review.impression.mood).toBe('normal')
  })

  it('최종 요청에는 경험 한 줄을 붙이지 않는다', () => {
    const req = toFinalRequest('K-MOCK-0001', PRESETS.A.picks, exampleDraft(questions), questions)
    expect(req.mode).toBe('final')
    expect(req.picks.every((p) => p.has_exp === false)).toBe(true)
    expect(JSON.stringify(req)).not.toContain(PRESETS.A.experience)
  })
})

describe('최종 ③ 일부 단순 규칙 판정 안내', () => {
  it('예시 세트 그대로면 0개, 예시에 없는 들은 답 하나면 1개(못 물은 카드·회사가 물은 업무는 세지 않음)', async () => {
    const provider = createMockProvider()
    const example = exampleDraft(questions)
    const fixed = await generateFinal(toFinalRequest('K-MOCK-0001', PRESETS.A.picks, example, questions), { provider })
    expect(ruleJudgedAskedCount(fixed.card_states)).toBe(0)

    const edited = { ...example, items: { ...example.items, BE07: { ...example.items.BE07!, heard: '유지보수와 신규가 반반이에요' } } }
    const partial = await generateFinal(toFinalRequest('K-MOCK-0001', PRESETS.A.picks, edited, questions), { provider })
    expect(ruleJudgedAskedCount(partial.card_states)).toBe(1)

    const all = await generateFinal(toFinalRequest('K-MOCK-0001', PRESETS.A.picks, example, questions))
    expect(ruleJudgedAskedCount(all.card_states)).toBe(4)
  })
})
