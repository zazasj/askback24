/**
 * 공고 원문(직무내용 같은 긴 글)을 줄 단위로 나눠 그린다. v-html 없이 줄바꿈·소제목·목록 기호를 원문 그대로 보이게.
 * 형광펜 조각(splitByQuotes)을 받아 줄마다 잘라 주므로 형광펜은 그 줄 문단 안에 그대로 남는다.
 * 줄 글자는 바꾸지 않는다(앞 공백만 들여쓰기로 바꿈). 모양(소제목·목록)은 글자에서 짐작만 하고 기호는 지우지 않는다.
 */

/** highlight.ts Segment 와 같은 모양(형광펜이 없으면 cardIds 가 빈 배열) */
export interface TextSegment {
  text: string
  start: number
  cardIds: string[]
}

export type LineKind = 'head' | 'item' | 'note' | 'text'

export interface TextPiece {
  /** 이 줄에 들어가는 글자(조각이 줄을 넘으면 그 줄 몫만) */
  text: string
  /** 원래 조각. 형광펜 열쇠·카드는 여기서 읽는다 */
  seg: TextSegment
}

export interface PostingLine {
  /** 원문 안 줄 번호(빈 줄 포함) */
  index: number
  kind: LineKind
  /** 앞에 공백을 두고 쓴 줄(하위 항목) */
  sub: boolean
  /** 원문에서 바로 앞이 빈 줄(문단 사이) */
  gap: boolean
  pieces: TextPiece[]
}

const HEAD_GLYPH = /^[■□▣◆◇▶▷►★☆▪]/
const BRACKET_ONLY = /^[[【〔〈《<][^\]】〕〉》>]{1,30}[\]】〕〉》>]$/
const LIST_MARK = /^(?:[-–—·•*○●◦]|\d{1,2}\s*[.)]|[①-⑳]|\(\d{1,2}\))/
const NUMBER_DOT = /^\d{1,2}\.\s*/
const NOTE_MARK = /^※/
/** 기호 없이 쓴 소제목("회사 소개" "하는 일")을 알아볼 낱말 */
const SECTION_WORD = /소개|개요|업무|하는\s*일|요건|자격|우대|복지|복리|혜택|절차|전형|근무|조건|환경|방식|모집|안내|제출|서류|기타/
const SENTENCE_END = /[.!?。…:,]$|[다요죠]$/
const HEAD_MAX = 16

/**
 * 줄 모양. 기호(■ □ ▶ · [ ])로 시작하는 소제목은 그대로 소제목, 기호 없는 짧은 줄은
 * 빈 줄 뒤에 오고 바로 아래 글이 이어지며 소제목 낱말이 있을 때만 소제목으로 본다("1. 회사 소개"도 같음).
 */
export function lineKind(text: string, ctx: { afterBreak: boolean; beforeText: boolean }): LineKind {
  if (HEAD_GLYPH.test(text) || BRACKET_ONLY.test(text)) return 'head'
  const numbered = NUMBER_DOT.exec(text)
  if (numbered || !LIST_MARK.test(text)) {
    const body = numbered ? text.slice(numbered[0].length) : text
    if (ctx.afterBreak && ctx.beforeText && [...body].length <= HEAD_MAX && SECTION_WORD.test(body) && !SENTENCE_END.test(body)) return 'head'
  }
  if (NOTE_MARK.test(text)) return 'note'
  if (LIST_MARK.test(text)) return 'item'
  return 'text'
}

/** 조각들을 원문 줄로 나눈다. 빈 줄은 줄로 만들지 않고 다음 줄의 gap 으로 남긴다 */
export function postingLines(segments: readonly TextSegment[]): PostingLine[] {
  const raw: TextPiece[][] = [[]]
  for (const seg of segments) {
    seg.text.split('\n').forEach((part, i) => {
      if (i > 0) raw.push([])
      const text = part.replace(/\r$/, '')
      if (text) raw[raw.length - 1]?.push({ text, seg })
    })
  }
  const textOf = (i: number) => (raw[i] ?? []).map((p) => p.text).join('')
  const filled = (i: number) => i >= 0 && i < raw.length && textOf(i).trim() !== ''

  const out: PostingLine[] = []
  let gap = false
  raw.forEach((pieces, index) => {
    const full = textOf(index)
    if (!full.trim()) {
      if (out.length) gap = true
      return
    }
    out.push({
      index,
      kind: lineKind(full.trim(), { afterBreak: !filled(index - 1), beforeText: filled(index + 1) }),
      sub: /^[\s　]/.test(full),
      gap,
      pieces: trimPieces(pieces),
    })
    gap = false
  })
  return out
}

/** 줄 앞뒤 공백만 걷어 낸다. 형광펜 조각은 글이 남아 있으면 지우지 않는다 */
function trimPieces(pieces: readonly TextPiece[]): TextPiece[] {
  const out = pieces.map((p) => ({ ...p }))
  while (out[0] && !out[0].text.replace(/^[\s　]+/, '')) out.shift()
  if (out[0]) out[0].text = out[0].text.replace(/^[\s　]+/, '')
  while (out.length && !out[out.length - 1]?.text.replace(/[\s　]+$/, '')) out.pop()
  const last = out[out.length - 1]
  if (last) last.text = last.text.replace(/[\s　]+$/, '')
  return out
}

/**
 * 고른 조각이 들어 있는 마지막 줄 번호(S4 ① 형광펜 설명을 그 줄 바로 밑에 펼칠 자리).
 * 조각이 줄을 넘으면 끝 줄 밑 한 곳만. 없으면 null.
 */
export function lastLineOf(lines: readonly PostingLine[], hit: (seg: TextSegment) => boolean): number | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line?.pieces.some((p) => hit(p.seg))) return line.index
  }
  return null
}

/** 형광펜 없는 글 한 덩이(S3 상세처럼 칠하지 않는 곳) */
export const plainSegments = (text: string): TextSegment[] => (text ? [{ text, start: 0, cardIds: [] }] : [])
