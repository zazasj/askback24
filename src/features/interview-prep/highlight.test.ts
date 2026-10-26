import { describe, expect, it } from 'vitest'
import { POSTINGS, getAnalysis, getPosting, getSignals } from '@shared/catalog'
import type { EvidenceField, Posting } from '@shared/contract'
import { BLANK_TAGS, checkPoints, firstLooks, postingTag } from './checkpoints'
import { offerMeta } from './questionView'
import { loadingQuotes, marksOf, quotesInOrder, segmentsFor, splitByQuotes } from './highlight'
import { POSTING_FIELD_ORDER } from './postingRows'

const join = (segs: Array<{ text: string }>) => segs.map((s) => s.text).join('')

describe('splitByQuotes', () => {
  it('원문을 그대로 이어 붙일 수 있게 나누고 인용 자리에만 카드를 단다', () => {
    const text = '서버 개발 및 기타 업무 지원'
    const segs = splitByQuotes(text, [
      { quote: '기타 업무 지원', cardId: 'BE07' },
      { quote: '서버 개발', cardId: 'BE01' },
    ])
    expect(join(segs)).toBe(text)
    expect(segs.filter((s) => s.cardIds.length).map((s) => [s.text, s.cardIds])).toEqual([
      ['서버 개발', ['BE01']],
      ['기타 업무 지원', ['BE07']],
    ])
  })

  it('같은 인용을 쓴 카드 여럿은 형광펜 하나로 묶는다', () => {
    const segs = splitByQuotes('고객사 상주 가능자, 정보처리기사', [
      { quote: '고객사 상주 가능자', cardId: 'BE15' },
      { quote: '고객사 상주 가능자', cardId: 'BE12' },
    ])
    expect(segs[0]).toEqual({ text: '고객사 상주 가능자', start: 0, cardIds: ['BE15', 'BE12'] })
    expect(segs).toHaveLength(2)
  })

  it('원문에 없는 인용은 칠하지 않고, 겹치면 앞의 것만 칠한다', () => {
    const segs = splitByQuotes('기타 업무 지원', [
      { quote: '없는 문구', cardId: 'BE01' },
      { quote: '기타 업무', cardId: 'BE07' },
      { quote: '업무 지원', cardId: 'BE12' },
    ])
    expect(join(segs)).toBe('기타 업무 지원')
    expect(segs.filter((s) => s.cardIds.length).map((s) => s.text)).toEqual(['기타 업무'])
  })

  it('빈 글이나 인용이 없으면 조각이 원문 그대로다', () => {
    expect(splitByQuotes('', [{ quote: 'a', cardId: 'x' }])).toEqual([])
    expect(splitByQuotes('abc', [])).toEqual([{ text: 'abc', start: 0, cardIds: [] }])
  })
})

describe('모의 공고 형광펜', () => {
  it('S4-03 (주)OO소프트: 형광펜 3개 이상, "기타 업무 지원"·"고객사 상주 가능자" 포함', () => {
    const posting = getPosting('K-MOCK-0001') as Posting
    const marks = marksOf(getAnalysis('K-MOCK-0001'))
    const fields = [...new Set(marks.map((m) => m.field))]
    const marked = fields.flatMap((f) => segmentsFor(f, String(posting[f]), marks).filter((s) => s.cardIds.length).map((s) => s.text))
    expect(marked.length).toBeGreaterThanOrEqual(3)
    expect(marked).toContain('기타 업무 지원')
    expect(marked).toContain('고객사 상주 가능자')
  })

  it('모든 분석의 근거 인용이 공고 원문에 글자 그대로 있다(형광펜이 빠지지 않는다)', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      if (!analysis) continue
      for (const m of marksOf(analysis)) {
        expect(String(posting[m.field as EvidenceField]), `${posting.wantedAuthNo} ${m.cardId}`).toContain(m.quote)
      }
    }
  })
})

