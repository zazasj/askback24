import { describe, expect, it } from 'vitest'
import { PRESETS } from './catalog'
import type { FirstQuestionsRequest, Question } from './contract'
import { GenerateError, generateFirst, type GenerateReport } from './generate'
import { createMockProvider, experienceSentence } from './providers/mock'
import { createEnnoiaProvider } from './providers/ennoia'
import type { Draft, FirstDraftInput, LlmProvider } from './providers/types'
import { pickTop5 } from './rules'
import { getAnalysis } from './catalog'

const OO = 'K-MOCK-0001'
const COMMERCE = 'K-MOCK-0002'
const reqA = (wantedAuthNo = OO): FirstQuestionsRequest => ({
  mode: 'first',
  wantedAuthNo,
  picks: PRESETS.A.picks,
  experience: PRESETS.A.experience,
})

const ORDER_A_OO = ['BE15', 'BE07', 'BE02', 'BE03', 'BE01']

function provider(write: (input: FirstDraftInput, signal: AbortSignal) => Promise<Draft[]>): LlmProvider {
  return { name: 'test', writeFirst: write }
}

function expectQuestionShape(q: Question) {
  expect(typeof q.text).toBe('string')
  expect(q.text.length).toBeGreaterThan(0)
  expect(typeof q.basis).toBe('string')
  expect(typeof q.watch_out).toBe('string')
  expect(typeof q.good_sign).toBe('string')
  expect(typeof q.has_exp).toBe('boolean')
  expect(['ai', 'template']).toContain(q.source)
}

describe('API-04 가짜 공급자 → 응답 형식 그대로', () => {
  it('API-04 mode·질문 5개·순위·유형이 규칙(pickTop5)과 같고 모두 source: ai', async () => {
    const res = await generateFirst(reqA(), { provider: createMockProvider() })
    expect(res.mode).toBe('first')
    expect(typeof res.elapsed_ms).toBe('number')
    expect(res.questions.map((q) => q.card_id)).toEqual(ORDER_A_OO)
    expect(res.questions.map((q) => q.rank)).toEqual([1, 2, 3, 4, 5])
    expect(res.questions.map((q) => q.type)).toEqual(['conflict', 'conflict', 'opportunity', 'opportunity', 'depth'])
    for (const q of res.questions) {
      expectQuestionShape(q)
      expect(q.source).toBe('ai')
    }
  })

  it('S4-13 1번은 "상주", 5번만 경험 포함이고 "FastAPI"', async () => {
    const res = await generateFirst(reqA(), { provider: createMockProvider() })
    expect(res.questions[0]?.text).toContain('상주')
    expect(res.questions[4]?.has_exp).toBe(true)
    expect(res.questions[4]?.text).toContain('FastAPI')
    expect(res.questions.slice(0, 4).every((q) => !q.has_exp && !q.text.includes('FastAPI'))).toBe(true)
  })

  it('가짜 공급자 문장은 검수 문장과 다르다(AI가 쓴 듯한 문장), variant 마다 앞말이 바뀐다', async () => {
    const top = pickTop5(PRESETS.A, getAnalysis(OO)!)
    const v0 = await generateFirst(reqA(), { provider: createMockProvider({ variant: 0 }) })
    const v1 = await generateFirst(reqA(), { provider: createMockProvider({ variant: 1 }) })
    v0.questions.forEach((q, i) => expect(q.text).not.toBe(top[i]?.template_text))
    expect(v0.questions.map((q) => q.text)).not.toEqual(v1.questions.map((q) => q.text))
  })

  it('S4-16 (주)△△커머스: 상주 질문은 충돌 예방이고 "공고에 고객사 상주" 전제가 없다', async () => {
    for (const variant of [0, 1, 2]) {
      const res = await generateFirst(reqA(COMMERCE), { provider: createMockProvider({ variant }) })
      expect(res.questions.every((q) => q.source === 'ai')).toBe(true)
      for (const q of res.questions) expect(q.text).not.toMatch(/공고에\s*고객사\s*상주/)
      const onsite = res.questions.filter((q) => q.text.includes('상주'))
      expect(onsite.map((q) => [q.card_id, q.type])).toEqual([['BE15', 'prevent']])
    }
  })

  it('근거 인용·주의할 답·좋은 신호·근거 설명을 규칙 결과에서 그대로 싣는다', async () => {
    const res = await generateFirst(reqA(), { provider: createMockProvider() })
    expect(res.questions[0]?.evidence).toEqual({ field: 'pfCond', quote: '고객사 상주 가능자' })
    expect(res.questions[0]?.watch_out).toContain('상주 비중이 절반 이상')
    expect(res.questions[2]?.evidence).toBeUndefined()
    expect(res.questions[2]?.basis).toContain('근거가 없어')
  })
})

