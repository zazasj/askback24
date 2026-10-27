import { describe, expect, it } from 'vitest'
import { ANALYSES, CARDS, FINAL_BOOK, POSTINGS, getPosting, getSignals } from './catalog'
import type { Posting, PostingState, QType } from './contract'
import { classify, questionTemplate } from './rules'
import { TEXT_MAX, checkFinalQuestion, checkFirstQuestion, hasForbiddenWord, quoteInPosting, quotesNotInPosting } from './validate'

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

// H2-06 ①(세진 승인 2026-10-25): D-075는 인용 검사를 단위 시험에만 두었지만 실제 LLM이 지어낸 인용을 막으려고 validate에 넣는다
describe('API-03 질문 문장 속 따옴표 인용(H2-06 ①)', () => {
  it("API-03 문장 속 '…' 인용이 공고 원문에 글자 그대로 없으면 탈락(1차·최종 모두)", () => {
    const made = "공고에 '야간 당직 필수'라는 조건이 있어 여쭙겠습니다. 당번은 한 달에 몇 번인가요?"
    expect(quotesNotInPosting(made, OO)).toEqual(['야간 당직 필수'])
    expect(checkFirstQuestion({ text: made, state: 'explicit' }, OO)).toContain('quote_not_in_posting')
    expect(checkFinalQuestion({ text: made }, OO)).toContain('quote_not_in_posting')
    // 한 글자만 달라도 탈락
    expect(checkFirstQuestion({ text: "공고의 '기타 업무지원' 범위가 궁금합니다. 어디까지 포함되나요?", state: 'vague' }, OO)).toContain('quote_not_in_posting')
  })

  it('원문에 있는 인용(어느 칸이든)과 카드 이름 인용은 통과', () => {
    expect(checkFirstQuestion({ text: "공고에 적힌 '기타 업무 지원'에 어떤 업무까지 포함되는지 여쭙고 싶습니다.", state: 'vague' }, OO)).toEqual([])
    expect(checkFirstQuestion({ text: "공고에 '고객사 상주 가능자'라는 조건이 있어 여쭙겠습니다. 비율은 어느 정도인가요?", state: 'explicit' }, OO)).toEqual([])
    expect(checkFinalQuestion({ text: "혹시 함께하게 된다면 '장애 대응·온콜' 업무도 맡게 될 수 있는지 여쭙고 싶습니다." }, OO)).toEqual([])
    expect(quotesNotInPosting('따옴표가 없는 질문은 그대로 통과합니다. 비중은 어느 정도인가요?', OO)).toEqual([])
  })

  // A3-r2-10: 문장은 공백을 한 칸으로 줄여 검사하므로 원문 칸 값의 연속 공백·탭·줄바꿈도 한 칸으로 보고 비교한다
  it('A3-r2-10 원문에 두 칸 띄어쓰기·탭·줄바꿈이 섞인 구절을 한 칸으로 인용하면 통과, 원문에 없는 말은 여전히 탈락', () => {
    const spaced: Posting = { ...OO, jobCont: '주요 업무:\n- 사내  결제 시스템\t운영\n- 정산 배치\n  개발 및 개선', pfCond: '고객사 상주 가능자' }
    const ok = "공고의 '사내 결제 시스템 운영'에 신입은 어느 정도 참여하나요?"
    expect(quotesNotInPosting(ok, spaced)).toEqual([])
    expect(checkFirstQuestion({ text: ok, state: 'explicit' }, spaced)).toEqual([])
    expect(quotesNotInPosting("공고에 적힌 '정산 배치 개발 및 개선'은 어떤 일인가요?", spaced)).toEqual([])
    // 원문에 없는 말·한 글자 다른 말·두 칸에 걸친 말은 탈락
    expect(quotesNotInPosting("공고의 '사내 정산 시스템 운영'은 누가 맡나요?", spaced)).toEqual(['사내 정산 시스템 운영'])
    expect(quotesNotInPosting("공고의 '사내 결제시스템 운영'은 누가 맡나요?", spaced)).toEqual(['사내 결제시스템 운영'])
    expect(quotesNotInPosting("공고의 '개발 및 개선 고객사 상주'는 어떤 뜻인가요?", spaced)).toEqual(['개발 및 개선 고객사 상주'])
    // 분석 근거 검사는 글자 그대로(P-04): 한 칸으로 줄인 인용은 받지 않는다
    expect(quoteInPosting(spaced, { field: 'jobCont', quote: '사내 결제 시스템 운영' })).toBe(false)
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

  // A3-r1-02: '본적'·'배우자'가 다른 낱말 안에 들어 있으면 걸지 않는다(실제 AI 문장이 검수 문장으로 바뀌던 오탐)
  it('A3-r1-02 금지어 오탐: 기본적으로·근본적인·해 본적이·함께 배우자는 은 통과', () => {
    for (const text of [
      '장애가 나면 근본적인 원인 분석까지 신입이 참여하나요?',
      '신입은 기본적으로 어떤 업무부터 맡게 되나요?',
      'API를 직접 설계해 본적이 있어 여쭙습니다.',
      '함께 배우자는 분위기에서 코드 리뷰를 하나요?',
    ]) {
      expect(hasForbiddenWord(text), text).toBe(false)
      expect(checkFirstQuestion({ text, state: 'explicit' }, OO), text).toEqual([])
    }
  })

  it('A3-r1-02 본적지·배우자(명사)는 그대로 탈락', () => {
    for (const text of ['팀원분들 본적지는 주로 어디인가요?', '배우자가 있는 분들도 상주 근무를 하시나요?', '배우자분 직장 때문에 이직하는 경우가 있나요?']) {
      expect(hasForbiddenWord(text), text).toBe(true)
    }
  })

  // A3-r2-07: '하나이고'·'하나이며'처럼 앞 글자가 한글인 '나이'는 낱말 일부라 걸지 않는다
  it('A3-r2-07 금지어 오탐: 업무 중 하나이고·하나이며 는 통과', () => {
    for (const text of ['유지보수도 주요 업무 중 하나이고, 신입이 맡는 비중은 어느 정도인가요?', '배포 자동화도 업무 중 하나이며 신입도 참여하나요?']) {
      expect(hasForbiddenWord(text), text).toBe(false)
      expect(checkFirstQuestion({ text, state: 'explicit' }, OO), text).toEqual([])
      expect(checkFinalQuestion({ text }, OO), text).toEqual([])
    }
  })

  it('A3-r2-07 나이가·연령·몇 살 은 그대로 탈락(문장 처음·띄어 쓴 뒤 모두)', () => {
    for (const text of [
      '나이가 많은 신입도 지원할 수 있나요?',
      '팀원분들 나이가 어떻게 되시나요?',
      '팀원분들 평균 연령은 어떻게 되나요?',
      '팀장님은 몇 살이신가요?',
      '신입은 보통 몇살 정도인가요?',
    ]) {
      expect(hasForbiddenWord(text), text).toBe(true)
      expect(checkFirstQuestion({ text, state: 'explicit' }, OO), text).toContain('forbidden_word')
    }
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

  it('카드 17개 × 쓰일 수 있는 모든 (선호 × 공고 상태) 조합(공고에 적힌 업무용 틀 포함, H2-02)', () => {
    for (const card of CARDS) {
      for (const pref of ['want', 'avoid', 'unsure'] as const) {
        for (const state of STATES) {
          const hit = classify(pref, state, false)
          if (!hit) continue
          const type: QType = hit.type
          const text = questionTemplate(card, type, { state }).replace('{anchor}', pref === 'want' ? anchor : '')
          expect(checkFirstQuestion({ text, state }, OO), `${card.id} ${pref} × ${state} = ${type}`).toEqual([])
        }
      }
    }
  })

  it('공고마다 덮어쓴 틀(H1-11)과 최종 예 질문(H1-13)도 그 공고에서 검사를 통과한다', () => {
    let seen = 0
    for (const a of ANALYSES) {
      const p = postingOf(a.wantedAuthNo)
      for (const c of a.cards) {
        for (const text of Object.values(c.questions ?? {})) {
          seen++
          expect(checkFirstQuestion({ text, state: c.state }, p), `${a.wantedAuthNo} ${c.card_id}`).toEqual([])
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
    for (const card of CARDS) expect(checkFinalQuestion({ text: card.example_question ?? '' }, OO), card.id).toEqual([])
  })
})

/**
 * 문체(D-179, DR-r1-10을 대체): 질문 문장은 구직자가 면접장에서 그대로 말하는 글이라 공손한 비즈니스체로 쓴다 —
 * 서술은 "…습니다", 질문은 "…인가요?·…될까요?". "…궁금해요."처럼 해요체 서술로 끝나는 문장은 두지 않는다.
 * 주의할 답·좋은 신호는 서비스가 구직자에게 하는 설명이라 화면의 다른 글처럼 해요체다(DR-r1-11 그대로).
 */
describe('문체: 질문 문장은 면접 비즈니스체, 주의할 답·좋은 신호는 해요체(D-179·DR-r1-11)', () => {
  const ENDS_HAEYO = /요[.!?]?$/
  /** 해요체 서술로 끝나는 문장("…요." · "…요" 끝). 질문("…요?")은 공손한 질문형이라 괜찮다 */
  const HAEYO_STATEMENT = /요\.?$/
  const sentences = (text: string) =>
    text
      .replace(/\{anchor\}/g, '')
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)

  it('D-179 질문 틀(카드·최종·처우 재료)에 해요체 서술로 끝나는 문장이 없다', () => {
    const check = (text: string, where: string) => {
      for (const s of sentences(text)) expect(s, `${where}: ${s}`).not.toMatch(HAEYO_STATEMENT)
    }
    for (const c of CARDS) {
      for (const [t, text] of Object.entries(c.questions)) check(text, `${c.id}.${t}`)
      for (const [t, text] of Object.entries(c.questions_explicit ?? {})) check(text, `${c.id}.explicit.${t}`)
      check(c.example_question ?? '', `${c.id}.example_question`)
    }
    for (const a of ANALYSES) for (const c of a.cards) for (const [t, text] of Object.entries(c.questions ?? {})) check(text, `${a.wantedAuthNo} ${c.card_id}.${t}`)
    check(FINAL_BOOK.templates.recheck_example, 'final.recheck_example')
    for (const p of POSTINGS) for (const s of getSignals(p.wantedAuthNo)) check(s.ask ?? '', `${p.wantedAuthNo} 신호 질문`)
    const T = FINAL_BOOK.templates
    for (const text of [...Object.values(T.recheck_lead), T.scope.avoid, T.scope.want, T.signal_lead, ...FINAL_BOOK.cushions]) check(text, 'final')
    for (const a of ANALYSES) for (const b of a.blanks) check(b.question, `${a.wantedAuthNo} ${b.topic}`)
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

describe('경험 한 줄이 없는 문항의 경험 표현(experience_claim)', () => {
  const text = '제가 온콜을 해 봤는데, 이 팀에서는 신입도 들어가나요?'

  it('has_exp false 이면 1인칭 경험 표현이 탈락', () => {
    expect(checkFirstQuestion({ text, state: 'inferred', has_exp: false }, OO)).toEqual(['experience_claim'])
  })

  it('has_exp true 이면 통과', () => {
    expect(checkFirstQuestion({ text, state: 'inferred', has_exp: true }, OO)).toEqual([])
  })

  it('has_exp 가 없으면(최종 등) 보지 않는다', () => {
    expect(checkFirstQuestion({ text, state: 'inferred' }, OO)).toEqual([])
  })

  it('회사를 단정하는 말은 forbidden_word', () => {
    expect(hasForbiddenWord('퇴사자가 많던데 이유가 무엇인가요?')).toBe(true)
  })
})
