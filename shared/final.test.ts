/** 최종 면접·처우 질문(ACCEPTANCE R·API-07). 판정 → 순서 규칙 → 표현 단계 → 검사. */
import { describe, expect, it } from 'vitest'
import { ANALYSES, CARDS, FINAL_BOOK, PRESETS, REVIEW_EXAMPLE, getCard, getPosting } from './catalog'
import type { CardPick, Evidence, FinalPref, FinalQuestionsRequest, InterviewReview, PostingState, ReviewState } from './contract'
import { generateFinal } from './generate'
import { classifyFinal, finalCardTemplate, rankFinal, ruleJudgements, type Origin } from './finalRules'
import { createMockProvider } from './providers/mock'
import type { FinalDraft, LlmProvider } from './providers/types'
import { checkFinalQuestion } from './validate'

const OO = 'K-MOCK-0001'
const COMMERCE = 'K-MOCK-0002'
/** 예시 구직자 A × (주)OO소프트 1차 질문 순서(API-01) */
const FIRST_A_OO = ['BE15', 'BE07', 'BE02', 'BE03', 'BE01']
const QUOTE_WORDS = /아까|하셨는데|말씀하신/

/** R-04 예시 세트를 1차 질문 순서대로 요청에 담는다 */
function r04Review(questionCards = FIRST_A_OO): InterviewReview {
  const review: InterviewReview = { asked: [], not_asked: [], received: [], impression: { mood: REVIEW_EXAMPLE.mood } }
  questionCards.forEach((cardId, i) => {
    const asked = REVIEW_EXAMPLE.asked.find((a) => a.card_id === cardId)
    const notAsked = REVIEW_EXAMPLE.not_asked.find((n) => n.card_id === cardId)
    if (asked) review.asked.push({ question_id: `q${i + 1}`, card_id: cardId, heard: asked.heard, clarity: asked.clarity })
    else review.not_asked.push({ question_id: `q${i + 1}`, card_id: cardId, reason: notAsked?.reason ?? REVIEW_EXAMPLE.other_reason })
  })
  review.received = REVIEW_EXAMPLE.received.map((card_id) => ({ card_id }))
  return review
}

const reqR04 = (review = r04Review(), wantedAuthNo = OO, picks: CardPick[] = PRESETS.A.picks): FinalQuestionsRequest => ({
  mode: 'final',
  wantedAuthNo,
  picks,
  review,
})

const HEARD = REVIEW_EXAMPLE.asked.map((a) => a.heard)

