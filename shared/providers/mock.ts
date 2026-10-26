/**
 * 가짜 공급자(LLM_PROVIDER=mock, 화면의 가짜 응답 모드). 검수 틀에 유형별 앞말을 붙이고
 * 경험 한 줄을 문장으로 풀어 "AI가 쓴 듯한" 문장을 만든다. 같은 입력·같은 variant 면 늘 같은 문장.
 */
import type {
  DraftItem,
  Draft,
  FinalDraft,
  FinalDraftInput,
  FinalDraftItem,
  FirstDraftInput,
  JudgeInput,
  JudgeItem,
  Judgement,
  LlmProvider,
} from './types.js'
import type { FinalQType, QType } from '../contract.js'
import { FINAL_BOOK, REVIEW_EXAMPLE } from '../catalog.js'

export interface MockOptions {
  /** 응답 지연(ms). 화면은 1.5초 */
  delayMs?: number
  /** "AI로 다시 만들기"마다 1씩 늘려 앞말을 바꾼다 */
  variant?: number
  /** 시험용(?apiFail=1): 지연 뒤 예외를 던진다 */
  fail?: boolean
}

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

function finalConsonant(ch: string): number | null {
  const code = ch.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return null
  return (code - HANGUL_START) % 28
}

/** 따옴표 인용 뒤 "이라는/라는" */
function iraneun(quote: string): string {
  const jong = finalConsonant(quote.slice(-1))
  return jong !== null && jong > 0 ? '이라는' : '라는'
}

/**
 * 경험 한 줄("…맡아 봤는데")을 맺는 문장("…맡아 봤습니다.")으로 바꾼다(면접 비즈니스체, D-179).
 * 과거·있다·없다(받침 ㅆ·ㅄ) + "는데"만 확실히 바꿀 수 있어서 그 밖은 null(틀의 {anchor} 그대로 씀).
 */
export function experienceSentence(experience: string): string | null {
  const t = experience.trim().replace(/[,.\s]+$/, '')
  // 이미 맺은 문장("…경험이 있습니다", "…해 봤어요")은 구직자가 쓴 말이라 끝말을 바꾸지 않고 그대로 맺는다
  if (/[다요]$/.test(t)) return `${t}.`
  const m = /^(.*)는데$/.exec(t)
  if (!m || !m[1]) return null
  const jong = finalConsonant(m[1].slice(-1))
  if (jong !== 20 && jong !== 18) return null
  return `${m[1]}습니다.`
}

type Lead = (item: DraftItem) => string

const quoteOf = (item: DraftItem) => item.evidence?.quote ?? ''

/**
 * 유형별 앞말. 문장 끝에 공백을 둔다. 공고를 인용하는 앞말은 그 업무가 공고에 적힌(explicit) 카드와
 * 차이 확인(conflict)의 모호한 표현(vague)에만 쓴다. 유추한(inferred) 카드의 근거 문구는 질문 내용과 직접 이어지지 않아
 * ("고객사 상주 가능자" → 요구사항 협의) 인용하면 엉뚱해지고, 공고에 없는 카드(absent)는 공고를 말하지 않는다.
 */
/*
 * 앞말은 면접장에서 그대로 말할 수 있는 공손한 비즈니스체(…습니다)로 쓴다(D-179). "…궁금했어요"·"…여쭤요"처럼
 * 아쉬워하는 투나 혼잣말 투는 쓰지 않는다. 다섯 문항이 모두 "여쭙…"으로 끝나지 않게 끝말을 나눠 쓴다
 * (여쭙겠습니다 · 확인하고 싶습니다 · …업무입니다 · 듣고 싶습니다). 카드 틀이 "…궁금합니다"로 끝나기도 해서 앞말에는 쓰지 않는다.
 * 질문 본문(카드 틀)은 "…인가요?"·"…있나요?" 같은 공손한 질문형이다.
 */