describe('API-04 공급자 예외·시간 초과 → 검수 문장(source: template)', () => {
  it('API-04 공급자가 예외를 던지면 질문 5개 모두 검수 문장, 순서는 같다', async () => {
    const reports: GenerateReport[] = []
    const res = await generateFirst(reqA(), { provider: createMockProvider({ fail: true }), onReport: (r) => reports.push(r) })
    const top = pickTop5(PRESETS.A, getAnalysis(OO)!)
    expect(res.questions.map((q) => q.card_id)).toEqual(ORDER_A_OO)
    expect(res.questions.every((q) => q.source === 'template')).toBe(true)
    expect(res.questions.map((q) => q.text)).toEqual(top.map((t) => t.template_text))
    expect(reports[0]).toMatchObject({ failure: 'error', template: 5, questions: 5 })
  })

  it('API-04 공급자가 시간 안에 답하지 않으면 검수 문장, 공급자에게 중단 신호를 보낸다', async () => {
    let aborted = false
    const slow = provider(
      (_input, signal) =>
        new Promise<Draft[]>(() => {
          signal.addEventListener('abort', () => {
            aborted = true
          })
        }),
    )
    const reports: GenerateReport[] = []
    const res = await generateFirst(reqA(), { provider: slow, timeoutMs: 30, onReport: (r) => reports.push(r) })
    expect(res.questions).toHaveLength(5)
    expect(res.questions.every((q) => q.source === 'template')).toBe(true)
    expect(reports[0]?.failure).toBe('timeout')
    expect(aborted).toBe(true)
  })

  it('가짜 공급자의 지연이 시간 초과보다 길면 검수 문장', async () => {
    const res = await generateFirst(reqA(), { provider: createMockProvider({ delayMs: 200 }), timeoutMs: 20 })
    expect(res.questions.every((q) => q.source === 'template')).toBe(true)
  })

  it('엔노이아 자리는 아직 부르면 예외 → 검수 문장', async () => {
    const res = await generateFirst(reqA(), { provider: createEnnoiaProvider({ key: 'test-key-123', endpoint: 'https://example.com' }) })
    expect(res.questions.every((q) => q.source === 'template')).toBe(true)
  })

  it('공급자가 없으면(화면의 대체 결과) 검수 문장', async () => {
    const res = await generateFirst(reqA())
    expect(res.questions.every((q) => q.source === 'template')).toBe(true)
    expect(res.questions[4]?.has_exp).toBe(true)
  })
})

describe('API-04 일부만 검사 탈락 → 그 질문만 대체', () => {
  async function withBroken(change: (d: Draft) => Draft | null) {
    const mock = createMockProvider()
    const broken = provider(async (input, signal) => {
      const drafts = await mock.writeFirst(input, signal)
      return drafts.map((d) => (d.card_id === 'BE02' ? change(d) : d)).filter((d): d is Draft => d !== null)
    })
    const reports: GenerateReport[] = []
    const res = await generateFirst(reqA(), { provider: broken, onReport: (r) => reports.push(r) })
    return { res, report: reports[0] }
  }

  it('API-04 absent 카드(BE02)에 "공고에 … 있던데" → BE02만 검수 문장', async () => {
    const { res, report } = await withBroken((d) => ({ ...d, text: '공고에 설계 업무가 있던데, 신입도 설계 리뷰에 들어가나요?' }))
    expect(res.questions.map((q) => q.source)).toEqual(['ai', 'ai', 'template', 'ai', 'ai'])
    expect(res.questions[2]?.text).toBe('설계 회의나 설계 리뷰에 신입도 참여하나요? 참여한다면 어떤 역할을 맡게 되나요?')
    expect(report?.issues).toEqual(['absent_presupposition'])
    expect(report?.template).toBe(1)
  })

  it('근거 인용을 지어내면 그 질문만 대체', async () => {
    const { res } = await withBroken((d) => ({ ...d, evidence: { field: 'jobCont', quote: '설계 리뷰 참여' } }))
    expect(res.questions.map((q) => q.source)).toEqual(['ai', 'ai', 'template', 'ai', 'ai'])
    expect(res.questions[2]?.evidence).toBeUndefined()
  })

  it('금지어가 든 문장, 빠진 문장도 그 질문만 대체', async () => {
    const forbidden = await withBroken((d) => ({ ...d, text: '팀원분들 나이대는 어떻게 되고, 설계 리뷰에는 신입도 들어가나요?' }))
    expect(forbidden.res.questions[2]?.source).toBe('template')
    const missing = await withBroken(() => null)
    expect(missing.res.questions.map((q) => q.source)).toEqual(['ai', 'ai', 'template', 'ai', 'ai'])
  })
})

