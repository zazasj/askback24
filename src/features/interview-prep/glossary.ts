/**
 * 업무 카드 "예를 들면"에 붙일 용어 풀이(D-175). 카드 이름 → 설명 → 예시 순서로 처음 나온 말부터 최대 3개.
 * 긴 말을 먼저 찾아("API 명세서") 그 안의 짧은 말("API")이 같은 자리에서 또 잡히지 않게 한다.
 */
import glossaryJson from '@data/glossary.json'
import type { CardDef } from '@shared/contract'

export interface GlossaryTerm {
  term: string
  def: string
}

export const GLOSSARY: readonly GlossaryTerm[] = glossaryJson.terms
export const TERM_LIMIT = 3

export function cardTerms(card: Pick<CardDef, 'label' | 'plain' | 'examples'>, limit = TERM_LIMIT): GlossaryTerm[] {
  const text = [card.label, card.plain, ...(card.examples ?? [])].join('\n')
  const byLength = [...GLOSSARY].sort((a, b) => b.term.length - a.term.length)
  const taken: Array<{ at: number; end: number }> = []
  const hits: Array<{ at: number; term: GlossaryTerm }> = []
  for (const g of byLength) {
    let from = 0
    for (;;) {
      const at = text.indexOf(g.term, from)
      if (at < 0) break
      const end = at + g.term.length
      if (!taken.some((t) => at < t.end && end > t.at)) {
        taken.push({ at, end })
        if (!hits.some((h) => h.term.term === g.term)) hits.push({ at, term: g })
      }
      from = end
    }
  }
  return hits.sort((a, b) => a.at - b.at).slice(0, limit).map((h) => h.term)
}
