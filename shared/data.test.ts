/** 정적 데이터 점검: 형광펜이 안 칠해지는 근거(= 근거 없는 전제) 0건, 가상 인물 정보만. */
import { describe, expect, it } from 'vitest'
import { ANALYSES, CARDS, CARD_BOOK, POSTINGS, PRESETS, getCard, getPosting, getSignals } from './catalog'
import type { Evidence, Posting } from './contract'
import seed from '../data/applications.seed.json' with { type: 'json' }
import persona from '../data/persona.json' with { type: 'json' }

const quoteFound = (posting: Posting, e: Evidence) => posting[e.field].includes(e.quote)

describe('업무 카드', () => {
  it('17개 · ID 중복 없음 · 처음 12개 + 더 보기 5개', () => {
    expect(CARDS).toHaveLength(17)
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(17)
    expect(CARDS.filter((c) => c.core)).toHaveLength(12)
  })

  it('카드마다 기본 질문 틀 4종과 주의할 답·좋은 신호가 있다', () => {
    for (const c of CARDS) {
      for (const t of ['conflict', 'opportunity', 'depth', 'explore'] as const) expect(c.questions[t], `${c.id}.${t}`).toBeTruthy()
      expect(c.interpretation.good_if, c.id).toBeTruthy()
    }
    expect(getCard('BE15')?.questions.prevent).toBeTruthy()
  })

  it('QA-R1-01 질문 틀은 공고 내용을 말하지 않는다(어느 공고에나 쓰여서, 공고 인용은 앞말 몫)', () => {
    for (const c of CARDS) for (const [t, text] of Object.entries(c.questions)) expect(text, `${c.id}.${t}`).not.toMatch(/공고/)
  })

  it('유형 라벨 5종', () => {
    expect(Object.values(CARD_BOOK.type_labels)).toEqual(['충돌 확인', '기회 확인', '깊이 확인', '충돌 예방', '탐색'])
  })
})

describe('공고·분석·신호', () => {
  it('공고마다 분석 JSON과 회사 신호(출처 "실제"/"모의")가 있다', () => {
    for (const p of POSTINGS) {
      expect(ANALYSES.some((a) => a.wantedAuthNo === p.wantedAuthNo), p.wantedAuthNo).toBe(true)
      const signals = getSignals(p.wantedAuthNo)
      expect(signals.length, p.wantedAuthNo).toBeGreaterThan(0)
      for (const s of signals) expect(['실제', '모의']).toContain(s.source)
    }
  })

  it('근거 인용은 그 공고 필드 원문의 글자 그대로 일부다', () => {
    for (const a of ANALYSES) {
      const posting = getPosting(a.wantedAuthNo)
      expect(posting, a.wantedAuthNo).toBeDefined()
      if (!posting) continue
      for (const c of a.cards) {
        expect(getCard(c.card_id), `${a.wantedAuthNo} ${c.card_id}`).toBeDefined()
        if (c.evidence) expect(quoteFound(posting, c.evidence), `${a.wantedAuthNo} ${c.card_id} "${c.evidence.quote}"`).toBe(true)
        expect(c.reason).toBeTruthy()
      }
      for (const b of a.blanks) {
        if (b.evidence) expect(quoteFound(posting, b.evidence), `${a.wantedAuthNo} ${b.topic} "${b.evidence.quote}"`).toBe(true)
        expect(b.question).toBeTruthy()
      }
    }
  })

  it('(주)OO소프트 공고에 "기타 업무 지원"·"고객사 상주 가능자" 근거가 있다', () => {
    const quotes = ANALYSES.find((a) => a.wantedAuthNo === 'K-MOCK-0001')?.cards.map((c) => c.evidence?.quote)
    expect(quotes).toContain('기타 업무 지원')
    expect(quotes).toContain('고객사 상주 가능자')
  })
})

describe('지원 내역 시드·예시 구직자·김00', () => {
  it('시드 3건은 있는 공고를 가리키고 지원일은 30일 안', () => {
    expect(seed.map((s) => getPosting(s.wantedAuthNo)?.corpNm)).toEqual(['(주)OO소프트', '(주)△△커머스', '(주)◇◇데이터'])
    expect(seed.map((s) => s.result)).toEqual(['서류합격', '1차 합격', '-'])
    for (const s of seed) expect(s.applied_days_ago).toBeLessThanOrEqual(30)
  })

  it('예시 구직자 카드 ID가 모두 있다', () => {
    for (const p of Object.values(PRESETS)) for (const pick of p.picks) expect(getCard(pick.card_id), pick.card_id).toBeDefined()
  })

  it('김00 연락처는 시연용 값만', () => {
    expect(persona.basic.email).toBe('kim00@example.com')
    expect(persona.basic.phone).toBe('010-0000-0000')
    expect(persona.experience_chips).toHaveLength(3)
    expect(persona.experience_chips[0]?.text).toBe(PRESETS.A.experience)
  })
})
