/** 화면 전용 정적 데이터(김00 이력서, 지원 내역 시드). 공고·카드는 @shared/catalog 에서 꺼낸다. */
import seedJson from '@data/applications.seed.json'
import personaJson from '@data/persona.json'
import type { Application, Persona } from './types'

export const APPLICATION_SEED: readonly Application[] = seedJson as Application[]
export const PERSONA = personaJson as Persona

export function cloneSeed(): Application[] {
  return APPLICATION_SEED.map((a) => ({ ...a }))
}
