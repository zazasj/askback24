/**
 * npm run eval:questions -- --run <실행 폴더> [--limit N]
 * 평가 ②③: <실행 폴더>/analysis/ 의 분석과 evals/data/postings/ 의 공고를 TS 규칙 → 로컬 Python AI 서버 → TS 검사 길로 돌려
 * questions.jsonl · judgements.jsonl 을 쓴다. 서버는 이 스크립트가 띄우고, 끝나거나 오류가 나도 반드시 끈다.
 * 키는 실행마다 무작위로 만들어 서버에만 넘기고 어디에도 찍지 않는다. 콘솔에는 건수만 찍는다.
 * shared/ 의 import 꼴(.js)을 Node 가 바로 읽지 못해 api-examples.ts 처럼 Vite 모듈 실행기(runnerImport)로 불러온다.
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import type * as Questions from './evalQuestions.ts'
import type * as Catalog from '../shared/catalog.ts'
import type * as Remote from '../shared/providers/remote.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const at = (p: string) => join(root, p)
const opts = { root, logLevel: 'warn', resolve: { alias: { '@': at('src'), '@shared': at('shared'), '@data': at('data') } } } as const

const PORT = 8790
const BASE = `http://127.0.0.1:${PORT}`

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const runArg = arg('--run')
if (!runArg) {
  console.error('사용: npm run eval:questions -- --run <실행 폴더> [--limit N]')
  process.exit(2)
}
const limitArg = arg('--limit')
const limit = limitArg === undefined ? Infinity : Number(limitArg)
if (!(limit >= 1)) {
  console.error('--limit 은 1 이상의 숫자여야 합니다')
  process.exit(2)
}
const runDir = resolve(runArg)
mkdirSync(runDir, { recursive: true })

const { module: q } = await runnerImport<typeof Questions>(at('scripts/evalQuestions.ts'), opts)
const { module: catalog } = await runnerImport<typeof Catalog>(at('shared/catalog.ts'), opts)
const { module: remote } = await runnerImport<typeof Remote>(at('shared/providers/remote.ts'), opts)

const data = q.loadEvalData(at('evals/data/postings'), runDir)
const ids = data.ids.slice(0, limit)
const gold = q.readGoldJudgements(at('evals/data/gold.json'))
if (gold === null) console.log('정답표(evals/data/gold.json)가 없어 판정은 건너뜁니다')
if (data.skipped) console.log(`분석 파일이 없는 공고 ${data.skipped}건은 건너뜁니다`)

const key = randomBytes(24).toString('hex')

/** uv 가 uvicorn 을 자식으로 띄우므로 프로세스 그룹째 끈다 */
function startServer(): Questions.ServerProc {
  const child = spawn(
    'uv',
    ['run', '--frozen', 'uvicorn', 'api.ai.index:app', '--host', '127.0.0.1', '--port', String(PORT)],
    // 서버 출력에 요청 내용이 섞일 수 있어 버린다
    { cwd: root, env: { ...process.env, AI_API_KEY: key }, stdio: 'ignore', detached: true },
  )
  const exited = new Promise<void>((done) => {
    child.on('exit', () => done())
    child.on('error', () => done())
  })
  const group = (sig: NodeJS.Signals) => {
    if (child.pid === undefined) return
    try {
      process.kill(-child.pid, sig)
    } catch {
      // 이미 끝남
    }
  }
  // Ctrl-C·종료 신호·비정상 종료에도 서버가 남지 않게
  const bye = (sig: NodeJS.Signals) => () => {
    group('SIGKILL')
    process.exit(sig === 'SIGINT' ? 130 : 143)
  }
  process.once('SIGINT', bye('SIGINT'))
  process.once('SIGTERM', bye('SIGTERM'))
  process.once('exit', () => group('SIGKILL'))
  return { kill: (sig) => group((sig ?? 'SIGTERM') as NodeJS.Signals), exited }
}

async function ready(): Promise<boolean> {
  const res = await fetch(`${BASE}/api/ai/v1/health`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(2000) })
  return res.status === 200
}

const rows = await q.withServer(startServer, ready, async () => {
  const provider = remote.createRemoteProvider({ endpoint: `${BASE}/api/ai`, key })
  const out: Questions.CaseRow[] = []
  // 시간 지표가 실제와 같게 사례를 하나씩 돈다
  for (const c of q.buildCases(ids)) out.push(await q.runCase(c, { provider, lookup: data.lookup, presets: catalog.PRESETS }))
  const judgements = gold ? await q.runJudgements(gold, { provider, lookup: data.lookup }) : null
  return { cases: out, judgements }
})

q.writeJsonl(join(runDir, 'questions.jsonl'), rows.cases)
if (rows.judgements) q.writeJsonl(join(runDir, 'judgements.jsonl'), rows.judgements)
console.log(`사례 ${rows.cases.length}개 · 검수 문장 ${q.countTemplates(rows.cases)}개 · 판정 ${rows.judgements?.length ?? 0}줄`)
