/** 평가 실행(②③) 도우미: 서버·LLM 없이 가짜 공급자와 가짜 프로세스로만 시험한다. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ANALYSES, PRESETS, POSTINGS } from '../shared/catalog.ts'
import { generateFirst } from '../shared/generate.ts'
import { createMockProvider } from '../shared/providers/mock.ts'
import type { FinalDraftInput, FirstDraftInput, LlmProvider } from '../shared/providers/types.ts'
import { buildCases, loadEvalData, readGoldJudgements, recordingProvider, runCase, runJudgements, syntheticReview, withServer, writeJsonl } from './evalQuestions.ts'

const OO = 'K-MOCK-0001'

describe('buildCases', () => {
  it('공고 × [A, B], 공고 순서대로', () => {
    const cases = buildCases(['E1', 'E2'])
    expect(cases).toHaveLength(4)
    expect(cases[1]).toEqual({ wantedAuthNo: 'E1', persona: 'B' })
    expect(cases[2]).toEqual({ wantedAuthNo: 'E2', persona: 'A' })
  })
})

describe('syntheticReview', () => {
  it('질문 5개 → asked 2 · not_asked 3', async () => {
    const first = await generateFirst({ mode: 'first', wantedAuthNo: OO, picks: PRESETS.A.picks, experience: PRESETS.A.experience })
    const r = syntheticReview(first)
    expect(r.asked.map((a) => a.question_id)).toEqual(['q1', 'q2'])
    expect(r.asked.every((a) => a.heard === '' && a.clarity === 'clear')).toBe(true)
    expect(r.not_asked.map((n) => n.question_id)).toEqual(['q3', 'q4', 'q5'])
    expect(r.not_asked.every((n) => n.reason === 'no_time')).toBe(true)
    expect(r.received).toEqual([])
    expect(r.impression).toEqual({ mood: 'normal' })
  })
})

describe('recordingProvider', () => {
  it('writeFirst 뒤 sink.first.items 5개, final은 아직 비어 있다', async () => {
    const sink: { first?: FirstDraftInput; final?: FinalDraftInput } = {}
    const provider = recordingProvider(createMockProvider(), sink)
    await generateFirst({ mode: 'first', wantedAuthNo: OO, picks: PRESETS.A.picks }, { provider })
    expect(sink.first?.items.length).toBe(5)
    expect(sink.final).toBeUndefined()
  })
})

const lookup = {
  posting: (id: string) => POSTINGS.find((p) => p.wantedAuthNo === id),
  analysis: (id: string) => ANALYSES.find((a) => a.wantedAuthNo === id),
}

describe('runCase', () => {
  it('가짜 공급자로 1차·최종을 돌려 CaseRow를 만든다', async () => {
    const row = await runCase({ wantedAuthNo: OO, persona: 'A' }, { provider: createMockProvider(), lookup, presets: PRESETS })
    expect(Object.keys(row).sort()).toEqual(['final', 'final_input', 'final_ms', 'first', 'first_input', 'first_ms', 'persona', 'wantedAuthNo'])
    expect(row.first.questions).toHaveLength(5)
    expect(row.first_input?.items).toHaveLength(5)
    expect(row.final.final_questions.length).toBeGreaterThan(0)
    expect(row.final_input?.items.length).toBeGreaterThan(0)
    expect(typeof row.first_ms).toBe('number')
  })
})

describe('runJudgements', () => {
  const gold = [
    { wantedAuthNo: OO, card_id: 'BE07', question: 'q', heard: '격주로 상주합니다', pref: 'avoid' as const, expected: 'mismatch' },
    { wantedAuthNo: OO, card_id: 'BE02', question: 'q', heard: '재택 가능합니다', pref: 'want' as const, expected: 'confirmed' },
  ]
  it('정답 줄마다 판정을 부르고, 빠진 판정은 got: null', async () => {
    const provider: LlmProvider = {
      name: 't',
      writeFirst: async () => [],
      judgeReview: async (input) => (input.items[0]!.card_id === 'BE07' ? [{ card_id: 'BE07', state: 'mismatch', basis: '근거' }] : []),
    }
    const out = await runJudgements(gold, { provider, lookup })
    expect(out).toEqual([
      { wantedAuthNo: OO, card_id: 'BE07', expected: 'mismatch', got: 'mismatch' },
      { wantedAuthNo: OO, card_id: 'BE02', expected: 'confirmed', got: null },
    ])
  })
  it('호출이 던져도 got: null로 세고 계속한다', async () => {
    const provider: LlmProvider = {
      name: 't',
      writeFirst: async () => [],
      judgeReview: async () => {
        throw new Error('boom')
      },
    }
    const out = await runJudgements(gold, { provider, lookup })
    expect(out.map((r) => r.got)).toEqual([null, null])
  })
})

function fakeProc() {
  let done!: () => void
  const exited = new Promise<void>((r) => (done = r))
  const kill = vi.fn((sig?: string) => {
    if (sig === 'SIGTERM') done()
  })
  return { kill, exited }
}

describe('withServer', () => {
  it('withServer kills on throw', async () => {
    const proc = fakeProc()
    await expect(
      withServer(
        () => proc,
        async () => true,
        async () => {
          throw new Error('body failed')
        },
      ),
    ).rejects.toThrow('body failed')
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('정상 종료에도 끄고 결과를 돌려준다', async () => {
    const proc = fakeProc()
    await expect(
      withServer(
        () => proc,
        async () => true,
        async () => 7,
      ),
    ).resolves.toBe(7)
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('준비가 안 되면 오류, 그래도 끈다', async () => {
    const proc = fakeProc()
    const body = vi.fn(async () => 1)
    await expect(withServer(() => proc, async () => false, body, 30)).rejects.toThrow()
    expect(body).not.toHaveBeenCalled()
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('SIGTERM에 안 끝나면 5초 뒤 SIGKILL', async () => {
    vi.useFakeTimers()
    try {
      let done!: () => void
      const exited = new Promise<void>((r) => (done = r))
      const kill = vi.fn((sig?: string) => {
        if (sig === 'SIGKILL') done()
      })
      const p = withServer(
        () => ({ kill, exited }),
        async () => true,
        async () => 1,
      )
      await vi.advanceTimersByTimeAsync(5001)
      await expect(p).resolves.toBe(1)
      expect(kill.mock.calls.map((c) => c[0])).toEqual(['SIGTERM', 'SIGKILL'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('시작 함수가 던지면 그대로 던진다(끌 것이 없다)', async () => {
    await expect(
      withServer(
        () => {
          throw new Error('spawn failed')
        },
        async () => true,
        async () => 1,
      ),
    ).rejects.toThrow('spawn failed')
  })
})

describe('파일 읽기·쓰기', () => {
  it('공고는 파일 이름 순서, 분석이 없는 공고는 건너뛴다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'evalq-'))
    try {
      mkdirSync(join(dir, 'postings'))
      mkdirSync(join(dir, 'run', 'analysis'), { recursive: true })
      const posting = (id: string) => JSON.stringify({ ...POSTINGS[0]!, wantedAuthNo: id })
      writeFileSync(join(dir, 'postings', 'b.json'), posting('E2'))
      writeFileSync(join(dir, 'postings', 'a.json'), posting('E1'))
      writeFileSync(join(dir, 'postings', 'c.json'), posting('E3'))
      for (const id of ['E1', 'E2']) writeFileSync(join(dir, 'run', 'analysis', `${id}.json`), JSON.stringify({ ...ANALYSES[0]!, wantedAuthNo: id }))
      const data = loadEvalData(join(dir, 'postings'), join(dir, 'run'))
      expect(data.ids).toEqual(['E1', 'E2'])
      expect(data.skipped).toBe(1)
      expect(data.lookup.analysis('E2')?.wantedAuthNo).toBe('E2')
      expect(data.lookup.posting('E3')).toBeUndefined()

      writeJsonl(join(dir, 'out.jsonl'), [{ a: 1 }, { a: 2 }])
      expect(readFileSync(join(dir, 'out.jsonl'), 'utf8')).toBe('{"a":1}\n{"a":2}\n')
      expect(readGoldJudgements(join(dir, 'none.json'))).toBeNull()
      writeFileSync(join(dir, 'gold.json'), JSON.stringify({ judgements: [{ wantedAuthNo: 'E1' }] }))
      expect(readGoldJudgements(join(dir, 'gold.json'))).toHaveLength(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
