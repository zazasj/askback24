/**
 * 서버 환경변수로 공급자를 고른다. 키는 여기서만 받아 공급자에 넘긴다(화면 번들에 들어가지 않는 곳).
 */
import { createMockProvider } from '../../shared/providers/mock.js'
import { createRemoteProvider, type RemoteConfig } from '../../shared/providers/remote.js'
import type { Draft, FinalDraft, Judgement, LlmProvider } from '../../shared/providers/types.js'

export interface ServerEnv {
  /** mock(기본) · remote(AI 담당 서버, docs/API-SPEC.md) */
  LLM_PROVIDER?: string
  /** remote: AI 담당 서버 주소(…/v1/… 앞부분) */
  AI_ENDPOINT?: string
  /** remote: Authorization: Bearer 값 */
  AI_API_KEY?: string
  /** Vercel 이 넣는 이 배포의 호스트(https:// 없음). AI_ENDPOINT 가 비면 같은 배포의 /api/ai 를 부른다 */
  VERCEL_URL?: string
  /** 배포 보호가 켜져 있을 때 같은 배포 호출을 통과시키는 값. 로그에 싣지 않는다 */
  VERCEL_AUTOMATION_BYPASS_SECRET?: string
  /** Vercel 이 넣는 배포 환경(production · preview · development). production 이면 AI_API_KEY 가 있어야 부른다 */
  VERCEL_ENV?: string
}

/** 경고 한 줄만 남길 곳. handler 의 Logger 와 모양이 같다 */
export interface WarnLog {
  error(message: string): void
}

export const UNCONFIGURED_WARNING = '[questions] LLM_PROVIDER가 remote가 아니라 검수 문장으로 냄'

/** 실제 빌드(Vercel preview·production)에서 remote 가 아닐 때: 늘 예외 → generate 가 모두 검수 문장(최종 판정은 단순 규칙) */
function createUnconfiguredProvider(): LlmProvider {
  const fail = () => new Error('not configured')
  return {
    name: 'unconfigured',
    async writeFirst(): Promise<Draft[]> {
      throw fail()
    },
    async judgeReview(): Promise<Judgement[]> {
      throw fail()
    },
    async writeFinal(): Promise<FinalDraft[]> {
      throw fail()
    },
  }
}

// 로그 하나(함수 인스턴스의 console)마다 한 번만 경고한다. 요청 내용은 싣지 않는다
const warned = new WeakSet<object>()

const DEPLOYED: ReadonlySet<string> = new Set(['production', 'preview'])

/** remote 공급자 설정. AI_ENDPOINT → 같은 배포(VERCEL_URL)의 /api/ai 순으로 주소를 고른다 */
export function remoteConfigFor(env: ServerEnv): RemoteConfig {
  const config: RemoteConfig = { requireKey: env.VERCEL_ENV === 'production' }
  if (env.AI_ENDPOINT) config.endpoint = env.AI_ENDPOINT
  else if (env.VERCEL_URL) config.endpoint = `https://${env.VERCEL_URL}/api/ai`
  if (env.AI_API_KEY) config.key = env.AI_API_KEY
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) config.bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET
  return config
}

/**
 * 기본은 mock. 로컬·단위 시험(VERCEL_ENV 없음·development)은 모르는 값도 mock(D-044).
 * Vercel preview·production 은 remote 만 부르고, 빠짐·오타·mock 등은 unconfigured — 가짜 문장이 실제 빌드에서
 * source "ai" 로 나가지 않게(A3-r2-01, D-146).
 */
export function providerFor(env: ServerEnv, log?: WarnLog): LlmProvider {
  if (env.LLM_PROVIDER === 'remote') {
    // 주소가 없거나 https 가 아니거나 운영인데 키가 없으면 공급자가 부르지 않고 예외 → 모두 검수 문장(generate, A3-r1-08)
    return createRemoteProvider(remoteConfigFor(env))
  }
  if (env.VERCEL_ENV && DEPLOYED.has(env.VERCEL_ENV)) {
    if (log && !warned.has(log)) {
      warned.add(log)
      log.error(UNCONFIGURED_WARNING)
    }
    return createUnconfiguredProvider()
  }
  return createMockProvider()
}
