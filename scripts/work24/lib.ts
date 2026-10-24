/**
 * fetch-work24 의 순수 함수(네트워크·파일 없음). 단위 시험(lib.test.ts)이 같이 쓴다.
 * Node 가 타입만 지우고 바로 돌리므로(--experimental-strip-types) enum·namespace 같은 문법은 쓰지 않는다.
 */
import { createHash } from 'node:crypto'

export const BASE_URL = 'https://www.work24.go.kr/cm/openApi/call/wk/'

export type Svc = '215L01' | '212D01' | '21L01' | '216L01'

/** 서비스마다 승인 키가 따로다. 키 값은 .env 에만 있다 */
export const KEY_ENV: Record<Svc, string> = {
  '215L01': 'WORK24_KEY_DUTY',
  '212D01': 'WORK24_KEY_JOB',
  '21L01': 'WORK24_KEY_COMMONCODE',
  '216L01': 'WORK24_KEY_SMALLGIANT',
}

export interface Req {
  svc: Svc
  /** 캐시 파일 이름 앞부분(사람이 알아보는 이름) */
  hint: string
  /** authKey 를 뺀 요청 값 */
  params: Record<string, string>
}

export const isJsonReq = (req: Req): boolean => (req.params.returnType ?? '').toUpperCase() === 'JSON'

