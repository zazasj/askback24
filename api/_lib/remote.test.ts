/**
 * AS-07 LLM_PROVIDER=remote: 우리 서버가 {AI_ENDPOINT}/v1/… 세 주소를 명세(docs/API-SPEC.md)대로 부른다. 가짜 fetch 로만 돈다(네트워크 없음).
 * _lib 안에 두는 것은 Vercel 이 이 파일을 주소로 만들지 않게 하려는 것.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REVIEW_EXAMPLE } from '../../shared/catalog.ts'
import type { FinalQuestionsResponse, FirstQuestionsResponse } from '../../shared/contract.ts'
import { generateFinal, generateFirst, type GenerateReport } from '../../shared/generate.ts'
import { REMOTE_PATHS, createRemoteProvider } from '../../shared/providers/remote.ts'
import { buildApiExamples, type ApiExampleName } from '../../scripts/apiExamples.ts'
import { POST } from '../questions.ts'
import { handleQuestions, type Logger } from './handler.ts'
import { providerFor, type ServerEnv } from './provider.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const KEY = 'sk-test-REMOTE-0000-secret'
const ENDPOINT = 'https://ai.example.test/'
const BASE = 'https://ai.example.test'
const ENV: ServerEnv = { LLM_PROVIDER: 'remote', AI_ENDPOINT: ENDPOINT, AI_API_KEY: KEY }
const HEARDS = REVIEW_EXAMPLE.asked.map((a) => a.heard)

const example = <T = Record<string, unknown>>(name: ApiExampleName): T =>
  JSON.parse(readFileSync(join(root, 'docs/api-examples', `${name}.json`), 'utf8')) as T
const { screen } = await buildApiExamples()

interface Call {
  url: string
  method: string
  headers: Headers
  body: unknown
}

type Respond = (path: string, body: unknown) => Response | Promise<Response>

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })

/** 예시 응답을 그대로 돌려주는 AI 담당 서버 */
const exampleServer: Respond = (path) => {
  if (path === REMOTE_PATHS.first) return json(example('first-response'))
  if (path === REMOTE_PATHS.judge) return json(example('final-judgements-response'))
  if (path === REMOTE_PATHS.final) return json(example('final-questions-response'))
  return json({ error: { code: 'not_found', message: 'no such path' } }, 404)
}

function stubFetch(respond: Respond): Call[] {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const body: unknown = JSON.parse(String(init?.body))
      calls.push({ url, method: init?.method ?? 'GET', headers: new Headers(init?.headers), body })
      return respond(new URL(url).pathname, body)
    }),
  )
  return calls
}

function memoryLog(): Logger & { lines: string[] } {
  const lines: string[] = []
  return { lines, info: (m) => lines.push(m), error: (m) => lines.push(m) }
}