const LEADS: Record<QType, (item: DraftItem) => readonly Lead[]> = {
  conflict: (item) => {
    const q = quoteOf(item)
    if (q && item.state === 'vague')
      return [
        () => `공고에 적힌 '${q}'에 어떤 업무까지 포함되는지 여쭙고 싶습니다. `,
        () => `'${q}'${iraneun(q)} 표현의 업무 범위를 조금 더 구체적으로 확인하고 싶습니다. `,
      ]
    if (q && item.state === 'explicit')
      return [
        () => `공고에 '${q}'${iraneun(q)} 조건이 있어 여쭙겠습니다. `,
        () => `공고의 '${q}' 부분과 관련해 확인하고 싶은 점이 있습니다. `,
      ]
    return [() => '업무 범위와 관련해 한 가지 여쭙겠습니다. ', () => '입사 전에 정확히 알아 두고 싶은 부분이 있습니다. ']
  },
  prevent: () => [() => '맡게 될 업무와 관련해 미리 확인하고 싶은 점이 있습니다. ', () => '근무 환경과 관련해 한 가지 확인하고 싶습니다. '],
  opportunity: () => [() => '입사하면 꼭 해 보고 싶은 업무라 여쭙겠습니다. ', () => '제가 특히 관심을 두고 있는 업무입니다. '],
  depth: (item) => {
    const q = quoteOf(item)
    if (q && item.state === 'explicit')
      return [
        () => `공고의 '${q}' 업무에 관심이 많아 조금 더 구체적으로 여쭙겠습니다. `,
        () => `'${q}' 업무를 맡게 된다면 어떻게 일하게 되는지 알고 싶습니다. `,
      ]
    return [() => '관심 있는 업무라 조금 더 구체적으로 여쭙겠습니다. ', () => '제가 기대하는 업무라 실제 모습을 듣고 싶습니다. ']
  },
  explore: () => [() => '팀에서 실제로 어떻게 진행되는지 배우고 싶어 여쭙겠습니다. ', () => '실무에서 꼭 배워 두고 싶은 업무입니다. '],
}

// 이음말은 "그 기술을 계속 쓰고 싶다"가 아니라 "배운 것을 살릴 수 있는가"로 묻는다(REVIEW-HOLD H2-15 ②)
const EXP_BRIDGES = ['', '그때 배운 것을 살릴 수 있을지 여쭙고 싶습니다. '] as const

function pick<T>(list: readonly T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length] as T
}

/** 따옴표 안 인용만 다른 앞말은 같은 앞말로 본다("'A' 업무를 맡게 된다면…"과 "'B' 업무를 맡게 된다면…") */
const leadKey = (lead: string) => lead.replace(/'[^']*'/g, "''")

/**
 * 순번(variant + 순위)의 앞말을 고르되, 한 결과 안에서 이미 쓴 앞말(used)이면 다음 것을 쓴다.
 * 같은 유형이 두 번 나와도(예: 1·3순위 둘 다 차이 확인) 같은 앞말이 되풀이되지 않게 한다. 다 썼으면 순번 그대로.
 */
function pickLead(leads: readonly string[], n: number, used?: Set<string>): string {
  for (let i = 0; i < leads.length; i++) {
    const lead = pick(leads, n + i)
    if (!used?.has(leadKey(lead))) {
      used?.add(leadKey(lead))
      return lead
    }
  }
  return pick(leads, n)
}

export function mockSentence(item: DraftItem, experience: string, variant = 0, used?: Set<string>): string {
  const n = variant + item.rank
  const rest = item.template.replace('{anchor}', '').trim()
  if (item.has_exp) {
    const said = experienceSentence(experience)
    // 문장으로 못 바꾸는 경험은 검수 문장 그대로: 끝말에 맞춰 잇거나 맺거나 중립 앞말을 쓴다(rules.ts experienceAnchor)
    return said ? `${said} ${pick(EXP_BRIDGES, n)}${rest}` : item.template_text
  }
  const lead = pickLead(LEADS[item.type](item).map((l) => l(item)), n, used)
  return `${lead}${rest}`
}

// ── 최종 면접 ─────────────────────────────────────────────────
/**
 * 가짜 판정: 예시 세트(data/review.example.json)의 들은 답·답 모양과 글자 그대로 같고 state 가 있으면 그 고정값만 낸다.
 * 그 밖은 판정하지 않아(null) 단순 규칙 결과(source: rule)가 그대로 남는다 — 규칙 판정이 AI 판정으로 보이지 않게(D-059).
 * "기대와 다름"은 실제 LLM 몫이라 예시 세트에서만 나온다.
 */
export function mockJudgement(item: JudgeItem): Judgement | null {
  const B = FINAL_BOOK.basis
  const fixed = REVIEW_EXAMPLE.asked.find(
    (e) => e.card_id === item.card_id && e.heard === item.heard.trim() && e.clarity === item.clarity && e.state,
  )
  if (fixed?.state === 'mismatch') {
    // 걱정한 카드에서 걱정이 맞은 것은 "걱정한 대로"로 말한다(H3-r2-02)
    const said = item.pref === 'avoid' ? B.mismatch_avoid : B.mismatch
    return { card_id: item.card_id, state: 'mismatch', basis: `${said} · 주의할 답: ${item.watch_out}` }
  }
  if (fixed?.state === 'confirmed') return { card_id: item.card_id, state: 'confirmed', basis: `${B.good_sign} · 좋은 신호: ${item.good_sign}` }
  if (fixed?.state === 'still_unknown') return { card_id: item.card_id, state: 'still_unknown', basis: B.asked_vague }
  return null
}

