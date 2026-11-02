/**
 * 모드마다 사실이 다른 화면 글(PLAN-4 T4 · C4-04). 실제 모드는 지금 시연에서도 엔노이아로 넘어간다는 것을 말하고,
 * AI로 넘기는 것은 AI 서버 프롬프트(api/_agent/prompts)의 요청 값과 맞는지 본다. 가짜 응답 모드 글은 지난 글 그대로.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EXPERIENCE_LEAD } from '@shared/rules'
import { experienceHintText, modeCopy, type ModeCopy } from './modeCopy'

const REAL = modeCopy(false)
const MOCK = modeCopy(true)
const root = fileURLToPath(new URL('../..', import.meta.url))
const prompt = (name: string) => readFileSync(join(root, 'api', '_agent', 'prompts', `${name}.py`), 'utf8')
/** user_message 함수 본문(SYSTEM 원칙 글은 빼고 실제로 싣는 값만) */
const requestPart = (src: string) => src.slice(src.indexOf('def user_message'))

describe('실제 모드: 지금 시연에서도 AI 처리 기관(엔노이아)으로 넘어간다', () => {
  it('어느 글도 "실제 서비스에서"로 시점을 미루지 않는다', () => {
    for (const [key, text] of Object.entries(REAL)) expect(text, key).not.toContain('실제 서비스')
  })

  it('A4-05 /about-ai 머리: AI가 문장과 1차 면접 답 판정을 하고 지금 시연도 실제 AI(엔노이아)라고 말한다', () => {
    expect(REAL.aboutLead).toContain('1차 면접 정리에서는 들은 답이 내 기대와 맞는지도 AI가 판정해요.')
    expect(REAL.aboutLead).toContain('지금 시연도 실제 AI(엔노이아)가 쓰고, AI가 쓴 문장과 판정은 검사를 통과해야 화면에 나와요.')
  })

  it('A4-06 처리 단계 아래: AI 판정 3가지와 AI 응답이 없을 때의 단순 규칙을 나눠 말한다', () => {
    expect(REAL.aboutFinal).toContain('AI가 들은 답이 내 기대·걱정과 맞는지(확인됨·기대와 다름·아직 모름) 판정하고')
    expect(REAL.aboutFinal).toContain('AI 응답을 받지 못하면 답이 구체적이었는지만 보는 단순 규칙으로 판정해요.')
    expect(REAL.aboutFinal).toContain('회사를 평가하지 않아요')
  })

  it('A4-01 개인정보: 우리 서버로 보내는 것과 엔노이아로 넘기는 것, 시연에서도 넘어간다는 것', () => {
    expect(REAL.privacySend).toMatch(/^질문을 만들 때 우리 서버로 보내는 것은 고른 카드·경험 한 줄이고/)
    expect(REAL.privacySend).toContain('이력서 전체는 보내지 않아요.')
    expect(REAL.privacyAi).toMatch(/^우리 서버는 이 가운데 필요한 것만 AI 처리 기관\(엔노이아\)에 넘겨요\. 지금 시연에서도 실제로 넘어가요\./)
  })

  // 글이 말하는 것 ↔ AI 서버가 실제로 싣는 값(프롬프트 user_message)
  it('A4-01 AI로 넘기는 것이 프롬프트 요청 값과 맞는다(1차 · 판정 · 최종 문장)', () => {
    const first = requestPart(prompt('first'))
    const judge = requestPart(prompt('judge'))
    const final = requestPart(prompt('final'))
    // 공고 원문은 세 요청 모두
    for (const [name, src] of [['first', first], ['judge', judge], ['final', final]] as const) expect(src, name).toContain('<공고>')
    expect(REAL.privacyAi).toContain('공고 원문은 늘 함께 넘기고')
    // 1차: 카드와 기대·걱정(pref), 경험 한 줄은 붙일 질문(has_exp)이 있을 때만
    expect(first).toContain('"pref"')
    expect(first).toMatch(/if req\.experience\.strip\(\) and any\(i\.has_exp/)
    expect(REAL.privacyAi).toContain('1차 질문 때는 질문에 쓸 상위 5개 카드와 그 카드의 기대·걱정, 붙일 질문이 있을 때의 경험 한 줄을 넘겨요.')
    // 판정: 들은 답(heard) · 구체적이었는지(clarity) · 기대·걱정(pref)
    for (const f of ['i.heard', 'i.clarity', 'i.pref']) expect(judge, f).toContain(f)
    expect(REAL.privacyAi).toContain('답 판정에는 들은 답·구체적이었는지·기대·걱정을')
    // 최종 문장: 물어봤는지·회사가 물어본 업무(origin) · 1차 판정 결과(review_state) · 말투(tone·cushion), 들은 답은 없음
    for (const f of ['"origin"', '"review_state"', '"tone"', '"cushion"']) expect(final, f).toContain(f)
    expect(final).not.toMatch(/heard|들은 답/)
    expect(REAL.privacyAi).toContain('질문 문장에는 물어봤는지·회사가 물어본 업무·1차 판정 결과·면접 분위기에 맞춘 말투를 넘기고, 들은 답은 넘기지 않아요.')
  })

  it('A4-02 우리 서버와 AI 서버 둘 다 저장·기록하지 않는다고 말한다', () => {
    expect(REAL.privacyServer).toBe('우리 서버와 AI 서버는 경험 한 줄·들은 답·면접 분위기를 저장하거나 기록하지 않아요.')
  })

  it('A4-11·A4-12·A4-13 입력하는 자리와 바닥글도 AI로 보낸다고 지금 시점으로 말한다', () => {
    expect(REAL.experiencePrivacy).toBe('이름·학교·회사 이름은 빼고 적어 주세요. 적은 글은 이 브라우저에 저장되고, 질문을 만들 때 AI로 보내요.')
    expect(REAL.reviewPrivacy).toContain('"최종 질문 만들기"를 누르면 들은 답을 AI에 보내 내 기대·걱정과 맞는지(확인됨·기대와 다름·아직 모름) 판정하는 데만 쓰고')
    expect(REAL.reviewPrivacy).toContain('질문 문장을 쓸 때는 보내지 않아요.')
    expect(REAL.footerPrivacy).toBe('실제 개인정보는 입력하지 마세요. 고른 내용과 결과는 이 브라우저에만 저장되고, 질문을 만들 때는 AI로 보내요.')
  })

  it('A4-21 만드는 중 대기 안내와 A4-22 다시 만들기 안내', () => {
    expect(REAL.generatingWait).toBe('보통 10~25초 걸려요. 늦어지면 미리 검수한 문장으로 보여 드려요.')
    expect(REAL.remakeHint).toBe('"AI로 다시 만들기"를 누르면 AI 문장을 다시 받아 볼 수 있어요.')
  })
})

describe('가짜 응답 모드: 지난 글 그대로(PLAN-4 T4)', () => {
  const BEFORE: Omit<ModeCopy, 'generatingWait' | 'remakeHint'> = {
    aboutLead:
      '면접 역질문 준비는 AI 혼자 질문을 정하지 않아요. 공고 근거와 정해 둔 순서 규칙이 먼저 질문을 고르고, AI는 그 질문의 문장을 써요. AI가 쓴 문장도 검사를 통과해야 화면에 나와요.',
    aboutFinal:
      '1차 면접을 다녀와 물어본 질문과 들은 답을 정리하면, 아직 모르는 것과 처우(임금·근무시간·수습) 질문을 최종 면접용으로 다시 골라요. 들은 답은 구체적이었는지만 보고 회사를 평가하지 않아요. 걱정한 업무는 답이 구체적이어도 걱정이 풀렸는지 알 수 없어 아직 모름으로 남겨요.',
    privacySend:
      '실제 서비스에서 우리 서버로 보내는 것은 고른 카드·경험 한 줄이고, 최종 면접 준비 때는 1차 면접 정리(들은 답·못 물은 이유·면접 분위기·회사가 물어본 업무)까지예요. 이력서 전체는 보내지 않아요.',
    privacyAi:
      '실제 서비스에서 AI로 넘기는 것은 공고 원문과, 1차 질문 때는 질문에 쓸 상위 5개 카드와 그 카드의 기대·걱정, 붙일 질문이 있을 때의 경험 한 줄이에요. 최종 면접 준비 때 답 판정에는 들은 답·구체적이었는지·기대·걱정을, 질문 문장에는 물어봤는지·회사가 물어본 업무·1차 판정 결과·면접 분위기에 맞춘 말투를 넘기고, 들은 답은 넘기지 않아요.',
    privacyServer: '서버는 경험 한 줄·들은 답·면접 분위기를 저장하거나 기록하지 않아요.',
    experiencePrivacy: '이름·학교·회사 이름은 빼고 적어 주세요. 적은 글은 이 브라우저에 저장되고, 실제 서비스에서는 질문을 만들 때 AI로 보내요.',
    reviewPrivacy:
      '들은 답과 면접 분위기는 저장하지 않아요. 새로고침하면 지워지고, 만든 최종 질문만 이 브라우저에 남아요. 실제 서비스에서는 들은 답을 AI에 보내 내 기대·걱정과 맞는지(확인됨·기대와 다름·아직 모름)를 판정하는 데만 쓰고, 질문 문장을 쓸 때는 보내지 않아요. 면접관 이름이나 회사 내부 이야기는 빼고 적어 주세요.',
    footerPrivacy: '실제 개인정보는 입력하지 마세요. 고른 내용과 결과는 이 브라우저에만 저장돼요.',
  }

  it.each(Object.entries(BEFORE))('%s', (key, text) => {
    expect(MOCK[key as keyof ModeCopy]).toBe(text)
  })

  it('만드는 중 대기 안내는 없고(1.5초), 다시 만들기 안내는 가짜 문장을 "AI 문장"이라 부르지 않는다', () => {
    expect(MOCK.generatingWait).toBe('')
    expect(MOCK.remakeHint).toContain('"AI로 다시 만들기"')
    expect(MOCK.remakeHint).not.toContain('AI 문장')
  })
})

describe('문체', () => {
  it.each([
    ['실제', REAL],
    ['가짜 응답', MOCK],
  ] as const)('%s 모드: 화면 글은 해요체로 끝난다', (_name, copy) => {
    for (const [key, text] of Object.entries(copy)) if (text) expect(text, key).toMatch(/요\.$/)
  })
})

describe('② 경험 한 줄 안내(experienceHintText)', () => {
  const lead = EXPERIENCE_LEAD.trim()

  it('A4-18 비었을 때: 이력서 경험이 붙는 규칙(D-032)을 문장으로 풀어 쓴다(두 모드 같음)', () => {
    for (const mock of [false, true]) {
      const text = experienceHintText(mock, { kind: 'empty' })
      expect(text).toMatch(
        /^"기대돼요"를 고른 질문 하나 앞에 붙여요\. 이력서에서 가져온 경험은 그 경험과 이어진 업무를 "기대돼요"로 골랐다면 그 질문에 붙어요\. 비워 둬도 돼요\. /,
      )
      expect(text).not.toContain('(이력서 칩은')
      expect(text.endsWith(modeCopy(mock).experiencePrivacy)).toBe(true)
    }
  })

  it('A4-17 끝말을 이을 수 없을 때 — 실제 모드: AI가 경험을 살리고 검수 문장만 앞말로 바뀐다고 말한다', () => {
    const text = experienceHintText(false, { kind: 'lead', label: '신규 API 개발' })
    expect(text).toBe(
      `"신규 API 개발" 질문에 붙여요. AI 응답을 받지 못하면 검수 문장에는 경험 글 대신 "${lead}"가 붙어요. 경험 글을 그대로 넣으려면 "…해 봤습니다"나 "…했는데"처럼 끝내 주세요. ${REAL.experiencePrivacy}`,
    )
  })

  it('A4-17 끝말을 이을 수 없을 때 — 가짜 응답 모드: 앞말로 잇고, 맺는 끝말 예("…해 봤습니다")도 알린다', () => {
    const text = experienceHintText(true, { kind: 'lead', label: '신규 API 개발' })
    expect(text).toBe(
      `"신규 API 개발" 질문 앞에 "${lead}"로 이어요. 경험을 그대로 넣으려면 "…해 봤습니다"나 "…했는데"처럼 끝내 주세요. ${MOCK.experiencePrivacy}`,
    )
  })

  it('붙일 카드가 없을 때와 끝말을 이을 수 있을 때는 지난 글에 개인정보 줄만 모드대로', () => {
    expect(experienceHintText(false, { kind: 'no-target' })).toBe(`"기대돼요"를 고른 카드가 있으면 그 질문 앞에 붙여요. ${REAL.experiencePrivacy}`)
    expect(experienceHintText(true, { kind: 'quoted', label: '배포·서버 운영' })).toBe(`"배포·서버 운영" 질문 앞에 붙여요. ${MOCK.experiencePrivacy}`)
  })
})