const post = (body: unknown) =>
  new Request('http://localhost/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

async function askFirst(env: ServerEnv = ENV) {
  const log = memoryLog()
  const res = await handleQuestions(post(screen.first), env, log)
  const text = await res.text()
  return { status: res.status, text, body: JSON.parse(text) as FirstQuestionsResponse, logs: log.lines.join('\n') }
}

async function askFinal(env: ServerEnv = ENV) {
  const log = memoryLog()
  const res = await handleQuestions(post(screen.final), env, log)
  const text = await res.text()
  return { status: res.status, text, body: JSON.parse(text) as FinalQuestionsResponse, logs: log.lines.join('\n') }
}

const sources = (qs: ReadonlyArray<{ source: string }>) => qs.map((q) => q.source)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('AS-07 (a) 정상 응답 → source: "ai"', () => {
  it('AS-07 (a) 1차: POST {AI_ENDPOINT}/v1/first-questions 한 번, 질문 5개 모두 ai', async () => {
    const calls = stubFetch(exampleServer)
    const { status, body, logs } = await askFirst()
    expect(status).toBe(200)
    expect(calls.map((c) => [c.method, c.url])).toEqual([['POST', `${BASE}/v1/first-questions`]])
    expect(sources(body.questions)).toEqual(['ai', 'ai', 'ai', 'ai', 'ai'])
    expect(body.questions.map((q) => q.card_id)).toEqual(['BE15', 'BE07', 'BE02', 'BE03', 'BE01'])
    expect(logs).toMatch(/^\[questions\] mode=first provider=remote n=5 template=0 /)
  })

  it('AS-07 (a) 최종: 판정 → 문장 순서로 두 번, 물어본 카드 판정과 최종 질문 모두 ai', async () => {
    const calls = stubFetch(exampleServer)
    const { status, body, logs } = await askFinal()
    expect(status).toBe(200)
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/v1/final-judgements`, `${BASE}/v1/final-questions`])
    expect(body.final_questions.length).toBeGreaterThan(0)
    expect(body.final_questions.every((q) => q.source === 'ai')).toBe(true)
    const asked = body.card_states.filter((s) => REVIEW_EXAMPLE.asked.some((a) => a.card_id === s.card_id))
    expect(asked.map((s) => [s.card_id, s.state, s.source])).toEqual([
      ['BE15', 'still_unknown', 'ai'],
      ['BE07', 'mismatch', 'ai'],
      ['BE02', 'confirmed', 'ai'],
      ['BE01', 'confirmed', 'ai'],
    ])
    expect(body.summary).toEqual({ confirmed: 2, mismatch: 1, still_unknown: 2, company_signal: 1 })
    expect(logs).toMatch(/provider=remote .*template=0 .*judged=4/)
  })
})

describe('AS-07 (b) 모양이 틀린 항목만 검수 문장', () => {
  it('AS-07 (b) 1차: text 가 글이 아님 · card_id 없음 · evidence 칸이 모르는 이름 → 그 셋만 template', async () => {
    const good = example<{ questions: Array<Record<string, unknown>> }>('first-response').questions
    const bent = good.map((q, i) => {
      if (i === 0) return { ...q, text: 123 }
      if (i === 1) return { text: q.text, evidence: q.evidence }
      if (i === 2) return { ...q, evidence: { field: 'title', quote: '서비스' } }
      if (i === 3) return { ...q, evidence: null, note: '모르는 키는 버린다' }
      return q
    })
    stubFetch((path) => (path === REMOTE_PATHS.first ? json({ questions: bent }) : exampleServer(path, null)))
    const { body } = await askFirst()
    expect(sources(body.questions)).toEqual(['template', 'template', 'template', 'ai', 'ai'])
    expect(body.questions[3]?.text).toBe(good[3]?.text)
  })

  it('AS-07 (b) 최종: state·basis 가 틀린 판정은 단순 규칙, key·text 가 틀린 문장은 검수 문장', async () => {
    // 단순 규칙도 같은 상태(BE15 아직 모름 · BE02 확인됨)라 질문 순서는 예시 그대로다
    const judgements = example<{ judgements: Array<Record<string, unknown>> }>('final-judgements-response').judgements.map((j) => {
      if (j.card_id === 'BE15') return { ...j, state: 'maybe' }
      if (j.card_id === 'BE02') return { ...j, basis: 3 }
      return j
    })
    const questions = example<{ questions: Array<Record<string, unknown>> }>('final-questions-response').questions.map((q, i) => {
      if (i === 0) return { text: q.text }
      if (i === 1) return { ...q, text: null }
      return q
    })
    stubFetch((path) => {
      if (path === REMOTE_PATHS.judge) return json({ judgements })
      if (path === REMOTE_PATHS.final) return json({ questions })
      return exampleServer(path, null)
    })
    const { body } = await askFinal()
    const state = (id: string) => body.card_states.find((s) => s.card_id === id)
    expect(state('BE15')?.source).toBe('rule')
    expect(state('BE02')?.source).toBe('rule')
    expect(state('BE07')?.source).toBe('ai')
    expect(state('BE01')?.source).toBe('ai')
    expect(body.final_questions.map((q) => q.card_id ?? `offer:${q.topic}`)).toEqual(
      example<{ questions: Array<{ key: string }> }>('final-questions-response').questions.map((q) => q.key),
    )
    const src = sources(body.final_questions)
    expect(src.slice(0, 2)).toEqual(['template', 'template'])
    expect(src.slice(2).every((s) => s === 'ai')).toBe(true)
  })
})

describe('AS-07 (c) 시간 초과·5xx·JSON 아님 → 모두 검수 문장, 최종 판정은 단순 규칙', () => {
  const broken: Array<[string, Respond]> = [
    ['503 + 오류 형식', () => json({ error: { code: 'unavailable', message: 'model is loading' } }, 503)],
    ['401', () => json({ error: { code: 'unauthorized', message: 'bad key' } }, 401)],
    ['JSON 아님', () => new Response('<html>busy</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })],
    ['바깥 모양이 틀림', () => json({ result: [] })],
    ['네트워크 오류', () => Promise.reject(new TypeError('fetch failed'))],
  ]

  for (const [label, respond] of broken) {
    it(`AS-07 (c) ${label}`, async () => {
      stubFetch(respond)
      const first = await askFirst()
      expect(first.status).toBe(200)
      expect(sources(first.body.questions)).toEqual(['template', 'template', 'template', 'template', 'template'])
      expect(first.logs).toContain('failure=error')
      const final = await askFinal()
      expect(final.status).toBe(200)
      expect(final.body.final_questions.every((q) => q.source === 'template')).toBe(true)
      expect(final.body.card_states.every((s) => s.source === 'rule')).toBe(true)
      expect(`${first.text}${final.text}${first.logs}${final.logs}`).not.toContain(KEY)
    })
  }

  it('AS-07 (c) 시간 초과: 1차·최종 모두 검수 문장, 판정이 늦으면 문장 호출을 하지 않고 단순 규칙', async () => {
    const seen: AbortSignal[] = []
    const hang = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) seen.push(signal)
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
        }),
    )
    const provider = createRemoteProvider({ endpoint: ENDPOINT, key: KEY, fetch: hang as unknown as typeof fetch })
    const reports: GenerateReport[] = []
    const first = await generateFirst(screen.first, { provider, timeoutMs: 30, onReport: (r) => reports.push(r) })
    expect(sources(first.questions)).toEqual(['template', 'template', 'template', 'template', 'template'])
    const final = await generateFinal(screen.final, { provider, timeoutMs: 30, onReport: (r) => reports.push(r) })
    expect(final.final_questions.every((q) => q.source === 'template')).toBe(true)
    expect(final.card_states.every((s) => s.source === 'rule')).toBe(true)
    expect(reports.map((r) => r.failure)).toEqual(['timeout', 'timeout'])
    expect(hang.mock.calls.map((c) => String(c[0]))).toEqual([`${BASE}/v1/first-questions`, `${BASE}/v1/final-judgements`])
    expect(seen.every((s) => s.aborted)).toBe(true)
  })

  it('AS-07 (c) AI_ENDPOINT 가 없으면 부르지 않고 모두 검수 문장', async () => {
    const calls = stubFetch(exampleServer)
    const { body } = await askFirst({ LLM_PROVIDER: 'remote', AI_API_KEY: KEY })
    expect(sources(body.questions).every((s) => s === 'template')).toBe(true)
    expect(calls).toEqual([])
  })
})

describe('AS-07 (d)(e) 보낸 본문·머리글', () => {
  it('AS-07 (d) 보낸 본문이 예시 JSON(docs/api-examples/*-request.json)과 같다. 최종 문장 본문에는 들은 답이 없다', async () => {
    const calls = stubFetch(exampleServer)
    await askFirst()
    await askFinal()
    expect(calls.map((c) => c.body)).toEqual([example('first-request'), example('final-judgements-request'), example('final-questions-request')])
    const finalBody = JSON.stringify(calls[2]?.body)
    for (const h of HEARDS) expect(finalBody).not.toContain(h)
  })

  it('AS-07 (e) Authorization: Bearer <AI_API_KEY> · UTF-8 JSON. 응답·로그에 키가 없다', async () => {
    const calls = stubFetch(exampleServer)
    const first = await askFirst()
    const final = await askFinal()
    expect(calls).toHaveLength(3)
    for (const c of calls) {
      expect(c.headers.get('authorization')).toBe(`Bearer ${KEY}`)
      expect(c.headers.get('content-type')).toBe('application/json; charset=utf-8')
      expect(c.headers.get('accept')).toBe('application/json')
    }
    expect(`${first.text}${final.text}${first.logs}${final.logs}`).not.toContain(KEY)
  })

  it('AS-07 (e) 함수 진입점(api/questions.ts)은 LLM_PROVIDER·AI_ENDPOINT·AI_API_KEY 를 process.env 에서 읽는다', async () => {
    vi.stubEnv('LLM_PROVIDER', 'remote')
    vi.stubEnv('AI_ENDPOINT', ENDPOINT)
    vi.stubEnv('AI_API_KEY', KEY)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      const calls = stubFetch(exampleServer)
      const res = await POST(post(screen.first))
      expect(res.status).toBe(200)
      expect(calls.map((c) => [c.url, c.headers.get('authorization')])).toEqual([[`${BASE}/v1/first-questions`, `Bearer ${KEY}`]])
      expect(await res.text()).not.toContain(KEY)
      expect(info.mock.calls.flat().join('\n')).not.toContain(KEY)
    } finally {
      info.mockRestore()
    }
  })
})

/** 저장소 안 글 파일(경로는 저장소 기준, / 구분) */
function filesUnder(dir: string, exts: RegExp): string[] {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (exts.test(name)) out.push(relative(root, p).replace(/\\/g, '/'))
    }
  }
  walk(abs)
  return out
}

describe('AS-07 키는 api/ 에서만 읽고, 기본값·배포 설정은 그대로', () => {
  it('AS-07 src/·shared/ 에는 process.env 와 AI_API_KEY 가 없다(키는 api/ 에서만 읽어 넘긴다)', () => {
    const hits = [...filesUnder('src', /\.(?:ts|vue)$/), ...filesUnder('shared', /\.ts$/)]
      .filter((f) => !f.endsWith('.test.ts'))
      .filter((f) => /process\.env|AI_API_KEY/.test(readFileSync(join(root, f), 'utf8')))
    expect(hits).toEqual([])
    expect(readFileSync(join(root, 'api/questions.ts'), 'utf8')).toContain('process.env.AI_API_KEY')
  })

  it('AS-07 빌드 결과물(dist/)에 AI 서버 주소 이름·키 이름·호출 경로가 없다(있을 때만 본다)', () => {
    const dist = filesUnder('dist', /\.(?:m?js|css|html|json|txt|svg)$/)
    const words = ['AI_API_KEY', 'AI_ENDPOINT', 'first-questions', 'final-judgements']
    const real = process.env.AI_API_KEY
    if (real) words.push(real)
    const hits = dist.flatMap((f) => {
      const text = readFileSync(join(root, f), 'utf8')
      return words.filter((w) => text.includes(w)).map((w) => `${f} → ${w === real ? '(AI_API_KEY 값)' : w}`)
    })
    expect(hits).toEqual([])
  })

  it('AS-07 기본은 가짜 공급자, remote 는 LLM_PROVIDER=remote 일 때만. vercel.json 은 build:mock 그대로', () => {
    expect(providerFor({}).name).toBe('mock')
    expect(providerFor({ AI_ENDPOINT: ENDPOINT, AI_API_KEY: KEY }).name).toBe('mock')
    expect(providerFor({ LLM_PROVIDER: 'remote' }).name).toBe('remote')
    expect(providerFor({ LLM_PROVIDER: 'ennoia' }).name).toBe('ennoia')
    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { buildCommand?: string }
    expect(vercel.buildCommand).toBe('npm run build:mock')
    const envExample = readFileSync(join(root, '.env.example'), 'utf8')
    expect(envExample).toMatch(/^LLM_PROVIDER=mock$/m)
    expect(envExample).toMatch(/^AI_ENDPOINT=$/m)
    expect(envExample).toMatch(/^AI_API_KEY=$/m)
    expect(envExample).not.toMatch(/^VITE_.*(?:KEY|ENDPOINT)/m)
  })
})
