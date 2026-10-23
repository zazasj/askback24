import { describe, expect, it } from 'vitest'
import { PRESETS, getAnalysis } from '@shared/catalog'
import type { PostingAnalysis } from '@shared/contract'
import { pickTop5 } from '@shared/rules'
import { choose, countByPref, emptySelection, experienceTarget, fromPreset, isSelection, toCardPicks, toggle } from './picks'

describe('카드 선택', () => {
  it('S4-10 고른 것을 다시 누르면 풀리고, 다른 것을 누르면 자리를 지킨 채 바뀐다', () => {
    let picks = toggle([], 'BE01', 'want')
    picks = toggle(picks, 'BE02', 'avoid')
    expect(countByPref(picks)).toEqual({ want: 1, avoid: 1, unsure: 0 })
    picks = toggle(picks, 'BE01', 'unsure')
    expect(picks).toEqual([
      { card_id: 'BE01', pref: 'unsure' },
      { card_id: 'BE02', pref: 'avoid' },
    ])
    picks = toggle(picks, 'BE01', 'unsure')
    expect(picks).toEqual([{ card_id: 'BE02', pref: 'avoid' }])
    expect(choose(picks, 'BE09', null)).toEqual(picks)
  })
})

describe('경험 한 줄을 붙일 카드', () => {
  it('정한 카드가 "기대돼요"면 그 카드, 아니면 처음 고른 "기대돼요" 카드', () => {
    const base = { ...emptySelection(), experience: '졸업 프로젝트에서 DB 설계를 맡아 봤는데' }
    const picks = [
      { card_id: 'BE07', pref: 'avoid' as const },
      { card_id: 'BE02', pref: 'want' as const },
      { card_id: 'BE03', pref: 'want' as const },
    ]
    expect(experienceTarget({ ...base, picks, exp_card: 'BE03' })).toBe('BE03')
    expect(experienceTarget({ ...base, picks, exp_card: 'BE07' })).toBe('BE02')
    expect(experienceTarget({ ...base, picks, exp_card: null })).toBe('BE02')
    expect(experienceTarget({ ...base, picks: picks.slice(0, 1), exp_card: null })).toBeNull()
    expect(experienceTarget({ ...base, experience: '  ', picks, exp_card: 'BE03' })).toBeNull()
  })
})

describe('S4-12 예시 구직자 A로 채우기', () => {
  const sel = fromPreset(PRESETS.A)

  it('기대 3 · 걱정 2 · 모르겠어요 1, 경험 한 줄, 6개', () => {
    expect(sel.picks).toHaveLength(6)
    expect(countByPref(sel.picks)).toEqual({ want: 3, avoid: 2, unsure: 1 })
    expect(sel.experience).toBe('인턴 때 FastAPI로 API를 설계부터 배포까지 맡아 봤는데')
    expect(isSelection(sel)).toBe(true)
  })

  it('화면 선택 → CardPick 이 예시 A 그대로라 pickTop5 결과가 API-01과 같다', () => {
    expect(toCardPicks(sel)).toEqual(PRESETS.A.picks)
    const oo = getAnalysis('K-MOCK-0001') as PostingAnalysis
    const top = pickTop5({ picks: toCardPicks(sel), experience: sel.experience }, oo)
    expect(top.map((q) => q.card_id)).toEqual(['BE15', 'BE07', 'BE02', 'BE03', 'BE01'])
  })
})

describe('저장값 검사', () => {
  it('모양이 다른 저장값은 버린다', () => {
    expect(isSelection({ picks: [{ card_id: 'BE01', pref: 'like' }], experience: '', exp_card: null })).toBe(false)
    expect(isSelection({ picks: [], experience: 3, exp_card: null })).toBe(false)
    expect(isSelection(null)).toBe(false)
  })
})
