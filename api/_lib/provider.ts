/**
 * 서버 환경변수로 공급자를 고른다. 키는 여기서만 받아 공급자에 넘긴다(화면 번들에 들어가지 않는 곳).
 */
import { createEnnoiaProvider } from '../../shared/providers/ennoia.js'
import { createMockProvider } from '../../shared/providers/mock.js'
import type { LlmProvider } from '../../shared/providers/types.js'

export interface ServerEnv {
  LLM_PROVIDER?: string
  ENNOIA_API_KEY?: string
  ENNOIA_ENDPOINT?: string
}

/** 기본은 mock. 모르는 값도 mock 으로(배포 실수로 키 없는 공급자를 부르지 않게) */
export function providerFor(env: ServerEnv): LlmProvider {
  if (env.LLM_PROVIDER === 'ennoia') {
    const config: { key?: string; endpoint?: string } = {}
    if (env.ENNOIA_API_KEY) config.key = env.ENNOIA_API_KEY
    if (env.ENNOIA_ENDPOINT) config.endpoint = env.ENNOIA_ENDPOINT
    return createEnnoiaProvider(config)
  }
  return createMockProvider()
}
