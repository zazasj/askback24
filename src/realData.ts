/**
 * 고용24 오픈API에서 미리 받아 둔 실제 값(data/real/*.json, `npm run fetch:work24` 가 만든다).
 * 화면은 API를 부르지 않고 이 파일만 읽는다. 공통코드(common-codes.json)는 커서 화면에 싣지 않고 단위 시험만 읽는다.
 */
import ncsJson from '@data/real/ncs-cards.json'
import jobJson from '@data/real/job-info.json'
import giantsJson from '@data/real/small-giants-summary.json'
import sourcesJson from '@data/real/sources.json'
import type { CardDef } from '@shared/contract'

export interface NcsUnit {
  /** 능력단위명 */
  centerLabel: string
  /** 능력단위 정의 */
  ablt_def: string
  /** 능력단위 코드 */
  ablt_unit: string
  /** 세분류명 */
  job_sdvn: string
  centerURL: string
}

export type NcsEntry =
  | { card_id: string; label: string; matched: true; query: string; unit: NcsUnit }
  | { card_id: string; label: string; matched: false; existing: CardDef['ncs'] }

export const NCS_CARDS = ncsJson as unknown as { fetched_on: string; matched_count: number; cards: NcsEntry[] }
const ncsByCard = new Map(NCS_CARDS.cards.map((e) => [e.card_id, e]))

export function ncsEntry(cardId: string): NcsEntry | undefined {
  return ncsByCard.get(cardId)
}

/**
 * 응답에서 같은 이름을 못 찾았거나 뜻이 달라 팀이 고른 NCS 값의 머리말. "(팀 정리)"는 구직자가 알아보기 어려워
 * "NCS 참고"로 바꿨다(H2-11 ④)
 */
export const TEAM_NCS_LABEL = 'NCS 참고'

/** ② 카드의 "NCS" 줄: 응답에서 찾은 능력단위명은 "NCS · …", 팀이 고른 값은 "NCS 참고 · …" — 응답 값과 구별되게 */
export function ncsLine(card: CardDef): string {
  const e = ncsEntry(card.id)
  if (e?.matched) return `NCS · ${e.unit.centerLabel}`
  const units = e && !e.matched ? e.existing : card.ncs
  if (!units.length) return '근무 방식·환경 카드'
  return `${e && !e.matched ? TEAM_NCS_LABEL : 'NCS'} · ${units.map((n) => n.unit).join(', ')}`
}

/** 응답에서 찾은 능력단위 정의의 첫 문장(H2-11 ②). 팀이 고른 값은 받은 정의가 없어 빈 문자열 */
export function ncsDefinition(card: CardDef): string {
  const e = ncsEntry(card.id)
  if (!e?.matched) return ''
  const def = e.unit.ablt_def.replace(/\s+/g, ' ').trim()
  return /^.*?[.。](?=\s|$)/.exec(def)?.[0] ?? def
}

export const JOB_INFO = jobJson as { fetched_on: string; jobCd: string; job_name: string; summary: string; summary_short: string }

export interface GiantsSummary {
  fetched_on: string
  /** 응답의 total(똑같은 줄 포함) */
  total: number
  /** 똑같은 줄을 뺀 건수. 정보통신업·인증 종류는 이 건수로 셌다(D-121) */
  counted: number
  counted_companies: number
  ict: { label: string; count: number }
  by_brand: Array<{ brand: string; count: number }>
  by_year: Array<{ year: string; count: number }>
}
export const SMALL_GIANTS = giantsJson as unknown as GiantsSummary

export type RealSourceId = 'duty' | 'job' | 'codes' | 'giants'
const sources = (sourcesJson as { files: Array<{ id: RealSourceId; api: string; fetched_on: string }> }).files

/** 그 출처를 받은 날짜("2026-10-25"), 없으면 "" */
export function fetchedOn(id: RealSourceId): string {
  return sources.find((s) => s.id === id)?.fetched_on ?? ''
}

export function apiOf(id: RealSourceId): string {
  return sources.find((s) => s.id === id)?.api ?? ''
}
