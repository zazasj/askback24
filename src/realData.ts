/**
 * 고용24 오픈API에서 미리 받아 둔 실제 값(data/real/*.json, `npm run fetch:work24` 가 만든다).
 * 화면은 API를 부르지 않고 이 파일만 읽는다. 공통코드(common-codes.json)는 커서 화면에 싣지 않고 단위 시험만 읽는다.
 */
import ncsJson from '@data/real/ncs-cards.json'
import jobJson from '@data/real/job-webdev.json'
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

/** ② 카드의 "NCS" 줄: 응답에서 찾은 능력단위명, 못 찾았으면 팀이 정리한 값 */
export function ncsLine(card: CardDef): string {
  const e = ncsEntry(card.id)
  if (e?.matched) return `NCS · ${e.unit.centerLabel}`
  const units = e && !e.matched ? e.existing : card.ncs
  return units.length ? `NCS · ${units.map((n) => n.unit).join(', ')}` : '근무 방식·환경 카드'
}

export const JOB_INFO = jobJson as { fetched_on: string; jobCd: string; job_name: string; summary: string; summary_short: string }

export interface GiantsSummary {
  fetched_on: string
  total: number
  counted: number
  ict: { label: string; count: number }
  by_brand: Array<{ brand: string; count: number }>
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