describe('API-07 최종 질문 순서 규칙', () => {
  it('API-07 R-04 입력의 카드 상태: BE15 아직 모름 · BE07 기대와 다름(예시 고정값) · BE02·BE01 확인됨 · BE03 아직 모름 · BE08 회사가 먼저 물은 것', async () => {
    const res = await generateFinal(reqR04(), { provider: createMockProvider() })
    const states = Object.fromEntries(res.card_states.map((s) => [s.card_id, s.state]))
    expect(states).toEqual({
      BE15: 'still_unknown',
      BE07: 'mismatch',
      BE02: 'confirmed',
      BE03: 'still_unknown',
      BE01: 'confirmed',
      BE08: 'company_signal',
    })
    expect(res.summary).toEqual({ confirmed: 2, mismatch: 1, still_unknown: 2, company_signal: 1 })
  })

  it('API-07 순서 = BE15 다시 확인 → BE08 신호 확인 → BE07 범위 확인 → 처우 확인들 → BE03 다시 확인, 확인됨은 없음', async () => {
    const res = await generateFinal(reqR04(), { provider: createMockProvider() })
    const order = res.final_questions.map((q) => `${q.card_id ?? `offer:${q.topic}`}/${q.type}`)
    const offers = res.final_questions.filter((q) => q.type === 'offer')
    expect(offers.length).toBeGreaterThanOrEqual(3)
    expect(order).toEqual(['BE15/recheck', 'BE08/signal', 'BE07/scope', ...offers.map((q) => `offer:${q.topic}/offer`), 'BE03/recheck'])
    expect(res.final_questions.map((q) => q.rank)).toEqual(res.final_questions.map((_, i) => i + 1))
    expect(res.final_questions.length).toBeLessThanOrEqual(8)
    for (const id of ['BE02', 'BE01']) expect(res.final_questions.some((q) => q.card_id === id), `${id} 확인됨은 빠진다`).toBe(false)
    expect(res.card_states.filter((s) => s.carry).map((s) => s.card_id).sort()).toEqual(['BE03', 'BE07', 'BE08', 'BE15'])
  })

  it('API-07 규칙표: 아직 모름×걱정 0.5 · 회사가 먼저 물음×걱정 1.0 · ×모르겠어요·안 고름 1.2 · 기대와 다름 1.5 · 아직 모름×기대 2.5 · 회사가 먼저 물음×기대 3.0 · 확인됨 없음', () => {
    expect(classifyFinal('still_unknown', 'avoid')).toEqual({ type: 'recheck', priority: 0.5 })
    expect(classifyFinal('company_signal', 'avoid')).toEqual({ type: 'signal', priority: 1.0 })
    expect(classifyFinal('company_signal', 'unsure')).toEqual({ type: 'signal', priority: 1.2 })
    expect(classifyFinal('company_signal', 'none')).toEqual({ type: 'signal', priority: 1.2 })
    for (const p of ['want', 'avoid', 'unsure', 'none'] as const) expect(classifyFinal('mismatch', p)).toEqual({ type: 'scope', priority: 1.5 })
    expect(classifyFinal('still_unknown', 'want')).toEqual({ type: 'recheck', priority: 2.5 })
    expect(classifyFinal('still_unknown', 'unsure')).toEqual({ type: 'recheck', priority: 2.5 })
    expect(classifyFinal('company_signal', 'want')).toEqual({ type: 'opportunity', priority: 3.0 })
    for (const p of ['want', 'avoid', 'unsure', 'none'] as const) expect(classifyFinal('confirmed', p)).toBeNull()
    expect(FINAL_BOOK.offer_priority).toBe(2.0)
  })

  // H1-06(세진 승인 2026-10-25): 걱정돼요 카드(BE07)는 구체적인 답이어도 단순 규칙에서 "확인됨"으로 빠지지 않고 아직 모름
  it('API-07 공급자가 없거나 실패하면 단순 규칙 판정(구체적 → 확인됨, 걱정돼요 카드는 아직 모름)과 검수 문장, 순서 규칙은 같다', async () => {
    for (const provider of [undefined, createMockProvider({ fail: true })]) {
      const res = await generateFinal(reqR04(), provider ? { provider } : {})
      expect(res.summary).toEqual({ confirmed: 2, mismatch: 0, still_unknown: 3, company_signal: 1 })
      expect(res.card_states.find((s) => s.card_id === 'BE07')?.basis).toBe(FINAL_BOOK.basis.asked_clear_avoid)
      expect(res.card_states.every((s) => s.source === 'rule')).toBe(true)
      expect(res.final_questions.every((q) => q.source === 'template')).toBe(true)
      expect(res.final_questions.map((q) => `${q.card_id ?? 'offer'}/${q.type}`)).toEqual([
        'BE15/recheck',
        'BE07/recheck',
        'BE08/signal',
        'offer/offer',
        'offer/offer',
        'offer/offer',
        'BE03/recheck',
      ])
    }
  })
})

