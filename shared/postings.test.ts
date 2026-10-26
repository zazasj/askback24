/** S3 모의 공고(M4): 6건 이상 · 가명 회사 · 임시 표시 · 어느 공고에 지원해도 질문을 만들 수 있다. */
import { describe, expect, it } from 'vitest'
import { POSTINGS, PRESETS, REVIEW_EXAMPLE, getAnalysis } from './catalog'
import type { FirstQuestionsRequest, InterviewReview } from './contract'
import { generateFinal, generateFirst, type GenerateReport } from './generate'
import { createMockProvider } from './providers/mock'
import { interviewRounds } from './interviews'

const SEEDED = ['K-MOCK-0001', 'K-MOCK-0002']

describe('S3 모의 공고', () => {
  it('S3-01 공고 6건 이상, 공고 번호 중복 없음', () => {
    expect(POSTINGS.length).toBeGreaterThanOrEqual(6)
    expect(new Set(POSTINGS.map((p) => p.wantedAuthNo)).size).toBe(POSTINGS.length)
    for (const p of POSTINGS) expect(p.wantedAuthNo).toMatch(/^K-MOCK-\d{4}$/)
  })

  it('회사명은 "(주)" + 기호 가명 꼴이고, 형원 데이터 전 임시 공고는 draft 표시(D-008)', () => {
    for (const p of POSTINGS) {
      expect(p.corpNm, p.wantedAuthNo).toMatch(/^\(주\)[^\p{Script=Hangul}A-Za-z]*(OO)?[^\p{Script=Hangul}A-Za-z]*[\p{Script=Hangul}]+$/u)
      if (!SEEDED.includes(p.wantedAuthNo)) expect(p.draft, p.wantedAuthNo).toBe(true)
    }
  })

  it('S3-06 공고마다 형광펜 근거가 1개 이상', () => {
    for (const p of POSTINGS) expect(getAnalysis(p.wantedAuthNo)?.cards.some((c) => c.evidence), p.wantedAuthNo).toBe(true)
  })

  it('예시 구직자 A·B × 모든 공고: 가짜 공급자 질문 5개가 모두 검사를 통과한다', async () => {
    for (const p of POSTINGS) {
      for (const preset of Object.values(PRESETS)) {
        const req: FirstQuestionsRequest = { mode: 'first', wantedAuthNo: p.wantedAuthNo, picks: preset.picks, experience: preset.experience }
        let report: GenerateReport | undefined
        const res = await generateFirst(req, { provider: createMockProvider(), onReport: (r) => (report = r) })
        expect(res.questions, `${p.wantedAuthNo} ${preset.label}`).toHaveLength(5)
        expect(report?.issues, `${p.wantedAuthNo} ${preset.label}`).toEqual([])
        expect(res.questions.every((q) => q.source === 'ai'), `${p.wantedAuthNo} ${preset.label}`).toBe(true)
      }
    }
  })

  it('QA-R1-01 예시 A·B × 모든 공고(AI·검수 문장, 1차·최종): 문장 속 인용은 그 공고 원문에 있고, 인용 없이 공고 내용을 전제하지 않는다', async () => {
    for (const p of POSTINGS) {
      const original = Object.values(p).filter((v): v is string => typeof v === 'string').join('\n')
      for (const preset of Object.values(PRESETS)) {
        for (const fail of [false, true]) {
          const tag = `${p.wantedAuthNo} ${preset.label}${fail ? ' 검수 문장' : ''}`
          const first = await generateFirst(
            { mode: 'first', wantedAuthNo: p.wantedAuthNo, picks: preset.picks, experience: preset.experience },
            { provider: createMockProvider({ fail }) },
          )
          const final = await generateFinal(
            { mode: 'final', wantedAuthNo: p.wantedAuthNo, picks: preset.picks, review: reviewFor(first.questions.map((q) => q.card_id)) },
            { provider: createMockProvider({ fail }) },
          )
          for (const text of [...first.questions, ...final.final_questions].map((q) => q.text)) {
            for (const m of text.matchAll(/'([^']+)'/g)) expect(original, `${tag}: ${text}`).toContain(m[1])
            expect(text, tag).not.toMatch(UNQUOTED_PRESUPPOSE)
          }
        }
      }
    }
  })
})

