/**
 * 엔노이아(운영사무국 제공 LLM) 공급자 자리. 요청·응답 형식을 아직 받지 못해 부르면 예외를 던지고,
 * shared/generate.ts 가 검수 문장(최종 면접은 단순 규칙 판정)으로 대신한다. 키는 api/ 에서만 받아 넘긴다(화면 번들에 넣지 않음).
 */
import type { Draft, FinalDraft, Judgement, LlmProvider } from './types'

export interface EnnoiaConfig {
  key?: string
  endpoint?: string
}

export function createEnnoiaProvider(config: EnnoiaConfig): LlmProvider {
  const configured = Boolean(config.key && config.endpoint)
  // 형식이 정해지면 여기서 fetch(config.endpoint) 한다. 그 전에는 키가 있어도 부르지 않는다
  const notReady = () => new Error(configured ? 'not implemented' : 'not configured')
  return {
    name: 'ennoia',
    async writeFirst(): Promise<Draft[]> {
      throw notReady()
    },
    async judgeReview(): Promise<Judgement[]> {
      throw notReady()
    },
    async writeFinal(): Promise<FinalDraft[]> {
      throw notReady()
    },
  }
}