describe('요청 정리', () => {
  it('없는 공고는 GenerateError(unknown_posting)', async () => {
    await expect(generateFirst({ ...reqA(), wantedAuthNo: 'K-NOPE' })).rejects.toBeInstanceOf(GenerateError)
  })

  it('고른 카드가 없으면 빈 결과', async () => {
    const res = await generateFirst({ mode: 'first', wantedAuthNo: OO, picks: [] }, { provider: createMockProvider() })
    expect(res.questions).toEqual([])
  })

  it('같은 카드 두 번·모르는 카드는 뺀다', async () => {
    const res = await generateFirst({
      mode: 'first',
      wantedAuthNo: OO,
      picks: [
        { card_id: 'BE15', pref: 'avoid', has_exp: false },
        { card_id: 'BE15', pref: 'want', has_exp: false },
        { card_id: 'ZZ99', pref: 'avoid', has_exp: false },
      ],
    })
    expect(res.questions.map((q) => [q.card_id, q.type])).toEqual([['BE15', 'conflict']])
  })

  it('경험 한 줄은 100자로 자르고, 공급자에게는 경험을 붙일 질문이 있을 때만 넘긴다', async () => {
    const seen: string[] = []
    const spy = provider(async (input) => {
      seen.push(input.experience)
      return []
    })
    await generateFirst({ ...reqA(), experience: '가'.repeat(150) }, { provider: spy })
    expect(seen[0]).toHaveLength(100)
    await generateFirst({ ...reqA(), picks: PRESETS.A.picks.map((p) => ({ ...p, has_exp: false })) }, { provider: spy })
    expect(seen[1]).toBe('')
  })
})

describe('가짜 공급자의 경험 문장', () => {
  it('과거·있다 + "는데"는 맺는 문장으로 바꾼다', () => {
    expect(experienceSentence('인턴 때 FastAPI로 API를 설계부터 배포까지 맡아 봤는데')).toBe('인턴 때 FastAPI로 API를 설계부터 배포까지 맡아 봤어요.')
    expect(experienceSentence('졸업 프로젝트에서 DB를 직접 설계했는데,')).toBe('졸업 프로젝트에서 DB를 직접 설계했어요.')
    expect(experienceSentence('운영 서버 장애를 겪은 적이 있는데')).toBe('운영 서버 장애를 겪은 적이 있어요.')
  })

  it('이미 맺은 문장("…경험이 있습니다.", "…봤어요")은 그대로 맺는다(이력서 경험 칩)', () => {
    expect(experienceSentence('직업훈련 팀 프로젝트에서 FastAPI로 API를 설계부터 배포까지 맡아 본 경험이 있습니다.')).toBe(
      '직업훈련 팀 프로젝트에서 FastAPI로 API를 설계부터 배포까지 맡아 본 경험이 있습니다.',
    )
    expect(experienceSentence('졸업 프로젝트에서 DB 설계를 맡아 봤어요')).toBe('졸업 프로젝트에서 DB 설계를 맡아 봤어요.')
  })

  it('확실히 바꿀 수 없는 끝말은 null(검수 틀의 {anchor} 그대로)', () => {
    expect(experienceSentence('전공이 컴퓨터공학인데')).toBeNull()
    expect(experienceSentence('지금 사이드 프로젝트를 하는데')).toBeNull()
    expect(experienceSentence('FastAPI 경험')).toBeNull()
  })

  it('A2-06 "…다"·"…요"·"…봄"으로 끝난 경험도 문법에 맞는 문장, 검사 통과(source ai), "경험 포함" 그대로', async () => {
    const cases: Array<[string, string]> = [
      ['카페 아르바이트를 2년 했습니다', '카페 아르바이트를 2년 했습니다. '],
      ['학교에서 팀 프로젝트를 했어요', '학교에서 팀 프로젝트를 했어요. '],
      ['Spring으로 게시판 만들어 봄', '제 경험과 이어지는 일이라 여쭤요. 이 팀에서는'],
    ]
    for (const [exp, start] of cases) {
      for (const variant of [0, 1]) {
        const res = await generateFirst({ ...reqA(), experience: exp }, { provider: createMockProvider({ variant }) })
        const q = res.questions[4]
        expect(q?.has_exp, exp).toBe(true)
        expect(q?.source, `${exp}: 검사 통과`).toBe('ai')
        expect(q?.text.startsWith(start), `${exp} → ${q?.text}`).toBe(true)
        expect(q?.text, exp).not.toMatch(/(?:다|요|봄), /)
        expect(res.questions.map((x) => x.card_id)).toEqual(ORDER_A_OO)
      }
    }
  })

  it('바꿀 수 없는 경험이면 경험 질문은 검수 문장과 같은 글로 쓴다', async () => {
    const res = await generateFirst({ ...reqA(), experience: '전공이 컴퓨터공학인데' }, { provider: createMockProvider() })
    expect(res.questions[4]?.text.startsWith('전공이 컴퓨터공학인데, ')).toBe(true)
    expect(res.questions[4]?.source).toBe('ai')
  })
})
