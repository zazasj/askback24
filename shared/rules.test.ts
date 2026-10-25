import { describe, expect, it } from 'vitest'
import { PRESETS, getAnalysis } from './catalog'
import type { PostingAnalysis } from './contract'
import { EXPERIENCE_LEAD, anchorText, classify, experienceAnchor, pickExplore, pickTop5, rankPicks, typeLabel } from './rules'

function analysisOf(id: string): PostingAnalysis {
  const a = getAnalysis(id)
  if (!a) throw new Error(`분석 ${id} 없음`)
  return a
}

const OO = analysisOf('K-MOCK-0001') // (주)OO소프트 · SI 개발사
const COMMERCE = analysisOf('K-MOCK-0002') // (주)△△커머스 · 자사 서비스

describe('API-01 예시 구직자 A × (주)OO소프트', () => {
  const top = pickTop5(PRESETS.A, OO)

  it('API-01 pickTop5 = 데모 v0.2와 같은 순서·유형', () => {
    expect(top.map((q) => [q.card_id, q.type])).toEqual([
      ['BE15', 'conflict'],
      ['BE07', 'conflict'],
      ['BE02', 'opportunity'],
      ['BE03', 'opportunity'],
      ['BE01', 'depth'],
    ])
  })

  it('API-01 유형 칩 순서: 충돌 확인, 충돌 확인, 기회 확인, 기회 확인, 깊이 확인', () => {
    expect(top.map((q) => typeLabel(q.type))).toEqual(['충돌 확인', '충돌 확인', '기회 확인', '기회 확인', '깊이 확인'])
  })

  it('API-01 1번 질문은 상주, 5번 질문에만 경험이 붙는다', () => {
    expect(top[0]?.template_text).toContain('상주')
    expect(top[4]?.has_exp).toBe(true)
    expect(top[4]?.template_text).toContain('FastAPI')
    expect(top.slice(0, 4).every((q) => !q.has_exp)).toBe(true)
  })

  it('API-01 공고에 있는 카드는 근거 인용을, 없는 카드는 "근거 없음" 설명을 갖는다', () => {
    expect(top[0]?.evidence).toEqual({ field: 'pfCond', quote: '고객사 상주 가능자' })
    expect(top[1]?.evidence).toEqual({ field: 'jobCont', quote: '기타 업무 지원' })
    expect(top[2]?.evidence).toBeUndefined()
    expect(top[2]?.reason).toContain('근거가 없어')
  })

  it('API-01 주의할 답은 내 선호 쪽 해석을 쓴다', () => {
    expect(top[0]?.watch_out).toContain('상주 비중이 절반 이상')
    expect(top[2]?.watch_out).toContain('설계는 상위 조직')
  })
})

describe('API-02 예시 구직자 A × (주)△△커머스', () => {
  const top = pickTop5(PRESETS.A, COMMERCE)

  it('API-02 BE15(고객사 상주)는 prevent(충돌 예방)', () => {
    const be15 = top.find((q) => q.card_id === 'BE15')
    expect(be15?.type).toBe('prevent')
    expect(typeLabel('prevent')).toBe('충돌 예방')
  })

  it('API-02 상주 질문은 공고 내용을 전제하지 않는 문장', () => {
    for (const q of top) expect(q.template_text).not.toMatch(/공고에 고객사 상주/)
    expect(top.find((q) => q.card_id === 'BE15')?.template_text).toContain('투입되는 경우도 있나요')
  })

  it('API-02 순서 = 기회 확인 2 → 깊이 확인 → 충돌 예방 2', () => {
    expect(top.map((q) => [q.card_id, q.type])).toEqual([
      ['BE02', 'opportunity'],
      ['BE03', 'opportunity'],
      ['BE01', 'depth'],
      ['BE07', 'prevent'],
      ['BE15', 'prevent'],
    ])
  })
})

