/**
 * 서버 환경변수로 공급자를 고른다. 키는 여기서만 받아 공급자에 넘긴다(화면 번들에 들어가지 않는 곳).
 */
import { createEnnoiaProvider } from '../../shared/providers/ennoia.js'
import { createMockProvider } from '../../shared/providers/mock.js'
import { createRemoteProvider, type RemoteConfig } from '../../shared/providers/remote.js'
import type { LlmProvider } from '../../shared/providers/types.js'

export interface ServerEnv {
  /** mock(기본) · remote(AI 담당 서버, docs/API-SPEC.md) · ennoia(자리만) */
  LLM_PROVIDER?: string
  /** remote: AI 담당 서버 주소(…/v1/… 앞부분) */
  AI_ENDPOINT?: string
  /** remote: Authorization: Bearer 값 */
  AI_API_KEY?: string
  ENNOIA_API_KEY?: string
  ENNOIA_ENDPOINT?: string
  /** Vercel 이 넣는 배포 환경(production · preview · development). production 이면 AI_API_KEY 가 있어야 부른다 */
  VERCEL_ENV?: string
}

/** 기본은 mock. 모르는 값도 mock 으로(배포 실수로 키 없는 공급자를 부르지 않게) */
export function providerFor(env: ServerEnv): LlmProvider {
  if (env.LLM_PROVIDER === 'remote') {
    // 주소가 없거나 https 가 아니거나 운영인데 키가 없으면 공급자가 부르지 않고 예외 → 모두 검수 문장(generate, A3-r1-08)
    const config: RemoteConfig = { requireKey: env.VERCEL_ENV === 'production' }
    if (env.AI_ENDPOINT) config.endpoint = env.AI_ENDPOINT
    if (env.AI_API_KEY) config.key = env.AI_API_KEY
    return createRemoteProvider(config)
  }
  if (env.LLM_PROVIDER === 'ennoia') {
    const config: { key?: string; endpoint?: string } = {}
    if (env.ENNOIA_API_KEY) config.key = env.ENNOIA_API_KEY
    if (env.ENNOIA_ENDPOINT) config.endpoint = env.ENNOIA_ENDPOINT
    return createEnnoiaProvider(config)
  }
  return createMockProvider()
}
