/** S3 모의 공고(M4): 6건 이상 · 가명 회사 · 임시 표시 · 어느 공고에 지원해도 질문을 만들 수 있다. */
import { describe, expect, it } from 'vitest'
import { POSTINGS, PRESETS, getAnalysis } from './catalog'
import type { FirstQuestionsRequest } from './contract'
import { generateFirst, type GenerateReport } from './generate'
import { createMockProvider } from './providers/mock'

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
})
