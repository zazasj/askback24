/**
 * 엔노이아(운영사무국 제공 LLM) 공급자 자리. 요청·응답 형식을 아직 받지 못해 부르면 예외를 던지고,
 * shared/generate.ts 가 검수 문장으로 대신한다. 키는 api/ 에서만 받아 넘긴다(화면 번들에 넣지 않음).
 */
import type { Draft, LlmProvider } from './types'

export interface EnnoiaConfig {
  key?: string
  endpoint?: string
}

export function createEnnoiaProvider(config: EnnoiaConfig): LlmProvider {
  const configured = Boolean(config.key && config.endpoint)
  return {
    name: 'ennoia',
    async writeFirst(): Promise<Draft[]> {
      // 형식이 정해지면 여기서 fetch(config.endpoint) 한다. 그 전에는 키가 있어도 부르지 않는다
      throw new Error(configured ? 'not implemented' : 'not configured')
    },
  }
}
