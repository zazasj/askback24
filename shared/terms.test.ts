// 같은 예시 파일을 Python(api/_agent/tests/test_terms.py)도 읽는다 — 두 언어 낱말 찾기가 어긋나지 않게
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { termsIn, unknownIn } from './terms.js'

const { cases, unknown_cases } = JSON.parse(readFileSync(new URL('./fixtures/terms-cases.json', import.meta.url), 'utf8')) as {
  cases: { name?: string; text: string; expect: string[] }[]
  unknown_cases: { name: string; text: string; allowed: string; unknown: string[]; runtime: string[] }[]
}

describe('기술·분야 낱말 찾기 예시 파일', () => {
  it.each(cases.map((c) => [c.name ?? (c.text || '(빈 글)'), c] as const))('%s', (_name, c) => {
    expect(termsIn(c.text)).toEqual(c.expect)
  })
})

describe('허용 글에 없는 낱말(함의·실행 중 제외) 예시 파일', () => {
  it.each(unknown_cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(unknownIn(c.text, c.allowed)).toEqual(c.unknown)
    expect(unknownIn(c.text, c.allowed, { runtime: true })).toEqual(c.runtime)
  })
})