/** authKey 를 뺀 요청 값을 이름순으로 — 캐시 이름이 키에 따라 바뀌지 않게 */
export function canonicalParams(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k.toLowerCase() !== 'authkey')
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k] ?? '')}`)
    .join('&')
}

/** .cache/work24 안의 상대 경로: <서비스>/<hint>-<요청 값 해시>.<json|xml> */
export function cacheRel(req: Req): string {
  const hash = createHash('sha1').update(`${req.svc}?${canonicalParams(req.params)}`).digest('hex').slice(0, 10)
  const hint = req.hint.replace(/[^0-9A-Za-z_-]/g, '_')
  return `${req.svc}/${hint}-${hash}.${isJsonReq(req) ? 'json' : 'xml'}`
}

export function requestUrl(req: Req, key: string): string {
  // 띄어쓰기는 %20 으로(+ 를 공백으로 읽지 않는 서버도 있어서)
  const qs = Object.entries({ authKey: key, ...req.params })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return `${BASE_URL}callOpenApiSvcInfo${req.svc}.do?${qs}`
}

/** 출력에 키가 섞이지 않게 가린다 */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text.replace(/(authKey=)[^&\s"'<>]+/gi, '$1***')
  for (const s of secrets) if (s) out = out.split(s).join('***')
  return out
}

/** "2026-10-25"(한국 시간) */
export function kstDate(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

// ── XML ───────────────────────────────────────────────────────
export interface XmlNode {
  name: string
  children: XmlNode[]
  text: string
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 응답 XML 을 나무로. 속성은 쓰지 않아 버린다. 글은 엔티티를 풀어 그대로(앞뒤 공백 포함) 둔다 */
export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: '#root', children: [], text: '' }
  const stack: XmlNode[] = [root]
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)[^>]*?(\/?)>|([^<]+)/g
  for (const m of src.matchAll(re)) {
    const top = stack[stack.length - 1] ?? root
    if (m[1] !== undefined) top.text += m[1]
    else if (m[2] !== undefined) {
      const i = stack.map((n) => n.name).lastIndexOf(m[2])
      if (i > 0) stack.length = i
    } else if (m[3] !== undefined) {
      const node: XmlNode = { name: m[3], children: [], text: '' }
      top.children.push(node)
      if (m[4] !== '/') stack.push(node)
    } else if (m[5] !== undefined) top.text += decodeEntities(m[5])
  }
  return root
}

export function findAll(node: XmlNode, name: string, out: XmlNode[] = []): XmlNode[] {
  for (const c of node.children) {
    if (c.name === name) out.push(c)
    findAll(c, name, out)
  }
  return out
}

/** 바로 아래 자식 중 이름이 같은 첫 노드의 글 */
export function childText(node: XmlNode, name: string): string | undefined {
  return node.children.find((c) => c.name === name)?.text
}

/** 자식 노드가 없는 바로 아래 노드들을 { 이름: 글 } 로 */
export function leafRecord(node: XmlNode): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of node.children) if (c.children.length === 0 && !(c.name in out)) out[c.name] = c.text
  return out
}

/** 오류 응답이면 그 글(태그 뺀 것), 아니면 null. XML <error>, JSON error·message_cd 키, JSON 이어야 하는데 아닌 것 */
export function responseError(text: string, json: boolean): string | null {
  const body = text.replace(/^﻿/, '').trim()
  if (!body) return '빈 응답'
  if (body.startsWith('<')) {
    const m = /<error[^>]*>([\s\S]*?)<\/error>/i.exec(body) ?? /<(?:errMsg|errorMsg|message)[^>]*>([\s\S]*?)<\/(?:errMsg|errorMsg|message)>/i.exec(body)
    if (m) return decodeEntities((m[1] ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || 'error'
    if (/<error\b/i.test(body)) return 'error'
    return json ? 'JSON 대신 XML 응답' : null
  }
  if (!json) return 'XML 이 아닌 응답'
  try {
    const v = JSON.parse(body) as unknown
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      for (const k of ['error', 'errorMsg', 'errMsg']) if (o[k]) return String(typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k])
      // 직무정보는 오류를 {"message_cd":"011","message":"키워드가 입력되지 않았습니다."}로 준다(10-25 실측)
      if (!('result' in o) && ('message_cd' in o || 'message' in o)) return `${String(o.message_cd ?? '')} ${String(o.message ?? '')}`.trim()
    }
    return null
  } catch {
    return 'JSON 해석 실패'
  }
}

// ── 직무정보(215L01) → 업무 카드 NCS ────────────────────────────
export type Flat = Record<string, string>

/** JSON 응답에서 능력단위 항목(ablt_def 가 든 객체)을 응답 순서대로 */
export function ncsItems(json: unknown): Flat[] {
  const out: Flat[] = []
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if ('ablt_def' in o) {
        const flat: Flat = {}
        for (const [k, x] of Object.entries(o)) if (typeof x === 'string' || typeof x === 'number') flat[k] = String(x)
        out.push(flat)
      } else Object.values(o).forEach(walk)
    }
  }
  walk(json)
  return out
}

/** 이름 비교용: 괄호(능력단위요소) 빼고, 띄어쓰기·가운뎃점 없애고, 소문자 */
export function nameKey(s: string): string {
  return s
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s·・‧.,_-]/g, '')
    .toLowerCase()
}

function bigrams(s: string): string[] {
  if (s.length < 2) return s ? [s] : []
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

/** 두 글자씩 겹치는 정도(Dice, 0~1) */
export function similarity(a: string, b: string): number {
  const x = bigrams(nameKey(a))
  const y = bigrams(nameKey(b))
  if (x.length === 0 || y.length === 0) return 0
  const pool = [...y]
  let hit = 0
  for (const g of x) {
    const i = pool.indexOf(g)
    if (i >= 0) {
      hit++
      pool.splice(i, 1)
    }
  }
  return (2 * hit) / (x.length + y.length)
}

/** 이 값 밑이면 "맞는 능력단위를 찾지 못함"(matched: false) */
export const MATCH_MIN = 0.6

export interface NcsPick {
  rank: number
  item: Flat
  existing: string
  score: number
  how: 'same' | 'closest'
}

/**
 * 응답 상위 결과 중 기존 능력단위명과 같거나 가장 가까운 것.
 * 같은 이름이 있으면 그중 응답 순위가 높은 것, 없으면 닮은 정도가 가장 큰 것(같으면 순위가 높은 것).
 */
export function pickNcs(items: readonly Flat[], existing: readonly string[], nameField: string): NcsPick | null {
  let best: NcsPick | null = null
  items.forEach((item, i) => {
    const name = item[nameField] ?? ''
    if (!name) return
    for (const ex of existing) {
      const same = nameKey(name) === nameKey(ex)
      const score = same ? 1 : similarity(name, ex)
      const cand: NcsPick = { rank: i + 1, item, existing: ex, score, how: same ? 'same' : 'closest' }
      if (!best || score > best.score || (score === best.score && cand.rank < best.rank)) best = cand
    }
  })
  const b = best as NcsPick | null
  return b && b.score >= MATCH_MIN ? b : null
}

// ── 직업정보(212D01) ─────────────────────────────────────────
/** 앞에서부터 문장을 모아 max 글자를 넘지 않게(첫 문장은 넘어도 넣는다) */
export function leadSentences(text: string, max: number): string {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。])\s+/)
    .filter(Boolean)
  let out = ''
  for (const s of sentences) {
    if (!out) out = s
    else if (out.length + 1 + s.length <= max) out += ` ${s}`
    else break
  }
  return out
}

// ── 강소기업(216L01) ─────────────────────────────────────────
/** 인증 종류 글을 낱개로("A, B" "A|B" 모두) */
export function splitBrands(s: string): string[] {
  return s
    .split(/[,|/]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function countBy<T>(list: readonly T[], keyOf: (x: T) => string[]): Array<{ key: string; count: number }> {
  const m = new Map<string, number>()
  for (const x of list) for (const k of keyOf(x)) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'ko'))
}