describe('유추한 카드의 가짜 공급자 앞말(field-r1-02)', () => {
  it('예시 A·B × 모든 공고 × variant 0·1: 공고에서 유추한 카드 질문은 앞말에서 공고 문구를 인용하지 않는다', async () => {
    let seen = 0
    for (const p of POSTINGS) {
      const original = Object.values(p).filter((v): v is string => typeof v === 'string').join('\n')
      const analysis = getAnalysis(p.wantedAuthNo)
      for (const preset of Object.values(PRESETS)) {
        for (const variant of [0, 1]) {
          const res = await generateFirst(
            { mode: 'first', wantedAuthNo: p.wantedAuthNo, picks: preset.picks, experience: preset.experience },
            { provider: createMockProvider({ variant }) },
          )
          for (const q of res.questions) {
            if (analysis?.cards.find((c) => c.card_id === q.card_id)?.state !== 'inferred') continue
            seen++
            const tag = `${p.wantedAuthNo} ${preset.label} v${variant} ${q.card_id}: ${q.text}`
            for (const m of q.text.matchAll(/'([^']+)'/g)) expect(original.includes(m[1] ?? ''), tag).toBe(false)
          }
        }
      }
    }
    expect(seen, '유추한 카드 질문이 있다(예시 B × (주)OO소프트 BE12 등)').toBeGreaterThan(0)
  })
})

/** "공고에 고객사 상주 우대가 있던데"처럼 원문 인용 없이 공고 내용을 말함 */
const UNQUOTED_PRESUPPOSE = /공고에 [^'.?!]*?(?:있던데|있는데)/

/** R-04 예시 세트를 그 공고의 1차 질문 카드에 맞춰 담는다(예시에 없는 카드는 못 물음) */
function reviewFor(cardIds: readonly string[]): InterviewReview {
  const review: InterviewReview = { asked: [], not_asked: [], received: [], impression: { mood: REVIEW_EXAMPLE.mood } }
  cardIds.forEach((cardId, i) => {
    const asked = REVIEW_EXAMPLE.asked.find((a) => a.card_id === cardId)
    const notAsked = REVIEW_EXAMPLE.not_asked.find((n) => n.card_id === cardId)
    if (asked) review.asked.push({ question_id: `q${i + 1}`, card_id: cardId, heard: asked.heard, clarity: asked.clarity })
    else review.not_asked.push({ question_id: `q${i + 1}`, card_id: cardId, reason: notAsked?.reason ?? REVIEW_EXAMPLE.other_reason })
  })
  review.received = REVIEW_EXAMPLE.received.map((card_id) => ({ card_id }))
  return review
}

describe('H3-r2-03 공고의 면접 횟수(전형 방법 selMthd)', () => {
  it('모의 공고 7건: OO소프트·△△커머스·☆☆페이·◁◁로지스는 두 번, ◇◇데이터·▽▽정보기술·◎◎헬스케어는 한 번', () => {
    const rounds = Object.fromEntries(POSTINGS.map((p) => [p.wantedAuthNo, interviewRounds(p.selMthd)]))
    expect(rounds).toEqual({
      'K-MOCK-0001': 2,
      'K-MOCK-0002': 2,
      'K-MOCK-0003': 1,
      'K-MOCK-0004': 2,
      'K-MOCK-0005': 1,
      'K-MOCK-0006': 1,
      'K-MOCK-0007': 2,
    })
  })

  it('면접이 없거나 화살표로 나눈 전형도 센다', () => {
    expect(interviewRounds('서류전형')).toBe(0)
    expect(interviewRounds('서류전형 → 1차 면접 → 최종 면접 → 합격')).toBe(2)
  })
})