describe('규칙 표(gap_rules)', () => {
  it('걱정 × 공고에 있음 = 충돌 확인 1, 걱정 × 모호 = 1.5', () => {
    expect(classify('avoid', 'explicit', false)).toEqual({ type: 'conflict', priority: 1 })
    expect(classify('avoid', 'inferred', false)).toEqual({ type: 'conflict', priority: 1 })
    expect(classify('avoid', 'vague', false)).toEqual({ type: 'conflict', priority: 1.5 })
  })

  it('기대 × 공고에 있음 = 깊이 확인 3, 경험이 붙으면 2.8', () => {
    expect(classify('want', 'explicit', false)).toEqual({ type: 'depth', priority: 3 })
    expect(classify('want', 'explicit', true)).toEqual({ type: 'depth', priority: 2.8 })
    expect(classify('want', 'absent', true)).toEqual({ type: 'opportunity', priority: 2 })
  })

  it('모르겠어요 = 탐색(공고에 없으면 예비 5)', () => {
    expect(classify('unsure', 'vague', false)).toEqual({ type: 'explore', priority: 4.5 })
    expect(classify('unsure', 'absent', false)).toEqual({ type: 'explore', priority: 5 })
  })

  it('경험 한 줄이 비어 있으면 경험이 붙지 않고 깊이 확인은 3', () => {
    const top = pickTop5({ picks: PRESETS.A.picks, experience: '   ' }, OO)
    const be01 = top.find((q) => q.card_id === 'BE01')
    expect(be01?.priority).toBe(3)
    expect(be01?.has_exp).toBe(false)
    expect(be01?.template_text).not.toContain('{anchor}')
  })

  it('경험 끝의 쉼표·마침표는 떼고 ", "를 붙인다', () => {
    expect(anchorText('인턴 때 API를 만들어 봤는데.')).toBe('인턴 때 API를 만들어 봤는데, ')
    expect(anchorText('')).toBe('')
  })

  it('A2-06 "…는데"·"…ㄴ데"는 쉼표로 잇고, "…다"·"…요"는 맺은 뒤 질문을 다음 문장으로', () => {
    expect(experienceAnchor('전공이 컴퓨터공학인데')).toEqual({ text: '전공이 컴퓨터공학인데, ', quoted: true })
    expect(experienceAnchor('카페 아르바이트를 2년 했습니다')).toEqual({ text: '카페 아르바이트를 2년 했습니다. ', quoted: true })
    expect(experienceAnchor('졸업 작품으로 쇼핑몰 프로젝트를 했어요.')).toEqual({ text: '졸업 작품으로 쇼핑몰 프로젝트를 했어요. ', quoted: true })
    expect(experienceAnchor('API를 직접 만들어 봤어요!')).toEqual({ text: 'API를 직접 만들어 봤어요! ', quoted: true })
  })

  it('A2-06 이을 수 없는 끝말("…봄"·명사)은 경험 글을 옮기지 않는 앞말', () => {
    for (const exp of ['Spring으로 게시판 만들어 봄', 'FastAPI 프로젝트 경험', '팀장 역할 함']) {
      expect(experienceAnchor(exp), exp).toEqual({ text: EXPERIENCE_LEAD, quoted: false })
    }
    expect(experienceAnchor('  ')).toBeNull()
  })

  it('A2-06 세 입력의 검수 문장이 문법에 맞고 "경험 포함"(has_exp)은 그 카드에만 남는다', () => {
    const cases: Array<[string, string]> = [
      ['카페 아르바이트를 2년 했습니다', '카페 아르바이트를 2년 했습니다. 이 팀에서는'],
      ['학교에서 팀 프로젝트를 했어요', '학교에서 팀 프로젝트를 했어요. 이 팀에서는'],
      ['Spring으로 게시판 만들어 봄', `${EXPERIENCE_LEAD}이 팀에서는`],
    ]
    for (const [exp, start] of cases) {
      const top = pickTop5({ picks: PRESETS.A.picks, experience: exp }, OO)
      const be01 = top.find((q) => q.card_id === 'BE01')
      expect(be01?.has_exp, exp).toBe(true)
      expect(be01?.template_text.startsWith(start), `${exp} → ${be01?.template_text}`).toBe(true)
      expect(be01?.template_text, exp).not.toMatch(/(?:다|요|봄), /)
      expect(top.filter((q) => q.has_exp).map((q) => q.card_id)).toEqual(['BE01'])
    }
    // S4-13 예시 A("…맡아 본 경험이 있습니다.")는 맺은 뒤 질문을 다음 문장으로
    const a = pickTop5(PRESETS.A, OO).find((q) => q.card_id === 'BE01')
    expect(a?.template_text.startsWith(`${PRESETS.A.experience} 이 팀에서는`), a?.template_text).toBe(true)
  })

  it('없는 카드 ID는 건너뛰고, 같은 우선순위면 먼저 고른 것이 위', () => {
    const ranked = rankPicks(
      {
        picks: [
          { card_id: 'BE03', pref: 'want', has_exp: false },
          { card_id: 'NOPE', pref: 'want', has_exp: false },
          { card_id: 'BE02', pref: 'want', has_exp: false },
        ],
      },
      OO,
    )
    expect(ranked.map((q) => q.card_id)).toEqual(['BE03', 'BE02'])
  })

  it('17개를 골라도 5개까지만(예시 A는 카드 17개 모두)', () => {
    expect(rankPicks(PRESETS.A, OO)).toHaveLength(17)
    expect(pickTop5(PRESETS.A, OO)).toHaveLength(5)
  })
})

describe('U-03 더 알아볼 질문(pickExplore)', () => {
  const COMMERCE = analysisOf('K-MOCK-0002')

  it('예시 A × (주)OO소프트 = 공고와 관련 있는 모르겠어요 카드부터 3개, 질문 5개와 겹치지 않음', () => {
    const explore = pickExplore(PRESETS.A, OO)
    // 공고에 나온 모르겠어요 카드(SQL 우대조건 · 요구사항 협의 유추 · 산출물 작성 명시)가 고른 순서대로
    expect(explore.map((r) => r.card_id)).toEqual(['BE04', 'BE12', 'BE14'])
    expect(explore.every((r) => r.type === 'explore' && r.pref === 'unsure')).toBe(true)
    const top = new Set(pickTop5(PRESETS.A, OO).map((r) => r.card_id))
    expect(explore.some((r) => top.has(r.card_id))).toBe(false)
    expect(explore[0]?.template_text.length).toBeGreaterThan(10)
  })

  it('예시 A × (주)△△커머스 = 공고에 나온 카드(장애 대응·SQL·배포) 먼저', () => {
    expect(pickExplore(PRESETS.A, COMMERCE).map((r) => r.card_id)).toEqual(['BE08', 'BE04', 'BE09'])
  })

  it('모르겠어요가 없으면 빈 목록', () => {
    const picks = PRESETS.A.picks.filter((p) => p.pref !== 'unsure')
    expect(pickExplore({ picks, experience: '' }, OO)).toEqual([])
  })
})
