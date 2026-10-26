/**
 * docs/api-examples/*.json 6개를 지금 코드로 만든다(AS-03). 손으로 쓰지 않는다.
 * 화면이 보내는 요청(예시 구직자 A × (주)OO소프트, 최종은 R-04 "1차 면접 다녀온 것으로 채우기")을 화면 코드로 만들어
 * shared/generate 에 넣고, 캡처 공급자가 AI 담당 서버로 갈 본문(요청)과 가짜 공급자 출력(응답)을 받아 둔다.
 * 다시 쓰기: npm run api:examples (scripts/api-examples.ts) · 파일과 비교: scripts/apiExamples.test.ts
 */
import { PRESETS } from '../shared/catalog.ts'
import type { FinalQuestionsRequest, FirstQuestionsRequest } from '../shared/contract.ts'
import { generateFinal, generateFirst } from '../shared/generate.ts'
import { createMockProvider } from '../shared/providers/mock.ts'
import type { LlmProvider } from '../shared/providers/types.ts'
import { fromPreset, toFirstRequest } from '../src/features/interview-prep/picks.ts'
import { exampleDraft, toFinalRequest } from '../src/features/interview-prep/review.ts'

export const API_EXAMPLE_DIR = 'docs/api-examples'
export const API_EXAMPLE_NAMES = [
  'first-request',
  'first-response',
  'final-judgements-request',
  'final-judgements-response',
  'final-questions-request',
  'final-questions-response',
] as const
export type ApiExampleName = (typeof API_EXAMPLE_NAMES)[number]

/** (주)OO소프트 */
export const EXAMPLE_POSTING = 'K-MOCK-0001'
/** 응답 예시의 model 값. 가짜 공급자 출력이라는 표시 */
export const EXAMPLE_MODEL = 'mock'

export interface ApiExamples {
  /** 화면 → 우리 서버 POST /api/questions 본문(부록 A와 같은 값) */
  screen: { first: FirstQuestionsRequest; final: FinalQuestionsRequest }
  files: Record<ApiExampleName, unknown>
}

/** 보내는 그대로(JSON으로 한 번 오간 값 — undefined 키는 빠진다) */
const wire = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function captureProvider(sink: Partial<Record<ApiExampleName, unknown>>): LlmProvider {
  const mock = createMockProvider()
  return {
    name: 'capture',
    async writeFirst(input, signal) {
      sink['first-request'] = wire(input)
      const questions = await mock.writeFirst(input, signal)
      sink['first-response'] = wire({ questions, model: EXAMPLE_MODEL })
      return questions
    },
    async judgeReview(input, signal) {
      if (!mock.judgeReview) throw new Error('mock judgeReview missing')
      sink['final-judgements-request'] = wire(input)
      const judgements = await mock.judgeReview(input, signal)
      sink['final-judgements-response'] = wire({ judgements, model: EXAMPLE_MODEL })
      return judgements
    },
    async writeFinal(input, signal) {
      if (!mock.writeFinal) throw new Error('mock writeFinal missing')
      sink['final-questions-request'] = wire(input)
      const questions = await mock.writeFinal(input, signal)
      sink['final-questions-response'] = wire({ questions, model: EXAMPLE_MODEL })
      return questions
    },
  }
}

export async function buildApiExamples(): Promise<ApiExamples> {
  const sink: Partial<Record<ApiExampleName, unknown>> = {}
  const provider = captureProvider(sink)

  const first = toFirstRequest(EXAMPLE_POSTING, fromPreset(PRESETS.A))
  const firstResult = await generateFirst(first, { provider })
  const final = toFinalRequest(EXAMPLE_POSTING, first.picks, exampleDraft(firstResult.questions), firstResult.questions)
  await generateFinal(final, { provider })

  const files = {} as Record<ApiExampleName, unknown>
  for (const name of API_EXAMPLE_NAMES) {
    if (sink[name] === undefined) throw new Error(`api example not captured: ${name}`)
    files[name] = sink[name]
  }
  return { screen: { first: wire(first), final: wire(final) }, files }
}

/** 파일에 쓰는 글(2칸 들여쓰기 + 끝 줄바꿈) */
export function exampleText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
