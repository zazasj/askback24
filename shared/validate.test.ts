import { describe, expect, it } from 'vitest'
import { ANALYSES, CARDS, FINAL_BOOK, getPosting } from './catalog'
import type { Posting, PostingState, QType } from './contract'
import { classify, questionTemplate } from './rules'
import { TEXT_MAX, checkFinalQuestion, checkFirstQuestion, hasForbiddenWord, quoteInPosting } from './validate'

function postingOf(id: string): Posting {
  const p = getPosting(id)
  if (!p) throw new Error(`공고 ${id} 없음`)
  return p
}

const OO = postingOf('K-MOCK-0001')
const OK_TEXT = '현재 팀 업무에서 기존 시스템 유지보수와 새 기능 개발의 비중은 대략 어떻게 되나요?'

describe('API-03 근거 인용', () => {
  it('API-03 quote가 그 필드 원문에 글자 그대로 있으면 통과', () => {
    expect(quoteInPosting(OO, { field: 'jobCont', quote: '기타 업무 지원' })).toBe(true)
    expect(checkFirstQuestion({ text: OK_TEXT, state: 'vague', evidence: { field: 'jobCont', quote: '기타 업무 지원' } }, OO)).toEqual([])
  })

  it('API-03 quote가 원문에 없으면 탈락(다른 필드에 있어도, 한 글자만 달라도)', () => {
    expect(checkFirstQuestion({ text: OK_TEXT, state: 'vague', evidence: { field: 'jobCont', quote: '기타 업무지원' } }, OO)).toContain(
      'evidence_not_in_posting',
    )
    // "고객사 상주 가능자"는 우대조건(pfCond)에 있고 직무내용(jobCont)에는 없다
    expect(checkFirstQuestion({ text: OK_TEXT, state: 'explicit', evidence: { field: 'jobCont', quote: '고객사 상주 가능자' } }, OO)).toContain(
      'evidence_not_in_posting',
    )
    expect(quoteInPosting(OO, { field: 'jobCont', quote: '' })).toBe(false)
  })

  it('분석 JSON의 근거 인용은 모두 통과한다', () => {
    for (const a of ANALYSES) {
      const p = postingOf(a.wantedAuthNo)
      for (const c of a.cards) if (c.evidence) expect(quoteInPosting(p, c.evidence), `${a.wantedAuthNo} ${c.card_id}`).toBe(true)
      for (const b of a.blanks) if (b.evidence) expect(quoteInPosting(p, b.evidence), `${a.wantedAuthNo} ${b.topic}`).toBe(true)
    }
  })
})

describe('API-03 공고에 없는 카드의 전제 표현', () => {
  const presuppose = '공고에 고객사 상주 우대가 있던데, 신입이 상주 프로젝트에 투입되는 비율은 어느 정도인가요?'

  it('API-03 absent 카드 질문에 "공고에 … 있던데/있는데"가 있으면 탈락', () => {
    expect(checkFirstQuestion({ text: presuppose, state: 'absent' }, OO)).toContain('absent_presupposition')
    expect(checkFirstQuestion({ text: '공고에 온콜이 있는데, 신입도 들어가나요?', state: 'absent' }, OO)).toContain('absent_presupposition')
  })

  it('공고에 있는 카드는 같은 표현이어도 통과, absent 라도 전제 없는 문장은 통과', () => {
    expect(checkFirstQuestion({ text: presuppose, state: 'explicit' }, OO)).toEqual([])
    expect(
      checkFirstQuestion({ text: '신입이 고객사 상주 프로젝트에 투입되는 경우도 있나요? 있다면 비율은 어느 정도인가요?', state: 'absent' }, OO),
    ).toEqual([])
  })
})

describe('API-03 금지어', () => {
  it('API-03 나이·결혼·출신 등이 들어가면 탈락', () => {
    for (const text of [
      '이 팀 분들은 나이대가 어떻게 되시나요?',
      '결혼하신 분들도 야근을 많이 하시나요?',
      '팀원분들 출신 학교는 주로 어디인가요?',
      '종교 활동 때문에 주말 근무가 어려운데 괜찮을까요?',
    ]) {
      expect(hasForbiddenWord(text), text).toBe(true)
      expect(checkFirstQuestion({ text, state: 'explicit' }, OO), text).toContain('forbidden_word')
    }
  })

  it('회사를 평가하는 말도 탈락', () => {
    expect(hasForbiddenWord('혹시 블랙 기업이라는 말을 들어 보셨나요?')).toBe(true)
  })
})

