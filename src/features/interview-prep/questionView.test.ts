/** 질문 카드에 보일 글(H2-01 인쇄 꼬리, H1-16 공고에 없음)과 인쇄·복사 순서(H1-14) */
import { describe, expect, it } from 'vitest'
import { getAnalysis } from '@shared/catalog'
import type { FinalQuestion } from '@shared/contract'
import { keptFirst } from './printOrder'
import { NO_EVIDENCE_TAG, finalMetaParts, firstMetaParts } from './questionView'

describe('H2-01·H1-16 질문 칩 옆 설명: 이름(인쇄에 남음)과 꼬리(화면에만)', () => {
  it('1차: 이름 = 카드 이름, 꼬리 = 내 선택, 공고에 근거가 없으면 "공고에 없음"', () => {
    expect(firstMetaParts('BE15', 'conflict', true)).toEqual({ name: '고객사 상주 개발', tail: '걱정돼요' })
    expect(firstMetaParts('BE02', 'opportunity', false)).toEqual({ name: '서비스 구조 설계', tail: `기대돼요 · ${NO_EVIDENCE_TAG}` })
    expect(NO_EVIDENCE_TAG).toBe('공고에 없음')
  })

  it('최종: 카드 질문은 선택·판정·공고 상태가 꼬리, 처우 질문은 근로조건 이름과 공고 상태', () => {
    const card = { card_id: 'BE15', type: 'recheck', evidence: { field: 'pfCond', quote: '고객사 상주 가능자' } } as unknown as FinalQuestion
    expect(finalMetaParts(card, 'avoid', '아직 모름', undefined)).toEqual({ name: '고객사 상주 개발', tail: '걱정돼요 · 아직 모름' })
    const noEvidence = { card_id: 'BE03', type: 'recheck' } as unknown as FinalQuestion
    expect(finalMetaParts(noEvidence, 'want', '아직 모름', undefined).tail).toBe(`기대돼요 · 아직 모름 · ${NO_EVIDENCE_TAG}`)
    const blank = getAnalysis('K-MOCK-0001')?.blanks.find((b) => b.topic === 'workHours')
    const offer = { topic: 'workHours', type: 'offer' } as unknown as FinalQuestion
    expect(blank).toBeDefined()
    expect(finalMetaParts(offer, null, undefined, blank)).toEqual({ name: '근로시간', tail: '공고에 없음' })
  })
})

describe('H1-14 인쇄·복사 순서: "면접에서 쓸 것 같아요"를 누른 질문이 맨 위, 나머지는 화면 순서', () => {
  it('누른 것만 앞으로, 각자의 순서는 그대로', () => {
    expect(keptFirst([1, 2, 3, 4, 5], (n) => n === 4 || n === 2)).toEqual([2, 4, 1, 3, 5])
    expect(keptFirst([1, 2, 3], () => false)).toEqual([1, 2, 3])
  })
})
