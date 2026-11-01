// 같은 예시 파일을 Python 검사(api/_agent/tests/test_checks.py)도 읽는다 — 두 언어 규칙이 어긋나지 않게
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PostingState } from './contract.js'
import { getPosting } from './catalog.js'
import { judgementIssues } from './generate.js'
import { checkFinalQuestion, checkFirstQuestion } from './validate.js'

interface FirstCase {
  kind?: 'first'
  name: string
  posting: string
  text: string
  state: PostingState
  has_exp: boolean
  expect: string[]
}
interface FinalCase {
  kind: 'final'
  name: string
  posting: string
  text: string
  state: PostingState | null
  expect: string[]
}
interface JudgementCase {
  kind: 'judgement'
  name: string
  basis: string
  state: string
  heard: string[]
  expect: string[]
}
type Case = FirstCase | FinalCase | JudgementCase

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/validate-cases.json', import.meta.url), 'utf8')) as { cases: Case[] }

// generate.ts 와 Python 그래프처럼 공백을 한 칸으로 줄인 뒤 검사한다
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim()

describe('검사 예시 파일', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    if (c.kind === 'judgement') {
      // 근거의 공백 줄이기는 judgementIssues 안에서 한다
      expect(judgementIssues(c.basis, c.state, c.heard)).toEqual(c.expect)
    } else if (c.kind === 'final') {
      // 들은 답 대조는 Python 이 못 하므로 예시에는 넣지 않는다
      const q: Parameters<typeof checkFinalQuestion>[0] = { text: squash(c.text) }
      if (c.state) q.state = c.state
      expect(checkFinalQuestion(q, getPosting(c.posting)!, [])).toEqual(c.expect)
    } else {
      expect(checkFirstQuestion({ text: squash(c.text), state: c.state, has_exp: c.has_exp }, getPosting(c.posting)!)).toEqual(c.expect)
    }
  })
})
