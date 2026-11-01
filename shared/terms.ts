/**
 * 글에 나온 기술·분야 낱말의 id 를 목록 순서대로 돌려준다. 평가(지어낸 낱말 지표)와 실행 중 질문 검사가 같이 쓴다.
 * Python(api/_agent/terms.py)과 같은 규칙이고 shared/fixtures/terms-cases.json 이 둘을 묶는다.
 */
import termsJson from '../data/tech-terms.json' with { type: 'json' }

/** 글자만 쓰면 기본 규칙. 객체는 다음 두 가지를 더할 수 있다 */
type Form =
  | string
  | {
      text: string
      /** 이 글이 뒤따르면 맞지 않는다(자바-자바스크립트) */
      exclude_after?: string[]
      /** 대소문자를 가린다(Go·REST·SI·SM 이 일반 영어 낱말과 섞이지 않게) */
      case_sensitive?: boolean
    }

interface Term {
  id: string
  forms: Form[]
}

const LATIN = /[A-Za-z]/
// 띄어쓰기는 있어도 없어도 같게, `.`·`-` 는 있어도 없어도 같게 본다(Node.js = NodeJS = node js)
const SEP = '[.\\-]?'
const GAP = '\\s*'

function body(text: string): string {
  const parts = [...text.replace(/\s+/g, '')].map((ch) => (ch === '.' || ch === '-' ? SEP : ch.replace(/[\\^$*+?()|[\]{}/]/g, '\\$&')))
  return parts.join(GAP)
}

function formPattern(form: Form): RegExp {
  const f = typeof form === 'string' ? { text: form } : form
  let re = body(f.text)
  // 짧은 영어 낱말이 다른 영어 낱말 안에서 걸리지 않게(SM-SMS, Go-Google). 한글 낱말은 포함만 본다.
  // 뒤에 오는 숫자는 버전(Java8·Python3.11·Oracle11g)으로 보고 막지 않는다
  if (LATIN.test(f.text)) re = `(?<![A-Za-z0-9])${re}(?![A-Za-z])`
  for (const ex of f.exclude_after ?? []) re += `(?!${GAP}${body(ex)})`
  return new RegExp(re, 'case_sensitive' in f && f.case_sensitive ? '' : 'i')
}

const COMPILED = (termsJson.terms as Term[]).map((t) => ({ id: t.id, patterns: t.forms.map(formPattern) }))

export function termsIn(text: string): string[] {
  return COMPILED.filter((t) => t.patterns.some((p) => p.test(text))).map((t) => t.id)
}