describe('R 판정·표현 단계', () => {
  it('R-05 첫 질문 "다시 확인"에 "상주", 처우 확인 3개 이상, 8개 이하(가짜 공급자·검수 문장 둘 다)', async () => {
    for (const options of [{ provider: createMockProvider() }, {}]) {
      const res = await generateFinal(reqR04(), options)
      expect(res.final_questions[0]?.type).toBe('recheck')
      expect(res.final_questions[0]?.text).toContain('상주')
      expect(res.final_questions.filter((q) => q.type === 'offer').length).toBeGreaterThanOrEqual(3)
      expect(res.final_questions.length).toBeLessThanOrEqual(8)
    }
  })

  it('R-06 1차 면접관 인용 표현이 없고, "압박이 있었어요"면 완충 문장("여쭤도 될까요") 1개 이상', async () => {
    for (const options of [{ provider: createMockProvider() }, {}]) {
      const res = await generateFinal(reqR04(), options)
      for (const q of res.final_questions) expect(q.text).not.toMatch(QUOTE_WORDS)
      expect(res.final_questions.some((q) => q.text.includes('여쭤도 될까요'))).toBe(true)
    }
  })

  it('R-06 "편했어요"면 완충 없이 바로 묻고(앞말도 없음, 첫 처우 질문만 짧은 앞말 하나 — H2-10 ②), "보통이었어요"면 완충 없음', async () => {
    const relaxed = await generateFinal(reqR04({ ...r04Review(), impression: { mood: 'relaxed' } }), { provider: createMockProvider() })
    expect(relaxed.final_questions.some((q) => q.text.includes('여쭤도 될까요'))).toBe(false)
    // 가짜 판정(BE07 기대와 다름)과 같은 판정으로 순서를 세우면 "직접" 단계 문장 = 검수 문장
    const judged = ruleJudgements(r04Review(), PRESETS.A.picks).map((j) => (j.card_id === 'BE07' ? { ...j, state: 'mismatch' as const } : j))
    const template = rankFinal({ picks: PRESETS.A.picks, judged, mood: 'relaxed', analysis: ANALYSES[0]! })
    const firstOffer = template.findIndex((r) => r.type === 'offer')
    expect(firstOffer).toBeGreaterThan(0)
    template.forEach((r, i) => expect(r.tone, `${i + 1}번`).toBe(i === firstOffer ? 'basic' : 'direct'))
    relaxed.final_questions.forEach((q, i) => {
      const r = template[i]!
      if (i === firstOffer) {
        expect(q.text.endsWith(r.template_text), q.text).toBe(true)
        expect(q.text.length, '첫 처우 질문 앞에 짧은 앞말').toBeGreaterThan(r.template_text.length)
      } else expect(q.text).toBe(r.template_text)
    })
    const normal = await generateFinal(reqR04({ ...r04Review(), impression: { mood: 'normal' } }), { provider: createMockProvider() })
    expect(normal.final_questions.some((q) => q.text.includes('여쭤도 될까요'))).toBe(false)
  })

  it('가짜 공급자: 완충 문장이 붙은 질문은 앞말 없이 완충 + 검수 문장, 처우 질문 앞말은 연달아 같지 않다(DR-r3-05)', async () => {
    // 가짜 판정(BE07 기대와 다름)과 같은 판정으로 세운 순서·검수 문장
    const judged = ruleJudgements(r04Review()).map((j) => (j.card_id === 'BE07' ? { ...j, state: 'mismatch' as const } : j))
    const ranked = rankFinal({ picks: PRESETS.A.picks, judged, mood: 'pressured', analysis: ANALYSES[0]! })
    for (const variant of [0, 1, 2, 3]) {
      const res = await generateFinal(reqR04(), { provider: createMockProvider({ variant }) })
      expect(res.final_questions.map((q) => q.rank)).toEqual(ranked.map((r) => r.rank))
      const leads = res.final_questions.map((q, i) => {
        const r = ranked[i]!
        expect(q.text.endsWith(r.template), `${i + 1}번 끝은 검수 문장`).toBe(true)
        if (r.cushion) expect(q.text, `${i + 1}번 완충 문장 뒤 앞말 없음`).toBe(r.template_text)
        return { offer: q.type === 'offer', lead: q.text.slice(0, q.text.length - r.template.length) }
      })
      for (let i = 1; i < leads.length; i++) {
        const [a, b] = [leads[i - 1]!, leads[i]!]
        if (a.offer && b.offer && a.lead && b.lead) expect(b.lead, `variant ${variant} 처우 ${i}·${i + 1}번 앞말`).not.toBe(a.lead)
      }
    }
  })

  it('못 물은 이유 "분위기가 아니었어요"는 분위기와 상관없이 그 질문에 완충 문장', async () => {
    const review = r04Review()
    review.not_asked = [{ question_id: 'q4', card_id: 'BE03', reason: 'bad_mood' }]
    review.impression = { mood: 'normal' }
    const res = await generateFinal(reqR04(review), { provider: createMockProvider() })
    const be03 = res.final_questions.find((q) => q.card_id === 'BE03')
    expect(be03?.text).toContain('여쭤도 될까요')
    expect(res.final_questions.filter((q) => q.text.includes('여쭤도 될까요'))).toHaveLength(1)
  })

  it('A2-08 1차에 하나도 못 물었어도(전부 "분위기가 아니었어요") 완충 문장은 2개 이하이고 같은 문장이 두 번 나오지 않는다', async () => {
    const allBadMood = (mood: InterviewReview['impression']['mood']): InterviewReview => ({
      asked: [],
      not_asked: FIRST_A_OO.map((card_id, i) => ({ question_id: `q${i + 1}`, card_id, reason: 'bad_mood' as const })),
      received: [],
      impression: { mood },
    })
    for (const mood of ['pressured', 'normal', 'relaxed'] as const) {
      const ranked = rankFinal({ picks: PRESETS.A.picks, judged: ruleJudgements(allBadMood(mood)), mood, analysis: ANALYSES[0]! })
      const cushions = ranked.map((r) => r.cushion).filter(Boolean)
      expect(cushions.length, mood).toBeLessThanOrEqual(2)
      expect(new Set(cushions).size, `${mood}: 같은 완충 문장`).toBe(cushions.length)
      // 한도를 넘은 "분위기가 아니었어요" 질문은 기본 앞말 단계(편했어요여도 직접 아님)
      expect(ranked.filter((r) => !r.cushion && r.review_state).every((r) => r.tone === 'basic'), mood).toBe(true)
      for (const options of [{ provider: createMockProvider() }, {}]) {
        const res = await generateFinal(reqR04(allBadMood(mood)), options)
        for (const c of FINAL_BOOK.cushions) {
          const n = res.final_questions.filter((q) => q.text.includes(c.trim())).length
          expect(n, `${mood}: "${c.trim()}" ${n}번`).toBeLessThanOrEqual(1)
        }
        expect(res.final_questions.filter((q) => q.text.includes('여쭤도 될까요')).length, mood).toBeLessThanOrEqual(2)
      }
    }
  })

  it('A2-08 첫 완충 문장은 "하나"라고 하지 않는다(뒤에 질문이 더 이어짐)', () => {
    for (const c of FINAL_BOOK.cushions) expect(c).not.toMatch(/하나/)
    expect(FINAL_BOOK.cushions[0]).toBe('괜찮으시다면 여쭤도 될까요? ')
  })

  it('"회사가 먼저 설명해 줬어요"는 확인됨으로 빠지고, 회사가 물어본 업무가 내 질문 카드와 겹치면 내 판정을 따른다', async () => {
    const review = r04Review()
    review.not_asked = [{ question_id: 'q4', card_id: 'BE03', reason: 'explained' }]
    review.received = [{ card_id: 'BE15' }, { card_id: 'BE08' }]
    const res = await generateFinal(reqR04(review), { provider: createMockProvider() })
    const states = Object.fromEntries(res.card_states.map((s) => [s.card_id, s.state]))
    expect(states.BE03).toBe('confirmed')
    expect(states.BE15).toBe('still_unknown')
    expect(res.summary.company_signal).toBe(1)
    expect(res.final_questions.some((q) => q.card_id === 'BE03')).toBe(false)
  })

  it('정리하지 않은 질문(이유 없음)·답 모양을 고르지 않은 질문은 아직 모름', () => {
    const judged = ruleJudgements({
      asked: [{ question_id: 'q1', card_id: 'BE15', heard: '' }],
      not_asked: [{ question_id: 'q2', card_id: 'BE07' }],
      received: [],
      impression: { mood: 'normal' },
    })
    expect(judged.map((j) => j.state)).toEqual(['still_unknown', 'still_unknown'])
    expect(judged.every((j) => j.basis !== '')).toBe(true)
  })

  it('예시 세트와 들은 답이 다르면 가짜 판정도 단순 규칙(기대와 다름 없음)', async () => {
    const review = r04Review()
    review.asked = review.asked.map((a) => (a.card_id === 'BE07' ? { ...a, heard: '유지보수와 신규 개발이 반반이에요' } : a))
    const res = await generateFinal(reqR04(review), { provider: createMockProvider() })
    expect(res.summary.mismatch).toBe(0)
    // BE07은 걱정돼요 카드라 구체적인 답이어도 단순 규칙에서 아직 모름(H1-06)
    expect(res.card_states.find((s) => s.card_id === 'BE07')?.state).toBe('still_unknown')
  })

  it('H1-06 걱정돼요 카드에 구체적인 답 → 단순 규칙은 아직 모름(최종 다시 확인으로 남음), 기대돼요·모르겠어요 카드는 확인됨', () => {
    const review: InterviewReview = {
      asked: [
        { question_id: 'q1', card_id: 'BE07', heard: '유지보수가 대부분이에요', clarity: 'clear' },
        { question_id: 'q2', card_id: 'BE01', heard: '수습 끝나면 맡아요', clarity: 'clear' },
        { question_id: 'q3', card_id: 'BE08', heard: '당번은 없어요', clarity: 'clear' },
      ],
      not_asked: [],
      received: [],
      impression: { mood: 'normal' },
    }
    const judged = ruleJudgements(review, PRESETS.A.picks)
    expect(judged.map((j) => `${j.card_id}/${j.state}`)).toEqual(['BE07/still_unknown', 'BE01/confirmed', 'BE08/confirmed'])
    expect(judged[0]?.basis).toBe(FINAL_BOOK.basis.asked_clear_avoid)
    const ranked = rankFinal({ picks: PRESETS.A.picks, judged, mood: 'normal', analysis: ANALYSES[0]! })
    expect(ranked[0]).toMatchObject({ card_id: 'BE07', type: 'recheck' })
  })

  it('예시 세트에 없는 들은 답은 가짜 판정이 내지 않아 카드 source가 rule로 남고, 예시 세트 그대로면 물어본 카드는 모두 ai', async () => {
    const review = r04Review()
    review.asked = review.asked.map((a) =>
      a.card_id === 'BE07' ? { ...a, heard: '유지보수와 신규 개발이 반반이에요' } : a.card_id === 'BE15' ? { ...a, heard: '상주는 거의 없어요', clarity: 'clear' as const } : a,
    )
    const res = await generateFinal(reqR04(review), { provider: createMockProvider() })
    const states = Object.fromEntries(res.card_states.map((s) => [s.card_id, `${s.state}/${s.source}`]))
    // 둘 다 걱정돼요 카드라 단순 규칙은 아직 모름(H1-06)
    expect(states.BE07).toBe('still_unknown/rule')
    expect(states.BE15).toBe('still_unknown/rule')
    expect(states.BE02).toBe('confirmed/ai')
    expect(states.BE01).toBe('confirmed/ai')

    const fixed = await generateFinal(reqR04(), { provider: createMockProvider() })
    const asked = new Set(REVIEW_EXAMPLE.asked.map((a) => a.card_id))
    for (const s of fixed.card_states) expect(`${s.card_id}/${s.source}`).toBe(`${s.card_id}/${asked.has(s.card_id) ? 'ai' : 'rule'}`)
  })

  it('S1 2행 시드(예시 A × (주)△△커머스)에도 예시 세트가 같은 카드에 맞는다', async () => {
    const res = await generateFinal(reqR04(r04Review(['BE02', 'BE03', 'BE01', 'BE07', 'BE15']), COMMERCE), { provider: createMockProvider() })
    expect(res.summary).toEqual({ confirmed: 2, mismatch: 1, still_unknown: 2, company_signal: 1 })
    for (const q of res.final_questions) expect(q.text).not.toMatch(/공고에[^.?!]*?(있던데|있는데)/)
  })
})

