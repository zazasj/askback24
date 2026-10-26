import { describe, expect, it } from 'vitest'
import { POSTINGS, PRESETS, getAnalysis } from '@shared/catalog'
import type { Posting, PostingAnalysis } from '@shared/contract'
import { pickExplore, pickTop5 } from '@shared/rules'
import { BLANK_TAGS, checkPoints, exploreTag, firstLooks, postingTag, shortReason } from './checkpoints'
import { markKey, marksOf, segmentsFor } from './highlight'

/** 화면(PostingStep)처럼 카드 → 칠한 형광펜(열쇠·글)을 찾는다 */
function spotResolver(posting: Posting, analysis: PostingAnalysis) {
  const marks = marksOf(analysis)
  return (cardId: string) => {
    const field = analysis.cards.find((c) => c.card_id === cardId)?.evidence?.field
    if (!field) return undefined
    const seg = segmentsFor(field, String(posting[field] ?? ''), marks).find((s) => s.cardIds.includes(cardId))
    return seg ? { key: markKey(field, seg), quote: seg.text } : undefined
  }
}

describe('AI 분석 요약 — 먼저 볼 두 곳(F-04)', () => {
  it('(주)OO소프트: 모호한 업무 "기타 업무 지원" → 근무 방식 "고객사 상주 가능자" 순서, 이유에는 인용을 되풀이하지 않는다', () => {
    const posting = POSTINGS.find((p) => p.wantedAuthNo === 'K-MOCK-0001')
    const analysis = getAnalysis('K-MOCK-0001')
    if (!posting || !analysis) throw new Error('K-MOCK-0001 없음')
    const looks = firstLooks(checkPoints(analysis), spotResolver(posting, analysis))
    expect(looks.map((l) => l.quote)).toEqual(['기타 업무 지원', '고객사 상주 가능자'])
    expect(looks.map((l) => l.reason)).toEqual([
      '범위가 모호해 기존 시스템 유지보수가 포함될 수 있어요',
      '고객사 상주 개발 · 상주 가능자를 우대해 신입도 고객사에 나가 일할 수 있어요. 기간과 비율을 확인해 볼 만해요',
    ])
  })

  it('모든 공고: 최대 2곳, 형광펜이 서로 다르고 인용이 원문에 있으며, 이유는 비어 있지 않고 인용 따옴표를 남기지 않는다', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      if (!analysis) continue
      const resolve = spotResolver(posting, analysis)
      const looks = firstLooks(checkPoints(analysis), resolve)
      const where = posting.wantedAuthNo
      const marked = new Set(checkPoints(analysis).flatMap((p) => (p.hasMark && p.cardId ? [resolve(p.cardId)?.key ?? ''] : [])).filter(Boolean))
      expect(looks.length, where).toBe(Math.min(2, marked.size))
      expect(new Set(looks.map((l) => l.key)).size, where).toBe(looks.length)
      const text = Object.values(posting).filter((v) => typeof v === 'string').join('\n')
      for (const l of looks) {
        expect(text.includes(l.quote), `${where} ${l.quote}`).toBe(true)
        expect(l.reason.length, `${where} ${l.reason}`).toBeGreaterThanOrEqual(4)
        expect(l.reason, where).not.toContain(`'${l.quote}'`)
        expect(l.reason, where).not.toMatch(/^\s|\s$|\s{2}/)
      }
    }
  })
})

describe('H2-07 ① 먼저 볼 두 곳은 공고에 적힌 것(모호한 표현·공고에 있음) 먼저, 유추는 모자랄 때만', () => {
  it('모든 공고: 공고에 적힌 형광펜이 두 곳 이상이면 "공고에서 유추" 항목은 먼저 볼 곳에 없다', () => {
    let checked = 0
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      if (!analysis) continue
      const points = checkPoints(analysis)
      const resolve = spotResolver(posting, analysis)
      const looks = firstLooks(points, resolve)
      const tagOf = (cardId: string) => points.find((p) => p.cardId === cardId)?.tag
      const written = new Set(points.filter((p) => p.hasMark && p.cardId && p.tag !== '공고에서 유추').map((p) => resolve(p.cardId!)?.key).filter(Boolean))
      if (written.size < 2) continue
      checked++
      for (const l of looks) expect(tagOf(l.cardId), `${posting.wantedAuthNo} ${l.quote}`).not.toBe('공고에서 유추')
    }
    expect(checked).toBeGreaterThanOrEqual(6)
  })
})