describe('AI가 찾은 확인할 점', () => {
  it('S4-05 (주)OO소프트: 3개 이상이고 모호한 표현(기존 시스템 유지보수)이 맨 위', () => {
    const points = checkPoints(getAnalysis('K-MOCK-0001'))
    expect(points.length).toBeGreaterThanOrEqual(3)
    expect(points[0]).toMatchObject({ tag: '모호한 표현', title: '기존 시스템 유지보수', cardId: 'BE07', hasMark: true })
    expect(points.some((p) => p.tag === '공고에 없음' && p.title === '근로시간')).toBe(true)
  })

  it('"확인 필요" 근로조건(처우 질문 재료)은 넣지 않는다', () => {
    for (const posting of POSTINGS) {
      const points = checkPoints(getAnalysis(posting.wantedAuthNo))
      expect(points.length, posting.wantedAuthNo).toBeGreaterThanOrEqual(3)
      expect(points.some((p) => p.title === '수습' && p.tag !== '공고에 없음'), posting.wantedAuthNo).toBe(false)
    }
  })
})

describe('근거 인용 없는 유추 카드(DR-r2-03)', () => {
  it('"공고에서 유추" 대신 "공고에 없음"을 달고, 설명이 회사 신호 문장을 그대로 옮기지 않는다', () => {
    let seen = 0
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      const signals = getSignals(posting.wantedAuthNo).map((s) => s.text.replace(/요$/, ''))
      const points = checkPoints(analysis)
      for (const c of analysis?.cards ?? []) {
        if (c.state !== 'inferred' || c.evidence) continue
        seen++
        const where = `${posting.wantedAuthNo} ${c.card_id}`
        expect(postingTag(c), where).toBe('공고에 없음')
        expect(points.find((p) => p.key === `card:${c.card_id}`)?.tag, where).toBe('공고에 없음')
        for (const s of signals) expect(c.reason, `${where}: 회사 신호 "${s}"`).not.toContain(s)
      }
    }
    expect(seen, '시험할 카드가 있다(OO소프트 BE17 등)').toBeGreaterThan(0)
  })

  it('근로조건(blanks)의 근거·처우 질문도 회사 신호 문장을 옮기지 않고, 공고에 없는 "24시간"을 전제하지 않는다', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      const signals = getSignals(posting.wantedAuthNo).map((s) => s.text.replace(/요$/, ''))
      const postingText = Object.values(posting).filter((v) => typeof v === 'string').join('\n')
      for (const b of analysis?.blanks ?? []) {
        const where = `${posting.wantedAuthNo} ${b.topic}`
        for (const text of [b.basis, b.question]) {
          for (const s of signals) expect(text, `${where}: 회사 신호 "${s}"`).not.toContain(s)
          if (!postingText.includes('24시간')) expect(text, `${where}: 공고에 없는 24시간`).not.toContain('24시간')
        }
      }
    }
  })

  it('근거 인용이 있는 유추·공고에 있음·모호는 그대로, 분석에 없는 카드는 표시 없음', () => {
    expect(postingTag({ state: 'inferred', evidence: { field: 'pfCond', quote: '고객사 상주 가능자' } })).toBe('공고에서 유추')
    expect(postingTag({ state: 'explicit', evidence: { field: 'jobCont', quote: '서버 개발' } })).toBe('공고에 있음')
    expect(postingTag({ state: 'vague', evidence: { field: 'jobCont', quote: '기타 업무 지원' } })).toBe('모호한 표현')
    expect(postingTag(undefined)).toBeNull()
  })
})

describe('근로조건 상태 글자(DR-r1-12)', () => {
  it('분석 JSON의 근로조건 이름에는 상태 글자가 없고("· 공고 누락" 등), ① 확인할 점과 최종 ③ 처우 질문이 같은 글자를 쓴다', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      for (const b of analysis?.blanks ?? []) {
        expect(b.label, `${posting.wantedAuthNo} ${b.topic}`).not.toMatch(/·|누락|모호|확인 필요/)
        expect(offerMeta(b)).toBe(`${b.label} · ${BLANK_TAGS[b.status]}`)
      }
      for (const p of checkPoints(analysis).filter((x) => x.key.startsWith('blank:'))) {
        expect(Object.values(BLANK_TAGS)).toContain(p.tag)
      }
    }
    const hours = getAnalysis('K-MOCK-0001')?.blanks.find((b) => b.topic === 'workHours')
    expect(hours && offerMeta(hours)).toBe('근로시간 · 공고에 없음')
  })
})