/**
 * 최종 질문 유형별 앞말. 1차 면접에서 들은 말을 가리키지 않는다. 1차 앞말처럼 공손한 비즈니스체(D-179).
 * 다시 확인 검수 문장은 물어본 질문·근거가 있는 질문이면 이미 앞말("지난 면접에 이어 …")을 품고 있어 겹쳐 붙이지 않는다.
 * 범위·신호 검수 문장은 "…여쭙고 싶습니다"로 끝나므로 앞말에는 "여쭙다"를 쓰지 않는다(한 질문에 두 번 겹치지 않게).
 */
const FINAL_LEADS: Record<FinalQType, (item: FinalDraftItem) => readonly string[]> = {
  recheck: (item) =>
    item.origin === 'asked' || item.evidence
      ? ['']
      : ['입사 전에 꼭 확인하고 싶은 점이 있습니다. ', '이번 기회에 꼭 여쭙고 싶은 부분이 있습니다. '],
  signal: () => ['입사 전에 미리 준비해 두고 싶은 부분이 있습니다. ', '맡게 될 업무를 구체적으로 알아 두고 싶습니다. '],
  scope: () => ['맡게 될 업무 범위를 분명히 알아 두고 싶습니다. ', '입사 후 제 역할을 구체적으로 그려 보고 싶습니다. '],
  // 처우 질문은 한 결과에 셋까지 나와서 앞말도 셋(이미 쓴 앞말은 건너뛰므로 셋이 모두 다르다)
  offer: () => ['근무 조건도 미리 확인하고 싶습니다. ', '처우와 관련해서도 한 가지 여쭙겠습니다. ', '한 가지 더 확인하고 싶은 조건이 있습니다. '],
  opportunity: () => ['입사하면 꼭 맡아 보고 싶은 업무라 여쭙겠습니다. ', '제가 특히 기대하고 있는 업무라 조금 더 여쭙겠습니다. '],
}

/**
 * 완충 문장 + 앞말 + 검수 문장. 표현 단계가 "직접"이면 앞말 없이 바로 묻는다.
 * 완충 문장이 있으면 앞말을 빼 면접에서 그대로 말할 수 있는 길이로 둔다(DR-r3-05).
 * 앞말은 1차처럼 순번(variant + 순위)으로 고르고, 한 결과 안에서 이미 쓴 앞말(used)은 건너뛴다.
 */
export function mockFinalSentence(item: FinalDraftItem, variant = 0, used?: Set<string>): string {
  const lead = item.tone === 'direct' || item.cushion ? '' : pickLead(FINAL_LEADS[item.type](item), variant + item.rank, used)
  return `${item.cushion}${lead}${item.template}`
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'))
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      },
      { once: true },
    )
  })
}

export function createMockProvider(options: MockOptions = {}): LlmProvider {
  const { delayMs = 0, variant = 0, fail = false } = options
  return {
    name: 'mock',
    async writeFirst(input: FirstDraftInput, signal: AbortSignal): Promise<Draft[]> {
      if (delayMs > 0) await wait(delayMs, signal)
      if (fail) throw new Error('mock provider failure')
      const used = new Set<string>()
      return input.items.map((item) => {
        const draft: Draft = { card_id: item.card_id, text: mockSentence(item, input.experience, variant, used) }
        if (item.evidence) draft.evidence = item.evidence
        return draft
      })
    },
    // 최종 면접은 판정·문장 두 번 부르므로 지연을 반씩 나눈다(합계는 1차와 같음)
    async judgeReview(input: JudgeInput, signal: AbortSignal): Promise<Judgement[]> {
      if (delayMs > 0) await wait(Math.round(delayMs / 2), signal)
      if (fail) throw new Error('mock provider failure')
      return input.items.flatMap((item) => mockJudgement(item) ?? [])
    },
    async writeFinal(input: FinalDraftInput, signal: AbortSignal): Promise<FinalDraft[]> {
      if (delayMs > 0) await wait(delayMs - Math.round(delayMs / 2), signal)
      if (fail) throw new Error('mock provider failure')
      const used = new Set<string>()
      return input.items.map((item) => {
        const draft: FinalDraft = { key: item.key, text: mockFinalSentence(item, variant, used) }
        if (item.evidence) draft.evidence = item.evidence
        return draft
      })
    },
  }
}
