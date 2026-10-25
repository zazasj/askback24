import { describe, expect, it } from 'vitest'
import { CARD_BOOK } from '@shared/catalog'
import { GLOSSARY, TERM_LIMIT, cardTerms } from './glossary'

describe('업무 카드 용어 풀이(U-01)', () => {
  it('카드 글에 나온 말을 처음 나온 순서로, 최대 3개', () => {
    const be01 = CARD_BOOK.cards.find((c) => c.id === 'BE01')!
    expect(cardTerms(be01).map((t) => t.term)).toEqual(['API', '서버'])
    const be05 = CARD_BOOK.cards.find((c) => c.id === 'BE05')!
    expect(cardTerms(be05).map((t) => t.term)).toEqual(['PG사', 'API', '전문'])
  })

  it('긴 말("API 명세서")을 먼저 잡아 같은 자리의 짧은 말을 겹쳐 세지 않는다', () => {
    const terms = cardTerms({ label: '문서', plain: 'API 명세서를 쓴다', examples: [] })
    expect(terms.map((t) => t.term)).toEqual(['API 명세서'])
  })

  it('카드 17개 모두 풀이할 말이 1개 이상, 3개 이하이고 풀이는 비어 있지 않다', () => {
    for (const card of CARD_BOOK.cards) {
      const terms = cardTerms(card)
      expect(terms.length, card.label).toBeGreaterThan(0)
      expect(terms.length, card.label).toBeLessThanOrEqual(TERM_LIMIT)
    }
    for (const g of GLOSSARY) expect(g.def.length, g.term).toBeGreaterThan(5)
  })
})
