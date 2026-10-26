/** 정적 데이터 점검: 형광펜이 안 칠해지는 근거(= 근거 없는 전제) 0건, 가상 인물 정보만. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ANALYSES, CARDS, CARD_BOOK, FINAL_BOOK, POSTINGS, PRESETS, getCard, getPosting, getSignals } from './catalog'
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
    for (const c of CARDS) {
      const all = { ...c.questions, ...Object.fromEntries(Object.entries(c.questions_explicit ?? {}).map(([t, v]) => [`explicit.${t}`, v])), example: c.example_question ?? '' }
      for (const [t, text] of Object.entries(all)) expect(text, `${c.id}.${t}`).not.toMatch(/공고/)
    }
  })

  it('H2-02 (나) 공고에 적힌 업무용 틀은 있는지가 아니라 나눔·비중을 묻는다(◎◎헬스케어 화면 개발 겸업 포함)', () => {
    const be13 = getCard('BE13')!
    expect(be13.questions_explicit?.conflict).toMatch(/비중|나뉘|나눠/)
    expect(be13.questions_explicit?.conflict).not.toMatch(/별도 담당이 있나요/)
    for (const c of CARDS) for (const [t, text] of Object.entries(c.questions_explicit ?? {})) expect(text, `${c.id}.${t}`).not.toMatch(/있나요\?$/)
  })

  it('H1-13 카드마다 최종 "다시 확인"에서 쓸 구체적인 예 질문이 있다', () => {
    for (const c of CARDS) expect(c.example_question, c.id).toMatch(/예를 들어|예로|예가 있다면/)
    expect(getCard('BE15')?.example_question).toMatch(/상주/)
    expect(getCard('BE15')?.example_question).toMatch(/기간/)
  })

  it('H2-14 ② 고객사 상주 틀에 공고에 없는 법적 용어 "파견"을 쓰지 않는다', () => {
    for (const [t, text] of Object.entries(getCard('BE15')!.questions)) expect(text, t).not.toContain('파견')
    expect(getCard('BE15')?.questions.conflict).toContain('상주')
  })

  it('유형 라벨 5종', () => {
    expect(Object.values(CARD_BOOK.type_labels)).toEqual(['차이 확인', '기회 확인', '깊이 확인', '미리 확인', '탐색'])
  })

  it('유형마다 뜻 한 줄(1차·최종): 해요체, 1차 뜻에는 처우 말이 없고 회사를 평가하는 말이 없다', () => {
    const books = [
      { labels: CARD_BOOK.type_labels, notes: CARD_BOOK.type_descriptions, first: true },
      { labels: FINAL_BOOK.type_labels, notes: FINAL_BOOK.type_descriptions, first: false },
    ]
    for (const { labels, notes, first } of books) {
      expect(Object.keys(notes).sort()).toEqual(Object.keys(labels).sort())
      for (const [type, note] of Object.entries(notes)) {
        expect(note, type).toMatch(/요$/)
        expect(note, type).not.toMatch(/아까|하셨는데|말씀하신|나쁜|위험|블랙/)
        if (first) expect(note, type).not.toMatch(/연봉|수당|처우/)
      }
    }
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

  it('업종에서 유추한 신호는 업종 일반 이야기로만 말하고, 공고에 없는 "24시간"을 그 회사 사실처럼 말하지 않는다(A2-05)', () => {
    let seen = 0
    for (const p of POSTINGS) {
      const postingText = Object.values(p).filter((v) => typeof v === 'string').join('\n')
      for (const s of getSignals(p.wantedAuthNo).filter((x) => x.source_name === '업종 정보에서 유추')) {
        seen++
        expect(s.text, p.wantedAuthNo).toMatch(/업종은/)
        if (!postingText.includes('24시간')) expect(s.text, p.wantedAuthNo).not.toContain('24시간')
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('임금체불 신호는 "명단공개 대상"에 없다는 말로만 쓰고 체불이 없다고 읽히는 "명단에 없어요"는 쓰지 않는다(A2-04)', () => {
    const unpaid = POSTINGS.flatMap((p) => getSignals(p.wantedAuthNo)).filter((s) => s.source_name === '임금체불 사업주 명단')
    expect(unpaid.length).toBeGreaterThan(0)
    for (const s of unpaid) {
      expect(s.text).toBe('임금체불 명단공개 대상에는 올라 있지 않아요')
      expect(s.source).toBe('모의')
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

  it('분석 설명은 어디에 적혔는지만 말하지 않는다("…에 \'…\'가 적혀 있어요"만 있는 설명 0건), 해요체, 회사를 평가하는 말이 없다', () => {
    const LOCATION_ONLY = /^[^']*에 '[^']+'(?:이|가) 적혀 있어요\.?$/
    for (const a of ANALYSES) {
      for (const c of a.cards) {
        const where = `${a.wantedAuthNo} ${c.card_id}: ${c.reason}`
        expect(c.reason, where).not.toMatch(LOCATION_ONLY)
        expect(c.reason, where).toMatch(/요(?:\([^)]*\))?\.?$/)
        expect(c.reason, where).not.toMatch(/팀이 작|나쁜|위험|블랙|악덕/)
      }
    }
  })

  it('H2-07 ② 분석 설명은 "…를 유추했어요"처럼 과정만 말하지 않고 확인해 볼 이유를 말한다', () => {
    for (const a of ANALYSES) for (const c of a.cards) expect(c.reason, `${a.wantedAuthNo} ${c.card_id}`).not.toMatch(/유추했어요$/)
  })

  it('H2-02 (가) (주)△△커머스 분석에 "혼자 맡는 백엔드"(BE17) 연결이 없다("백엔드 개발자 2명"은 혼자가 아님)', () => {
    expect(ANALYSES.find((a) => a.wantedAuthNo === 'K-MOCK-0002')?.cards.map((c) => c.card_id)).not.toContain('BE17')
  })

  it('H1-11 (주)◁◁로지스 고객사 상주는 근거(물류센터 현장 지원)에 맞춘 질문 틀, (주)☆☆페이 보안은 "전자금융 관련 보안 지식 보유자" 근거', () => {
    const logis = ANALYSES.find((a) => a.wantedAuthNo === 'K-MOCK-0007')!
    const be15 = logis.cards.find((c) => c.card_id === 'BE15')!
    expect(be15.questions?.conflict).toContain('물류센터 현장 지원')
    expect(be15.questions?.conflict).not.toMatch(/상주|파견/)
    expect(logis.cards.find((c) => c.card_id === 'BE08')?.reason).toContain('주말 근무에 시스템 대응도 들어가는지 확인해 볼 만해요')
    const pay = ANALYSES.find((a) => a.wantedAuthNo === 'K-MOCK-0004')!
    expect(pay.cards.find((c) => c.card_id === 'BE16')?.evidence?.quote).toBe('전자금융 관련 보안 지식 보유자')
  })

  it('H2-09 임금을 숫자 범위로 적은 공고는 "모호한 표현"이 아니라 "확인 필요"', () => {
    for (const a of ANALYSES) {
      const sal = getPosting(a.wantedAuthNo)!.sal
      const blank = a.blanks.find((b) => b.topic === 'sal')
      if (/\d/.test(sal)) expect(blank?.status, a.wantedAuthNo).toBe('check')
    }
  })

  it('H2-10 ① 근무 시간이 공고에 없으면 처우 질문이 바쁜 시기·연장근로를 전제하지 않고 출퇴근·주 근로시간부터 묻는다', () => {
    for (const a of ANALYSES) {
      const b = a.blanks.find((x) => x.topic === 'workHours' && x.status === 'missing')
      if (!b) continue
      expect(b.question, a.wantedAuthNo).toMatch(/^근무 시간이 공고에 적혀 있지 않은데/)
      expect(b.question, a.wantedAuthNo).toContain('출퇴근 시간과 주 근로시간')
      expect(b.question, a.wantedAuthNo).not.toMatch(/바쁜 시기|마감 전/)
    }
  })

  it('H1-04 회사 참고 정보마다 돌려 묻는 질문 한 줄, 국민연금 줄에는 기준 시점과 해석 한계', () => {
    for (const p of POSTINGS) {
      for (const sig of getSignals(p.wantedAuthNo)) {
        expect(sig.ask, `${p.wantedAuthNo} ${sig.text}`).toMatch(/\?$/)
        if (sig.source_name === '국민연금 사업장 가입자 현황') {
          expect(sig.caveat).toMatch(/\d{4}년 \d{1,2}월.*기준/)
          expect(sig.caveat).toContain('가입자 수 기준이라 실제와 다를 수 있어요')
        }
      }
    }
  })

  // A3-r2-08: "명단에 없음"이 정부가 "체불 없음"을 확인한 것처럼 읽히지 않게 그 줄 옆에 해석 한계(/about-ai 출처 표와 같은 글)
  it('A3-r2-08 임금체불 줄에는 "명단에 없다고 체불이 없다는 뜻은 아니에요" caveat가 있다', () => {
    const CAVEAT = '명단은 체불로 유죄가 두 번 이상 확정된 일부 사업주만 공개해요. 명단에 없다고 체불이 없다는 뜻은 아니에요'
    const lines = POSTINGS.flatMap((p) => getSignals(p.wantedAuthNo).filter((s) => s.source_name === '임금체불 사업주 명단').map((s) => ({ id: p.wantedAuthNo, s })))
    expect(lines.map((l) => l.id)).toEqual(['K-MOCK-0003', 'K-MOCK-0005'])
    for (const { id, s } of lines) expect(s.caveat, id).toBe(CAVEAT)
    const about = readFileSync(fileURLToPath(new URL('../src/features/about/aboutData.ts', import.meta.url)), 'utf8')
    expect(about, '/about-ai 출처 표와 같은 글').toContain(CAVEAT)
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
