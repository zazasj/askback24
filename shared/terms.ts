/**
 * 글에 나온 기술·분야 낱말의 id 를 목록 순서대로 돌려준다. 평가(지어낸 낱말 지표)와 실행 중 질문 검사가 같이 쓴다.
 * Python(api/_agent/terms.py)과 같은 규칙이고 shared/fixtures/terms-cases.json 이 둘을 묶는다.
 */
import termsJson from '../data/tech-terms.json' with { type: 'json' }

interface Term {
  id: string
  forms: string[]
}

const LATIN = /[A-Za-z]/
// 띄어쓰기는 있어도 없어도 같게, `.`·`-` 는 있어도 없어도 같게 본다(Node.js = NodeJS = node js)
const SEP = '[.\\-]?'
const GAP = '\\s*'

function formPattern(form: string): RegExp {
  const parts = [...form.replace(/\s+/g, '')].map((ch) => (ch === '.' || ch === '-' ? SEP : ch.replace(/[\\^$*+?()|[\]{}/]/g, '\\$&')))
  const body = parts.join(GAP)
  // 짧은 영어 낱말이 다른 영어 낱말 안에서 걸리지 않게(SM-SMS, Go-Google). 한글 낱말은 포함만 본다
  return new RegExp(LATIN.test(form) ? `(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])` : body, 'i')
}

const COMPILED = (termsJson.terms as Term[]).map((t) => ({ id: t.id, patterns: t.forms.map(formPattern) }))

export function termsIn(text: string): string[] {
  return COMPILED.filter((t) => t.patterns.some((p) => p.test(text))).map((t) => t.id)
}