describe('Q-01 다시 확인은 1차 질문을 이어 받는다(DA-02)', () => {
  /** 공고에 적힌 상주를 처음부터 다시 묻는 말(충돌 예방 틀) */
  const ASK_FROM_SCRATCH = /투입되는 경우도 있나요/
  const CUSHIONS = /^(?:[^?]*여쭤도 될까요\? )+/

  // H1-13(세진 승인 2026-10-25): 1차 답이 모호했으면 1차 본문을 되풀이하지 않고 구체적인 예를 묻는다. "상주"+"기간"은 지킴
  it('Q-01 (주)OO소프트 + R-04 최종 1번: 공고 인용으로 이어 받고 "상주"·"기간"을 구체적인 예로 묻는다(가짜 공급자·검수 문장)', async () => {
    for (const options of [{ provider: createMockProvider() }, {}]) {
      const res = await generateFinal(reqR04(), options)
      const first = res.final_questions[0]!
      expect(first.type).toBe('recheck')
      const body = first.text.replace(CUSHIONS, '')
      expect(body, first.text).toMatch(/^지난 면접에 이어 공고의 '고객사 상주 가능자' 부분을/)
      for (const word of ['상주', '기간', '예를']) expect(first.text).toContain(word)
      expect(first.text).not.toMatch(ASK_FROM_SCRATCH)
      // 1차에 가져간 차이 확인 틀을 그대로 되풀이하지 않는다
      expect(first.text).not.toContain(getCard('BE15')!.questions.conflict)
      for (const q of res.final_questions) expect(q.text).not.toMatch(QUOTE_WORDS)
    }
  })

  it('물어본 질문은 "지난 면접에 이어"(근거가 있으면 공고 인용), 못 물은 질문은 근거가 있을 때만 공고 인용 + 1차와 같은 유형 틀', () => {
    const be15 = getCard('BE15')!
    const ev: Evidence = { field: 'pfCond', quote: '고객사 상주 가능자' }
    expect(finalCardTemplate(be15, 'recheck', 'avoid', 'explicit', 'asked', ev)).toBe(
      `지난 면접에 이어 공고의 '고객사 상주 가능자' 부분을 조금 더 구체적으로 여쭙겠습니다. ${be15.questions.conflict}`,
    )
    expect(finalCardTemplate(be15, 'recheck', 'avoid', 'explicit', 'not_asked', ev)).toBe(
      `공고의 '고객사 상주 가능자' 부분과 관련해 꼭 확인하고 싶은 점이 있습니다. ${be15.questions.conflict}`,
    )
    // 공고에 없던 카드는 1차에도 "…경우도 있나요?"(충돌 예방)로 물었으니 그 틀을 이어 쓴다
    expect(finalCardTemplate(be15, 'recheck', 'avoid', 'absent', 'asked')).toBe(
      `지난 면접에 이어 고객사 상주 개발 부분을 조금 더 구체적으로 여쭙겠습니다. ${be15.questions.prevent}`,
    )
    expect(finalCardTemplate(be15, 'recheck', 'avoid', 'absent', 'not_asked')).toBe(be15.questions.prevent)
  })

  it('가짜 공급자는 앞말을 품은 다시 확인 검수 문장에 앞말을 겹쳐 붙이지 않는다', async () => {
    for (const variant of [0, 1]) {
      const res = await generateFinal(reqR04({ ...r04Review(), impression: { mood: 'normal' } }), { provider: createMockProvider({ variant }) })
      const rechecks = res.final_questions.filter((x) => x.type === 'recheck')
      expect(rechecks.length).toBeGreaterThan(0)
      for (const q of rechecks) {
        for (const lead of [/지난 면접에 이어/g, /공고의 '/g, /구체적으로/g, /싶었/g]) expect(q.text.match(lead)?.length ?? 0, q.text).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('API-05·검사: 들은 답은 응답에 남지 않는다', () => {
  it('API-05 응답 어디에도 들은 답 원문이 없다(가짜 공급자·검수 문장)', async () => {
    for (const options of [{ provider: createMockProvider() }, {}]) {
      const text = JSON.stringify(await generateFinal(reqR04(), options))
      for (const h of HEARD) expect(text).not.toContain(h)
    }
  })

  it('공급자 문장이 1차 면접관 말·들은 답을 옮기면 그 질문만 검수 문장', async () => {
    const quoting: LlmProvider = {
      name: 'test',
      writeFirst: async () => [],
      writeFinal: async (input): Promise<FinalDraft[]> =>
        input.items.map((i) => ({
          key: i.key,
          text: i.rank === 1 ? `아까 ${HEARD[0]}라고 하셨는데, ${i.template}` : i.rank === 2 ? `${HEARD[1]} 맞나요? ${i.template}` : i.template_text,
        })),
    }
    const res = await generateFinal(reqR04(), { provider: quoting })
    expect(res.final_questions.map((q) => q.source)).toEqual(res.final_questions.map((_, i) => (i < 2 ? 'template' : 'ai')))
    const text = JSON.stringify(res)
    for (const h of HEARD) expect(text).not.toContain(h)
  })

  it('공급자 판정의 근거가 들은 답을 옮기거나 비어 있으면 받지 않는다', async () => {
    const judging: LlmProvider = {
      name: 'test',
      writeFirst: async () => [],
      judgeReview: async (input) =>
        input.items.map((i) => ({ card_id: i.card_id, state: 'mismatch' as const, basis: i.card_id === 'BE07' ? `"${i.heard}"라서` : i.card_id === 'BE02' ? '' : '주의할 답과 맞아요' })),
    }
    const reports: Array<{ judged?: number; issues: string[] }> = []
    const res = await generateFinal(reqR04(), { provider: judging, onReport: (r) => reports.push(r) })
    const states = Object.fromEntries(res.card_states.map((s) => [s.card_id, `${s.state}/${s.source}`]))
    // BE07은 걱정돼요 카드라 단순 규칙이 아직 모름(H1-06)
    expect(states.BE07).toBe('still_unknown/rule')
    expect(states.BE02).toBe('confirmed/rule')
    expect(states.BE01).toBe('mismatch/ai')
    expect(reports[0]?.judged).toBe(2)
    expect(reports[0]?.issues).toContain('judge_rejected')
    expect(JSON.stringify(res)).not.toContain(HEARD[1])
  })

  it('판정이 시간 한도를 다 쓰면 문장은 부르지 않고 검수 문장', async () => {
    let wrote = false
    const slow: LlmProvider = {
      name: 'slow',
      writeFirst: async () => [],
      judgeReview: (_input, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
      writeFinal: async () => {
        wrote = true
        return []
      },
    }
    const reports: Array<{ failure?: string }> = []
    const res = await generateFinal(reqR04(), { provider: slow, timeoutMs: 30, onReport: (r) => reports.push(r) })
    expect(wrote).toBe(false)
    expect(reports[0]?.failure).toBe('timeout')
    expect(res.final_questions.every((q) => q.source === 'template')).toBe(true)
  })
})

describe('검수 문장 전수 검사', () => {
  it('모든 공고 × 카드 × (상태 × 선호 × 출처)의 최종 검수 문장과 처우 질문이 검사를 통과한다', () => {
    const cases: Array<[ReviewState, FinalPref, Origin]> = []
    for (const state of ['mismatch', 'still_unknown', 'company_signal'] as const)
      for (const pref of ['want', 'avoid', 'unsure', 'none'] as const)
        for (const origin of ['asked', 'not_asked', 'received'] as const) cases.push([state, pref, origin])
    let checked = 0
    for (const a of ANALYSES) {
      const posting = getPosting(a.wantedAuthNo)!
      for (const card of CARDS) {
        const found = a.cards.find((c) => c.card_id === card.id)
        const postingState: PostingState = found?.state ?? 'absent'
        for (const [state, pref, origin] of cases) {
          const hit = classifyFinal(state, pref)
          if (!hit) continue
          for (const cushion of ['', ...FINAL_BOOK.cushions]) {
            const text = `${cushion}${finalCardTemplate(card, hit.type, pref, postingState, origin, found?.evidence)}`
            const check = { text, state: postingState, ...(found?.evidence ? { evidence: found.evidence } : {}) }
            expect(checkFinalQuestion(check, posting, HEARD), `${a.wantedAuthNo} ${card.id} ${state}/${pref}/${origin}: ${text}`).toEqual([])
            checked++
          }
        }
      }
      for (const b of a.blanks) {
        for (const cushion of ['', ...FINAL_BOOK.cushions]) {
          const check = { text: `${cushion}${b.question}`, ...(b.evidence ? { evidence: b.evidence } : {}) }
          expect(checkFinalQuestion(check, posting, HEARD), `${a.wantedAuthNo} ${b.topic}`).toEqual([])
        }
        expect(FINAL_BOOK.offer_topics[b.topic], b.topic).toBeDefined()
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })

  it('모든 공고 × 예시 구직자 A·B × 예시 정리: 가짜 공급자 문장이 모두 검사를 통과하고 8개 이하', async () => {
    for (const a of ANALYSES) {
      for (const preset of Object.values(PRESETS)) {
        const cards = preset.picks.slice(0, 5).map((p) => p.card_id)
        const res = await generateFinal(reqR04(r04Review(cards), a.wantedAuthNo, preset.picks), { provider: createMockProvider() })
        expect(res.final_questions.every((q) => q.source === 'ai'), `${a.wantedAuthNo} ${preset.label}`).toBe(true)
        expect(res.final_questions.length).toBeLessThanOrEqual(8)
        for (const q of res.final_questions) expect(q.basis, `${a.wantedAuthNo} ${q.card_id ?? q.topic}`).toBeTruthy()
      }
    }
  })
})

describe('D-179 최종 질문 문장도 면접 비즈니스체', () => {
  const HAEYO_STATEMENT = /요\.?$/
  it('R-04 예시 세트 × 두 공고 × 분위기 3가지, 변형 0·1: 어느 문장도 해요체 서술("…요.")로 끝나지 않는다', async () => {
    for (const posting of [OO, COMMERCE]) {
      for (const mood of ['relaxed', 'normal', 'pressured'] as const) {
        for (const variant of [0, 1]) {
          const res = await generateFinal(reqR04({ ...r04Review(), impression: { mood } }, posting), { provider: createMockProvider({ variant }) })
          for (const q of res.final_questions) {
            for (const s of q.text.split(/(?<=[.?!])\s+/)) expect(s.trim(), `${posting} ${mood} v${variant}: ${q.text}`).not.toMatch(HAEYO_STATEMENT)
          }
        }
      }
    }
  })
})

describe('H3-r2-02 걱정돼요 카드의 "기대와 다름" 근거는 "걱정한 대로"', () => {
  it('R-04 예시: BE07(걱정돼요)은 상태 mismatch 그대로(요약 개수 그대로), 근거는 걱정한 대로', async () => {
    const res = await generateFinal(reqR04(), { provider: createMockProvider() })
    const be07 = res.card_states.find((s) => s.card_id === 'BE07')
    expect(be07?.state).toBe('mismatch')
    expect(res.summary.mismatch).toBe(1)
    expect(be07?.basis.startsWith(FINAL_BOOK.basis.mismatch_avoid), be07?.basis).toBe(true)
    expect(be07?.basis).not.toContain('내 기대와 달라요')
  })
})