describe('shortReason', () => {
  it('인용 + 조사로 시작하면 그 부분을 빼고, 카드 이름이 이미 있으면 붙이지 않는다', () => {
    expect(shortReason('기존 시스템 유지보수', "'기타 업무 지원'은 범위가 모호해 기존 시스템 유지보수가 포함될 수 있어요", '기타 업무 지원')).toBe(
      '범위가 모호해 기존 시스템 유지보수가 포함될 수 있어요',
    )
  })

  it('문장 가운데 인용은 조사를 앞말에 붙여 남기고, 카드 이름을 앞에 붙인다', () => {
    expect(shortReason('SQL 작성·쿼리 개선', "자격요건 'SQL 기본 문법을 이해하시는 분'에서 쿼리 작성 업무를 유추했어요", 'SQL 기본 문법을 이해하시는 분')).toBe(
      'SQL 작성·쿼리 개선 · 자격요건에서 쿼리 작성 업무를 유추했어요',
    )
    expect(shortReason('장애 대응·온콜', "직무내용에 '24시간 서비스 모니터링(당직 순번제)'이 적혀 있어요", '24시간 서비스 모니터링(당직 순번제)')).toBe(
      '장애 대응·온콜 · 직무내용에 적혀 있어요',
    )
  })

  it('설명에 인용이 없으면 그대로 둔다', () => {
    expect(shortReason('요구사항 협의', '고객사에 상주하면 고객과 요구사항을 직접 협의할 수 있어요(우대조건에서 유추)', '고객사 상주 가능자')).toBe(
      '요구사항 협의 · 고객사에 상주하면 고객과 요구사항을 직접 협의할 수 있어요(우대조건에서 유추)',
    )
  })
})

// A3-r2-03: ③ "더 알아볼 질문" 꼬리표는 ① 공고 상태 표시(postingTag)와 같은 말. 공고에 없음이면 꼬리표 없음
describe('A3-r2-03 더 알아볼 질문 꼬리표 = ① postingTag', () => {
  /** FirstResultStep 처럼: 예시 A 의 더 알아볼 질문(질문 5개와 겹치지 않음) → 카드 ID */
  function exploresOf(analysis: PostingAnalysis): string[] {
    const top = new Set(pickTop5(PRESETS.A, analysis).map((r) => r.card_id))
    return pickExplore(PRESETS.A, analysis)
      .filter((r) => !top.has(r.card_id))
      .map((r) => r.card_id)
  }

  it('공고 7건 × 예시 A: 꼬리표는 ① postingTag 그대로, "공고에 없음"·분석에 없는 카드는 꼬리표 없음, "공고에 나온 일"은 없다', () => {
    let tagged = 0
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      if (!analysis) continue
      for (const id of exploresOf(analysis)) {
        const where = `${posting.wantedAuthNo} ${id}`
        const shown = postingTag(analysis.cards.find((c) => c.card_id === id))
        const tag = exploreTag(analysis, id)
        expect(tag, where).toBe(shown === BLANK_TAGS.missing ? null : shown)
        expect(tag, where).not.toBe('공고에 나온 일')
        if (tag) tagged++
      }
    }
    expect(tagged).toBeGreaterThan(0)
  })

  it('(주)OO소프트: SQL 작성·쿼리 개선·요구사항 협의 = 공고에서 유추 · (주)△△커머스: 장애 대응·온콜(근거 없는 유추) = 꼬리표 없음', () => {
    const oo = getAnalysis('K-MOCK-0001')
    const commerce = getAnalysis('K-MOCK-0002')
    if (!oo || !commerce) throw new Error('분석 없음')
    expect(exploresOf(oo)).toEqual(['BE14', 'BE04', 'BE12'])
    expect(exploreTag(oo, 'BE04')).toBe('공고에서 유추')
    expect(exploreTag(oo, 'BE12')).toBe('공고에서 유추')
    expect(exploreTag(oo, 'BE14')).toBe(postingTag(oo.cards.find((c) => c.card_id === 'BE14')))
    expect(exploresOf(commerce)).toContain('BE08')
    expect(exploreTag(commerce, 'BE08')).toBeNull()
    expect(exploreTag(commerce, 'BE99')).toBeNull()
    expect(exploreTag(undefined, 'BE04')).toBeNull()
  })
})
