/** AS-03 docs/api-examples/*.json 6개: 지금 코드가 만드는 값과 같고, 응답 예시는 우리 검사를 통과한다. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PRESETS, REVIEW_EXAMPLE } from '../shared/catalog.ts'
import { generateFinal, generateFirst, type GenerateReport } from '../shared/generate.ts'
import { readDrafts, readFinalDrafts, readJudgements } from '../shared/providers/remote.ts'
import type {
  FinalJudgementsAiResponse,
  FinalQuestionsAiResponse,
  FirstDraftInput,
  FinalDraftInput,
  FirstQuestionsAiResponse,
  JudgeInput,
  LlmProvider,
} from '../shared/providers/types.ts'
import { API_EXAMPLE_DIR, API_EXAMPLE_NAMES, EXAMPLE_POSTING, buildApiExamples, exampleText, type ApiExampleName } from './apiExamples.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const fileOf = (name: ApiExampleName) => join(root, API_EXAMPLE_DIR, `${name}.json`)
const read = <T>(name: ApiExampleName): T => JSON.parse(readFileSync(fileOf(name), 'utf8')) as T

describe('AS-03 AI API 예시 JSON(docs/api-examples)', () => {
  it('AS-03 6개가 있고 글자까지 지금 코드가 만드는 값과 같다(다르면 npm run api:examples)', async () => {
    const { files } = await buildApiExamples()
    for (const name of API_EXAMPLE_NAMES) {
      expect(existsSync(fileOf(name)), `${name}.json 이 없다 → npm run api:examples`).toBe(true)
      const text = readFileSync(fileOf(name), 'utf8').replace(/\r\n/g, '\n')
      expect(text, `${name}.json 이 코드와 다르다 → npm run api:examples`).toBe(exampleText(files[name]))
    }
  })

  it('AS-03 예시 A × (주)OO소프트, 최종은 R-04 예시 세트. 최종 문장 요청에는 들은 답이 없다', () => {
    const first = read<FirstDraftInput>('first-request')
    expect(first.mode).toBe('first')
    expect(first.posting.wantedAuthNo).toBe(EXAMPLE_POSTING)
    expect(first.posting.corpNm).toBe('(주)OO소프트')
    expect(first.experience).toBe(PRESETS.A.experience)
    expect(first.items.map((i) => i.card_id)).toEqual(['BE15', 'BE07', 'BE02', 'BE03', 'BE01'])
    expect(first.items.map((i) => i.rank)).toEqual([1, 2, 3, 4, 5])

    const judge = read<JudgeInput>('final-judgements-request')
    expect(judge.mode).toBe('final')
    expect(judge.posting.wantedAuthNo).toBe(EXAMPLE_POSTING)
    expect(judge.items.map((i) => [i.card_id, i.heard, i.clarity])).toEqual(REVIEW_EXAMPLE.asked.map((a) => [a.card_id, a.heard, a.clarity]))

    const final = read<FinalDraftInput>('final-questions-request')
    expect(final.mode).toBe('final')
    expect(final.items.length).toBeGreaterThan(0)
    expect(final.items.length).toBeLessThanOrEqual(8)
    const text = JSON.stringify(final)
    for (const a of REVIEW_EXAMPLE.asked) expect(text, '최종 문장 요청에 들은 답').not.toContain(a.heard)
    expect(final.items.every((i) => !('heard' in i))).toBe(true)
  })

  it('AS-03 응답 예시는 모양 검사와 우리 검사(validate)를 통과한다 — 그대로 돌려주면 모두 source: ai, 판정 4개 모두 받음', async () => {
    const firstRes = read<FirstQuestionsAiResponse>('first-response')
    const judgeRes = read<FinalJudgementsAiResponse>('final-judgements-response')
    const finalRes = read<FinalQuestionsAiResponse>('final-questions-response')
    // 모양 검사(shared/providers/remote.ts)가 버리는 항목이 없다
    expect(readDrafts(firstRes.questions)).toEqual(firstRes.questions)
    expect(readJudgements(judgeRes.judgements)).toEqual(judgeRes.judgements)
    expect(readFinalDrafts(finalRes.questions)).toEqual(finalRes.questions)

    const replay: LlmProvider = {
      name: 'replay',
      writeFirst: async () => firstRes.questions,
      judgeReview: async () => judgeRes.judgements,
      writeFinal: async () => finalRes.questions,
    }
    const reports: GenerateReport[] = []
    const { screen } = await buildApiExamples()
    const first = await generateFirst(screen.first, { provider: replay, onReport: (r) => reports.push(r) })
    expect(first.questions.map((q) => q.source)).toEqual(['ai', 'ai', 'ai', 'ai', 'ai'])
    expect(first.questions.map((q) => q.text)).toEqual(firstRes.questions.map((d) => d.text))

    const final = await generateFinal(screen.final, { provider: replay, onReport: (r) => reports.push(r) })
    expect(final.final_questions.every((q) => q.source === 'ai')).toBe(true)
    expect(final.final_questions.length).toBe(finalRes.questions.length)
    expect(final.summary).toEqual({ confirmed: 2, mismatch: 1, still_unknown: 2, company_signal: 1 })
    expect(reports.map((r) => r.issues)).toEqual([[], []])
    expect(reports[1]?.judged).toBe(judgeRes.judgements.length)
  })

  it('AS-03 README에 다시 만드는 명령(npm run api:examples)이 있다', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8')
    expect(readme).toContain('npm run api:examples')
    expect(readme).toContain('docs/api-examples')
  })
})