describe('API-03 최종 질문의 1차 면접관 인용', () => {
  it('API-03 "아까" "하셨는데" "말씀하신"이 있으면 탈락', () => {
    for (const text of [
      '아까 유지보수가 7할이라고 하셨는데, 신규 개발은 언제부터 맡나요?',
      '1차 면접에서 프로젝트마다 다르다고 하셨는데 비율을 알 수 있을까요?',
      '말씀하신 상주 프로젝트는 보통 기간이 어느 정도인가요?',
    ]) {
      expect(checkFinalQuestion({ text }, OO), text).toContain('interviewer_quote')
    }
  })

  it('중립 재질문·완충 문장은 통과(1차 질문에는 인용 검사를 하지 않음)', () => {
    expect(checkFinalQuestion({ text: '팀 업무 비중을 다시 한번 정리해서 듣고 싶습니다. 유지보수와 신규 개발은 어떻게 나뉘나요?' }, OO)).toEqual([])
    expect(checkFinalQuestion({ text: '하나만 더 여쭤도 될까요? 신입이 상주 프로젝트에 투입되는 기간은 보통 어느 정도인가요?' }, OO)).toEqual([])
    expect(checkFirstQuestion({ text: '아까 본 공고 이야기인데, 팀 구성은 어떻게 되나요?', state: 'explicit' }, OO)).toEqual([])
  })
})

describe('길이', () => {
  it('빈 문장·너무 짧은 문장·너무 긴 문장은 탈락', () => {
    expect(checkFirstQuestion({ text: '   ', state: 'explicit' }, OO)).toEqual(['empty'])
    expect(checkFirstQuestion({ text: '비중은요?', state: 'explicit' }, OO)).toContain('too_short')
    expect(checkFirstQuestion({ text: '가'.repeat(TEXT_MAX + 1), state: 'explicit' }, OO)).toContain('too_long')
  })
})

describe('검수 틀은 검사를 모두 통과한다(대체 문장이 다시 걸리면 안 된다)', () => {
  const STATES: PostingState[] = ['explicit', 'inferred', 'vague', 'absent']
  const anchor = '인턴 때 FastAPI로 API를 설계부터 배포까지 맡아 봤는데, '

  it('카드 17개 × 쓰일 수 있는 모든 (선호 × 공고 상태) 조합', () => {
    for (const card of CARDS) {
      for (const pref of ['want', 'avoid', 'unsure'] as const) {
        for (const state of STATES) {
          const hit = classify(pref, state, false)
          if (!hit) continue
          const type: QType = hit.type
          const text = questionTemplate(card, type).replace('{anchor}', pref === 'want' ? anchor : '')
          expect(checkFirstQuestion({ text, state }, OO), `${card.id} ${pref} × ${state} = ${type}`).toEqual([])
        }
      }
    }
  })
})

/** 화면의 다른 글은 모두 해요체라 질문·주의할 답·좋은 신호에 합쇼체·한다체가 섞이면 내부 메모처럼 읽힌다 */
describe('문체: 질문 틀·주의할 답·좋은 신호는 해요체(DR-r1-10·11)', () => {
  const FORMAL = /니다|니까/
  const ENDS_HAEYO = /요[.!?]?$/

  it('DR-r1-10 질문 틀(카드·최종·처우 재료)에 "…습니다/합니다"가 없다', () => {
    for (const c of CARDS) for (const [t, text] of Object.entries(c.questions)) expect(text, `${c.id}.${t}`).not.toMatch(FORMAL)
    const T = FINAL_BOOK.templates
    for (const text of [T.recheck_vague_tail, T.scope.avoid, T.scope.want, T.signal_lead, ...FINAL_BOOK.cushions]) expect(text).not.toMatch(FORMAL)
    for (const a of ANALYSES) for (const b of a.blanks) expect(b.question, `${a.wantedAuthNo} ${b.topic}`).not.toMatch(FORMAL)
  })

  it('DR-r1-11 주의할 답·좋은 신호는 모두 "…요"로 끝난다(한다체·명사형 끝 없음)', () => {
    for (const c of CARDS) {
      for (const [k, text] of Object.entries(c.interpretation)) expect(text.trim(), `${c.id}.${k}`).toMatch(ENDS_HAEYO)
    }
    for (const [topic, t] of Object.entries(FINAL_BOOK.offer_topics)) {
      expect(t.watch_out.trim(), `${topic}.watch_out`).toMatch(ENDS_HAEYO)
      expect(t.good_sign.trim(), `${topic}.good_sign`).toMatch(ENDS_HAEYO)
    }
  })
})
