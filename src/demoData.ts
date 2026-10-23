/** 화면 전용 정적 데이터(김00 이력서, 지원 내역 시드). 공고·카드는 @shared/catalog 에서 꺼낸다. */
import seedJson from '@data/applications.seed.json'
import personaJson from '@data/persona.json'
import { PRESETS } from '@shared/catalog'
import type { FirstQuestionsResponse } from '@shared/contract'
import { buildTemplateFirst } from '@shared/generate'
import { fromPreset, requestKey, toFirstRequest, type PrepSelection } from '@/features/interview-prep/picks'
import type { Application, Persona } from './types'

export const APPLICATION_SEED: readonly Application[] = seedJson as Application[]
export const PERSONA = personaJson as Persona

export function cloneSeed(): Application[] {
  return APPLICATION_SEED.map((a) => ({ ...a }))
}

// ── S1 2행 시드: 예시 구직자 선택과 1차 결과를 가진 채로 시작(R-07) ──────────
// 저장소에 넣지 않고 "저장값이 없을 때의 기본값"으로만 쓴다. 시연 초기화 뒤에도 그대로 돌아온다.

function seedOf(applyId: string): Application | undefined {
  return APPLICATION_SEED.find((a) => a.apply_id === applyId && a.prep_seed)
}

export function seedSelection(applyId: string): PrepSelection | undefined {
  const app = seedOf(applyId)
  return app?.prep_seed ? fromPreset(PRESETS[app.prep_seed]) : undefined
}

export interface SeedFirst {
  request_key: string
  response: FirstQuestionsResponse
}

const firstCache = new Map<string, SeedFirst | null>()

/** 시드 지원 건의 1차 결과: 공급자 없이 같은 규칙의 검수 문장으로 만든다 */
export function seedFirst(applyId: string): SeedFirst | undefined {
  if (!firstCache.has(applyId)) {
    const app = seedOf(applyId)
    const sel = seedSelection(applyId)
    let seed: SeedFirst | null = null
    if (app && sel) {
      const req = toFirstRequest(app.wantedAuthNo, sel)
      try {
        seed = { request_key: requestKey(req), response: buildTemplateFirst(req) }
      } catch {
        seed = null
      }
    }
    firstCache.set(applyId, seed)
  }
  return firstCache.get(applyId) ?? undefined
}
