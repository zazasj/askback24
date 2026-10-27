/**
 * POST /api/warmup 처리. 질문 만들기 화면을 열 때 AI 서버(모델)를 미리 깨운다.
 * 결과와 상관없이 204이고 오류는 삼킨다. 오류 내용·키는 기록하지 않는다.
 */
import { REMOTE_PATHS, warmupRemote } from '../../shared/providers/remote.js'
import type { Logger } from './handler.js'
import { remoteConfigFor, type ServerEnv } from './provider.js'

export const WARMUP_TIMEOUT_MS = 20_000

export async function handleWarmup(request: Request, env: ServerEnv, log: Logger = console): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (env.LLM_PROVIDER === 'remote') {
    const started = Date.now()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), WARMUP_TIMEOUT_MS)
    let ok = false
    try {
      ok = await warmupRemote(remoteConfigFor(env), ctrl.signal)
    } catch {
      ok = false
    } finally {
      clearTimeout(timer)
    }
    log.info(`[warmup] ${ok ? 'ok' : 'fail'} ms=${Date.now() - started} path=${REMOTE_PATHS.warmup}`)
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
