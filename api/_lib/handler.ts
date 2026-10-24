/**
 * POST /api/questions 처리. 요청 검사 → shared/generate → 응답.
 * 경험 한 줄·들은 답은 저장·기록하지 않는다. 로그에는 공급자 이름과 개수만 남긴다(API-05).
 */
import { GenerateError, PROVIDER_TIMEOUT_MS, generateFinal, generateFirst, type GenerateReport } from '../../shared/generate.js'
import { providerFor, type ServerEnv } from './provider.js'
import { parseQuestionsRequest } from './request.js'

/** 공고 ID·카드 17개·경험 100자면 2KB 안팎. 넉넉히 잡되 큰 본문은 읽지 않는다 */
export const BODY_MAX = 16_000

export interface Logger {
  info(message: string): void
  error(message: string): void
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export function reportLine(r: GenerateReport): string {
  const parts = [`provider=${r.provider}`, `n=${r.questions}`, `template=${r.template}`, `ms=${r.elapsed_ms}`]
  if (r.judged !== undefined) parts.push(`judged=${r.judged}`)
  if (r.failure) parts.push(`failure=${r.failure}`)
  if (r.issues.length) parts.push(`issues=${[...new Set(r.issues)].join(',')}`)
  return `[questions] mode=${r.mode} ${parts.join(' ')}`
}

export async function handleQuestions(request: Request, env: ServerEnv, log: Logger = console): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const raw = await request.text()
  if (raw.length > BODY_MAX) return json(413, { error: 'body_too_large' })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const parsed = parseQuestionsRequest(body)
  if (!parsed.ok) return json(400, { error: 'invalid_request', field: parsed.error })

  try {
    const options = { provider: providerFor(env), timeoutMs: PROVIDER_TIMEOUT_MS, onReport: (r: GenerateReport) => log.info(reportLine(r)) }
    // 최종: 카드 상태 판정 → 순서 규칙 → 표현 단계 → 검사(shared/generate). 들은 답은 응답·로그에 싣지 않는다
    const res = parsed.value.mode === 'final' ? await generateFinal(parsed.value, options) : await generateFirst(parsed.value, options)
    return json(200, res)
  } catch (e) {
    if (e instanceof GenerateError) return json(404, { error: e.code })
    // 예외 내용에 입력이 섞일 수 있어 종류만 남긴다
    log.error(`[questions] failed ${e instanceof Error ? e.name : 'unknown'}`)
    return json(500, { error: 'internal' })
  }
}
