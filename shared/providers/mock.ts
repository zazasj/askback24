/**
 * 가짜 공급자(LLM_PROVIDER=mock, 화면의 가짜 응답 모드). 검수 틀에 유형별 앞말을 붙이고
 * 경험 한 줄을 문장으로 풀어 "AI가 쓴 듯한" 문장을 만든다. 같은 입력·같은 variant 면 늘 같은 문장.
 */
import type { DraftItem, Draft, FirstDraftInput, LlmProvider } from './types'
import type { QType } from '../contract'

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
  const m = /^(.*)는데$/.exec(t)
  if (!m || !m[1]) return null
  const jong = finalConsonant(m[1].slice(-1))
  if (jong !== 20 && jong !== 18) return null
  return `${m[1]}어요.`
}

type Lead = (item: DraftItem) => string

const quoteOf = (item: DraftItem) => item.evidence?.quote ?? ''

/** 유형별 앞말. 문장 끝에 공백을 둔다. 공고에 없는 카드(absent)에는 공고를 말하지 않는다 */
const LEADS: Record<QType, (item: DraftItem) => readonly Lead[]> = {
  conflict: (item) => {
    const q = quoteOf(item)
    if (q && item.state === 'vague')
      return [
        () => `공고의 '${q}'${iraneun(q)} 표현이 어떤 업무까지 포함하는지 궁금했어요. `,
        () => `'${q}'${iraneun(q)} 문구의 범위를 미리 알고 싶어요. `,
      ]
    if (q && !item.template.startsWith('공고'))
      return [() => `공고에 '${q}'라고 적혀 있어 여쭤요. `, () => `'${q}' 부분을 보고 미리 확인하고 싶었어요. `]
    return [() => '입사 전에 꼭 확인하고 싶은 부분이 있어요. ', () => '미리 알아 두고 싶은 부분이 있어요. ']
  },
  prevent: () => [() => '혹시 몰라 미리 여쭤보고 싶어요. ', () => '미리 알아 두고 싶은 부분이 있어요. '],
  opportunity: () => [() => '꼭 해 보고 싶은 일이라 여쭤요. ', () => '제가 기대하는 일이라 궁금했어요. '],
  depth: (item) => {
    const q = quoteOf(item)
    if (q) return [() => `공고에서 '${q}' 부분을 보고 더 궁금해졌어요. `, () => `'${q}' 부분이 제가 기대하는 일과 맞닿아 있어 여쭤요. `]
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
    // 문장으로 못 바꾸는 경험은 검수 틀 그대로("…, 이 팀에서는")가 가장 자연스럽다
    return said ? `${said} ${pick(EXP_BRIDGES, n)}${rest}` : item.template_text
  }
  const lead = pick(LEADS[item.type](item), n)
  return `${lead(item)}${rest}`
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
  }
}
