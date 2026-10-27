// 같은 예시 파일을 Python 검사(api/_agent/tests/test_checks.py)도 읽는다 — 두 언어 규칙이 어긋나지 않게
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PostingState } from './contract.js'
import { getPosting } from './catalog.js'
import { checkFirstQuestion } from './validate.js'

interface Case {
  name: string
  posting: string
  text: string
  state: PostingState
  has_exp: boolean
  expect: string[]
}

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/validate-cases.json', import.meta.url), 'utf8')) as { cases: Case[] }

describe('검사 예시 파일', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(checkFirstQuestion({ text: c.text, state: c.state, has_exp: c.has_exp }, getPosting(c.posting)!)).toEqual(c.expect)
  })
})