describe('① 로딩의 근거 인용(LD-01)', () => {
  it('① 표 문서 순서로, 같은 글은 한 번, 최대 4개이고 모두 그 공고 원문 형광펜이다', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      const all = quotesInOrder(posting, analysis, POSTING_FIELD_ORDER)
      const four = quotesInOrder(posting, analysis, POSTING_FIELD_ORDER, 4)
      expect(four, posting.wantedAuthNo).toEqual(all.slice(0, 4))
      expect(new Set(all).size, posting.wantedAuthNo).toBe(all.length)
      const marked = new Set(marksOf(analysis).map((m) => m.quote))
      for (const q of all) expect(marked.has(q), `${posting.wantedAuthNo} "${q}"`).toBe(true)
    }
  })

  it('(주)OO소프트: 직무내용 형광펜이 앞, 우대조건 "고객사 상주 가능자"는 그 뒤', () => {
    const posting = getPosting('K-MOCK-0001') as Posting
    const all = quotesInOrder(posting, getAnalysis('K-MOCK-0001'), POSTING_FIELD_ORDER)
    const job = posting.jobCont
    const inJob = all.filter((q) => job.includes(q))
    expect(inJob.map((q) => job.indexOf(q))).toEqual([...inJob.map((q) => job.indexOf(q))].sort((a, b) => a - b))
    expect(all.indexOf('고객사 상주 가능자')).toBeGreaterThan(all.indexOf('기타 업무 지원'))
    expect(all.slice(0, inJob.length)).toEqual(inJob)
  })

  it('분석이 없으면 빈 목록', () => {
    expect(quotesInOrder(getPosting('K-MOCK-0001') as Posting, undefined, POSTING_FIELD_ORDER, 4)).toEqual([])
    expect(loadingQuotes(getPosting('K-MOCK-0001') as Posting, undefined, POSTING_FIELD_ORDER)).toEqual([])
  })

  // A3-r1-16(D-245 보완): 고르기는 "AI 분석 요약"의 먼저 볼 곳 먼저, 보여 주는 순서는 문서 순서 그대로
  it('A3-r1-16 로딩 인용: 최대 4개, 먼저 볼 곳 인용을 모두 담고, 문서 순서 그대로', () => {
    for (const posting of POSTINGS) {
      const analysis = getAnalysis(posting.wantedAuthNo)
      const all = quotesInOrder(posting, analysis, POSTING_FIELD_ORDER)
      const shown = loadingQuotes(posting, analysis, POSTING_FIELD_ORDER, 4)
      const id = posting.wantedAuthNo
      expect(shown.length, id).toBe(Math.min(4, all.length))
      const at = shown.map((q) => all.indexOf(q))
      expect(at.every((i) => i >= 0), `${id} 모두 그 공고 형광펜`).toBe(true)
      expect(at, `${id} 문서 순서`).toEqual([...at].sort((a, b) => a - b))
      const looks = firstLooks(checkPoints(analysis), (cardId) => {
        const q = all.find((x) => marksOf(analysis).some((m) => m.cardId === cardId && m.quote === x))
        return q ? { key: q, quote: q } : undefined
      })
      for (const l of looks) expect(shown, `${id} 먼저 볼 곳 "${l.quote}"`).toContain(l.quote)
    }
  })

  it('A3-r1-16 (주)OO소프트: 먼저 볼 곳이자 ③ 1번 근거인 "고객사 상주 가능자"가 로딩에 나오고, 남는 자리는 문서 순서', () => {
    const posting = getPosting('K-MOCK-0001') as Posting
    const analysis = getAnalysis('K-MOCK-0001')
    const all = quotesInOrder(posting, analysis, POSTING_FIELD_ORDER)
    const shown = loadingQuotes(posting, analysis, POSTING_FIELD_ORDER, 4)
    expect(all.slice(0, 4)).not.toContain('고객사 상주 가능자')
    expect(shown).toContain('고객사 상주 가능자')
    expect(shown).toContain('기타 업무 지원')
    expect(shown[shown.length - 1]).toBe('고객사 상주 가능자')
    // 먼저 볼 곳 둘을 뺀 나머지는 문서 순서 앞에서부터
    const rest = shown.filter((q) => q !== '고객사 상주 가능자' && q !== '기타 업무 지원')
    expect(rest).toEqual(all.filter((q) => q !== '고객사 상주 가능자' && q !== '기타 업무 지원').slice(0, rest.length))
  })
})
