/**
 * 형원 전달용 AI API 명세서(docs/AI-API-명세서.md)가 코드와 어긋나지 않는지: 예시 JSON(지금 코드가 만든 값)에 있는
 * 필드가 모두 명세서 표에 `이름`으로 있어야 한다. 필드를 더하거나 바꾸면 명세서 표도 고치고 PDF를 다시 뽑는다(npm run docs:api-pdf).
 */
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const doc = readFileSync(join(ROOT, 'docs/AI-API-명세서.md'), 'utf8')
const example = (name: string) => JSON.parse(readFileSync(join(ROOT, 'docs/api-examples', `${name}.json`), 'utf8')) as Record<string, unknown>

/** 배열 항목의 필드는 `prefix[].key`, 객체 안 필드는 `prefix.key`로 모은다(posting 은 따로 본다) */
function fieldNames(value: unknown, prefix = ''): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item, `${p}[]`)
    } else if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) {
        const name = p ? `${p}.${k}` : k
        if (name === 'posting') continue
        out.add(name.replace(/^\[\]\./, ''))
        walk(child, name)
      }
    }
  }
  walk(value, prefix)
  return out
}

describe('AI API 명세서(형원 전달용) 표가 예시 JSON 필드를 모두 담는다', () => {
  const names = ['first-request', 'first-response', 'final-judgements-request', 'final-judgements-response', 'final-questions-request', 'final-questions-response']
  for (const name of names) {
    it(`${name}의 필드가 명세서 표에 있다`, () => {
      const missing = [...fieldNames(example(name))].filter((f) => !doc.includes(`\`${f}\``))
      expect(missing, `명세서에 없는 필드: ${missing.join(', ')}`).toEqual([])
    })
  }

  it('공고 posting 의 필드가 모두 「공고 posting 필드」 표에 있다', () => {
    const posting = example('first-request').posting as Record<string, unknown>
    const missing = Object.keys(posting).filter((k) => !doc.includes(`| \`${k}\` |`))
    expect(missing, `표에 없는 공고 필드: ${missing.join(', ')}`).toEqual([])
  })

  it('호출 주소 3가지가 있고 PDF가 함께 있다(명세서를 고치면 npm run docs:api-pdf)', () => {
    for (const path of ['/v1/first-questions', '/v1/final-judgements', '/v1/final-questions']) expect(doc).toContain(path)
    expect(statSync(join(ROOT, 'docs/AI-API-명세서.pdf')).size).toBeGreaterThan(10_000)
  })
})
