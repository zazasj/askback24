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
 * 경험 한 줄("…맡아 봤는데")을 맺는 문장("…맡아 봤어요.")으로 바꾼다.
 * 과거·있다·없다(받침 ㅆ·ㅄ) + "는데"만 확실히 바꿀 수 있어서 그 밖은 null(틀의 {anchor} 그대로 씀).
 */
export function experienceSentence(experience: string): string | null {
  const t = experience.trim().replace(/[,.\s]+$/, '')
  // 이미 맺은 문장("…경험이 있습니다", "…해 봤어요")은 그대로 맺는다
  if (/[다요]$/.test(t)) return `${t}.`
  const m = /^(.*)는데$/.exec(t)
  if (!m || !m[1]) return null
  const jong = finalConsonant(m[1].slice(-1))
  if (jong !== 20 && jong !== 18) return null
  return `${m[1]}어요.`
}

type Lead = (item: DraftItem) => string

const quoteOf = (item: DraftItem) => item.evidence?.quote ?? ''

/**
 * 유형별 앞말. 문장 끝에 공백을 둔다. 공고를 인용하는 앞말은 그 업무가 공고에 적힌(explicit) 카드와
 * 충돌 확인의 모호한 표현(vague)에만 쓴다. 유추한(inferred) 카드의 근거 문구는 질문 내용과 직접 이어지지 않아
 * ("고객사 상주 가능자" → 요구사항 협의) 인용하면 엉뚱해지고, 공고에 없는 카드(absent)는 공고를 말하지 않는다.
 */
const LEADS: Record<QType, (item: DraftItem) => readonly Lead[]> = {
  conflict: (item) => {
    const q = quoteOf(item)
    if (q && item.state === 'vague')
      return [
        () => `공고의 '${q}'${iraneun(q)} 표현이 어떤 업무까지 포함하는지 궁금했어요. `,
        () => `'${q}'${iraneun(q)} 문구의 범위를 미리 알고 싶어요. `,
      ]
    if (q && item.state === 'explicit')
      return [() => `공고에 '${q}'라고 적혀 있어 여쭤요. `, () => `'${q}' 부분을 보고 미리 확인하고 싶었어요. `]
    return [() => '입사 전에 꼭 확인하고 싶은 부분이 있어요. ', () => '미리 알아 두고 싶은 부분이 있어요. ']
  },
  prevent: () => [() => '혹시 몰라 미리 여쭤보고 싶어요. ', () => '미리 알아 두고 싶은 부분이 있어요. '],
  opportunity: () => [() => '꼭 해 보고 싶은 일이라 여쭤요. ', () => '제가 기대하는 일이라 궁금했어요. '],
  depth: (item) => {
    const q = quoteOf(item)
    if (q && item.state === 'explicit')
      return [() => `공고에서 '${q}' 부분을 보고 더 궁금해졌어요. `, () => `'${q}' 부분이 제가 기대하는 일과 맞닿아 있어 여쭤요. `]
    return [() => '기대하는 업무라 조금 더 자세히 여쭤요. ', () => '제가 해 보고 싶은 일이라 여쭤요. ']
  },
  explore: () => [() => '아직 잘 몰라서 여쭤보고 싶어요. ', () => '어떤 일인지 감이 오지 않아 여쭤요. '],
}

const EXP_BRIDGES = ['', '그 경험을 이어 가고 싶어서 여쭤요. '] as const

function pick<T>(list: readonly T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length] as T
}

export function mockSentence(item: DraftItem, experience: string, variant = 0): string {
  const n = variant + item.rank
  const rest = item.template.replace('{anchor}', '').trim()
  if (item.has_exp) {
    const said = experienceSentence(experience)
    // 문장으로 못 바꾸는 경험은 검수 문장 그대로: 끝말에 맞춰 잇거나 맺거나 중립 앞말을 쓴다(rules.ts experienceAnchor)
    return said ? `${said} ${pick(EXP_BRIDGES, n)}${rest}` : item.template_text
  }
  const lead = pick(LEADS[item.type](item), n)
  return `${lead(item)}${rest}`
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
  if (fixed?.state === 'mismatch') return { card_id: item.card_id, state: 'mismatch', basis: `${B.mismatch} · 주의할 답: ${item.watch_out}` }
  if (fixed?.state === 'confirmed') return { card_id: item.card_id, state: 'confirmed', basis: `${B.good_sign} · 좋은 신호: ${item.good_sign}` }
  if (fixed?.state === 'still_unknown') return { card_id: item.card_id, state: 'still_unknown', basis: B.asked_vague }
  return null
}

/**
 * 최종 질문 유형별 앞말. 1차 면접에서 들은 말을 가리키지 않는다.
 * 다시 확인 검수 문장은 물어본 질문·근거가 있는 질문이면 이미 앞말("지난 면접에 이어 …")을 품고 있어 겹쳐 붙이지 않는다.
 */
const FINAL_LEADS: Record<FinalQType, (item: FinalDraftItem) => readonly string[]> = {
  recheck: (item) =>
    item.origin === 'asked' || item.evidence ? [''] : ['꼭 여쭤보고 싶었던 부분이 있어요. ', '미리 알아 두고 싶은 부분이 있어요. '],
  signal: () => ['미리 준비해 두고 싶어 여쭤요. ', '맡게 될 일을 그려 보고 싶어요. '],
  scope: () => ['맡게 될 업무 범위를 분명히 알고 싶어요. ', '제가 맡게 될 일을 미리 그려 보고 싶어요. '],
  offer: () => ['근무 조건도 미리 알고 싶어요. ', '처우도 미리 확인하고 싶어요. '],
  opportunity: () => ['꼭 해 보고 싶은 일이라 여쭤요. ', '제가 기대하는 일이라 궁금했어요. '],
}

/**
 * 완충 문장 + 앞말 + 검수 문장. 표현 단계가 "직접"이면 앞말 없이 바로 묻는다.
 * 완충 문장이 있으면 앞말을 빼 면접에서 그대로 말할 수 있는 길이로 둔다(DR-r3-05).
 * nth = 앞말 순번(기본 순위). 처우 질문은 결과 안 처우 순번을 받아 연달아 같은 앞말이 나오지 않게 한다.
 */
export function mockFinalSentence(item: FinalDraftItem, variant = 0, nth = item.rank): string {
  const lead = item.tone === 'direct' || item.cushion ? '' : pick(FINAL_LEADS[item.type](item), variant + nth)
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
      return input.items.map((item) => {
        const draft: Draft = { card_id: item.card_id, text: mockSentence(item, input.experience, variant) }
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
      let offers = 0
      return input.items.map((item) => {
        const nth = item.type === 'offer' ? offers++ : item.rank
        const draft: FinalDraft = { key: item.key, text: mockFinalSentence(item, variant, nth) }
        if (item.evidence) draft.evidence = item.evidence
        return draft
      })
    },
  }
}
