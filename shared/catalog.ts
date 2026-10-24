/**
 * 정적 데이터(data/*.json)를 타입을 붙여 꺼내는 곳. 화면과 서버 함수가 같이 쓴다.
 * import 속성(with { type: 'json' })은 Vercel 함수가 번들 없이 Node ESM으로 돌 때도 JSON을 읽게 하려는 것.
 */
import type { CardBook, CardDef, CardPick, CompanySignal, FinalBook, Posting, PostingAnalysis, ReviewExample } from './contract.js'
import cardBookJson from '../data/cards.backend.json' with { type: 'json' }
import finalBookJson from '../data/final.backend.json' with { type: 'json' }
import reviewExampleJson from '../data/review.example.json' with { type: 'json' }
import postingsJson from '../data/postings.json' with { type: 'json' }
import signalsJson from '../data/signals.json' with { type: 'json' }
import presetsJson from '../data/presets.json' with { type: 'json' }
import analysis0001 from '../data/analysis/K-MOCK-0001.json' with { type: 'json' }
import analysis0002 from '../data/analysis/K-MOCK-0002.json' with { type: 'json' }
import analysis0003 from '../data/analysis/K-MOCK-0003.json' with { type: 'json' }
import analysis0004 from '../data/analysis/K-MOCK-0004.json' with { type: 'json' }
import analysis0005 from '../data/analysis/K-MOCK-0005.json' with { type: 'json' }
import analysis0006 from '../data/analysis/K-MOCK-0006.json' with { type: 'json' }
import analysis0007 from '../data/analysis/K-MOCK-0007.json' with { type: 'json' }

export const CARD_BOOK = cardBookJson as unknown as CardBook
export const CARDS: readonly CardDef[] = CARD_BOOK.cards
const cardById = new Map(CARDS.map((c) => [c.id, c]))

export function getCard(id: string): CardDef | undefined {
  return cardById.get(id)
}

/** 최종 면접·처우 질문 규칙과 검수 문장 */
export const FINAL_BOOK = finalBookJson as unknown as FinalBook

/** 1차 면접 정리 예시 세트(R-04) */
export const REVIEW_EXAMPLE = reviewExampleJson as unknown as ReviewExample

export const POSTINGS: readonly Posting[] = postingsJson as Posting[]
const postingById = new Map(POSTINGS.map((p) => [p.wantedAuthNo, p]))

export function getPosting(wantedAuthNo: string): Posting | undefined {
  return postingById.get(wantedAuthNo)
}

// 공고를 더할 때 여기에 분석 파일 import 를 한 줄씩 더한다(분석이 없는 공고는 질문을 만들 수 없다).
export const ANALYSES: readonly PostingAnalysis[] = [
  analysis0001,
  analysis0002,
  analysis0003,
  analysis0004,
  analysis0005,
  analysis0006,
  analysis0007,
] as unknown as PostingAnalysis[]
const analysisById = new Map(ANALYSES.map((a) => [a.wantedAuthNo, a]))

export function getAnalysis(wantedAuthNo: string): PostingAnalysis | undefined {
  return analysisById.get(wantedAuthNo)
}

const signals = signalsJson as unknown as Record<string, CompanySignal[]>

export function getSignals(wantedAuthNo: string): CompanySignal[] {
  return signals[wantedAuthNo] ?? []
}

/** 시연 도구 "예시 구직자 A·B로 채우기" */
export interface Preset {
  label: string
  summary: string
  picks: CardPick[]
  experience: string
}

export type PresetKey = 'A' | 'B'
export const PRESETS = presetsJson as unknown as Record<PresetKey, Preset>
