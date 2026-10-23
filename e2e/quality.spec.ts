/**
 * NF — 품질, API-05·06 의 파일·빌드 검사. 화면이 아니라 저장소 파일을 node fs 로 본다.
 * 빌드는 미리보기 서버가 쓰는 dist/ 를 건드리지 않게 review/tmp/ 아래로 따로 뽑는다.
 */
import { expect, test } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative, sep } from 'node:path'
import { PRESET_A, R04_ANSWERS, REPO_ROOT, makeFinalQuestions } from './helpers'

test.skip(({ isMobile }) => isMobile, '파일 검사는 한 번만(데스크톱 프로젝트) 돈다')

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

const rel = (p: string) => relative(REPO_ROOT, p).split(sep).join('/')

/** npm 스크립트·도구를 레포 루트에서 돌린다. Playwright 가 심은 NODE_OPTIONS 는 넘기지 않는다. */
function run(command: string, timeout = 300_000): { ok: boolean; output: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', CI: '1' }
  delete env.NODE_OPTIONS
  const r = spawnSync(command, { cwd: REPO_ROOT, shell: true, encoding: 'utf8', timeout, env })
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`
  return { ok: r.status === 0, output: output.slice(-6000) }
}

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.txt', '.svg', '.webmanifest', '.xml'])

test('NF-01 타입 검사·빌드·단위 시험이 통과한다', async () => {
  test.setTimeout(600_000)
  const typecheck = run('npm run typecheck')
  expect(typecheck.ok, `npm run typecheck\n${typecheck.output}`).toBe(true)
  const build = run('npx vite build --outDir review/tmp/nf01-dist --emptyOutDir')
  expect(build.ok, `vite build\n${build.output}`).toBe(true)
  const unit = run('npm run test:unit')
  expect(unit.ok, `npm run test:unit\n${unit.output}`).toBe(true)
})

test('NF-02 src/ 에 v-html 이 없다', async () => {
  const files = listFiles(join(REPO_ROOT, 'src'))
  expect(files.length, 'src/ 파일').toBeGreaterThan(0)
  const hits = files.filter((f) => /v-html\s*=/.test(readFileSync(f, 'utf8'))).map(rel)
  expect(hits).toEqual([])
})

test('NF-03 .env 가 .gitignore 에 있고 git 기록에 .env 파일이 없다', async () => {
  const ignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
  expect(ignore, '.gitignore').toContain('.env')
  const log = spawnSync('git', ['-C', REPO_ROOT, 'log', '--all', '--pretty=format:', '--name-only'], { encoding: 'utf8' })
  expect(log.status, log.stderr).toBe(0)
  const committed = log.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l === '.env' || l.endsWith('/.env'))
  expect(committed).toEqual([])
})

// NF-04: 색 값 직접 쓰기 찾기
const HEX = /#[0-9a-fA-F]{3,8}\b/
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i
const NAMED =
  /(?<![-\w])(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|navy|teal|maroon|olive|lime|aqua|fuchsia|gold|brown|crimson|coral|salmon|violet|indigo|cyan|magenta|tomato|khaki|beige|ivory|lavender|plum|orchid|whitesmoke|gainsboro|lightgray|lightgrey|darkgray|darkgrey|dimgray|dimgrey|lightblue|darkblue|skyblue)(?![-\w])/i
const SKIP_PROPS = /^(?:content|font-family|src|grid-template-areas|transition|transition-property|will-change|animation|animation-name|counter-reset|counter-increment|quotes)$/i
const INLINE_COLOR = /(?:fill|stroke|stop-color|flood-color|color|background(?:-color)?|border(?:-color)?|outline(?:-color)?|box-shadow)\s*[=:]\s*["'`]?\s*(#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\()/gi

function cssColorHits(css: string): string[] {
  const hits: string[] = []
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/([-\w]+)\s*:\s*([^;{}]+)/g)) {
    const prop = m[1] ?? ''
    const value = m[2] ?? ''
    if (SKIP_PROPS.test(prop)) continue
    if (HEX.test(value) || COLOR_FN.test(value) || NAMED.test(value)) hits.push(`${prop}: ${value.trim()}`)
  }
  return hits
}

test('NF-04 컴포넌트·스타일에 하드코딩 색이 없다(KRDS 토큰·src/styles/tokens.css 변수만)', async () => {
  const exempt = (f: string) => rel(f) === 'src/styles/tokens.css' || /krds/i.test(basename(f))
  const problems: string[] = []
  for (const f of listFiles(join(REPO_ROOT, 'src'))) {
    if (exempt(f)) continue
    const ext = extname(f)
    const text = readFileSync(f, 'utf8')
    const report = (hits: string[]) => hits.forEach((h) => problems.push(`${rel(f)} → ${h}`))
    if (ext === '.css' || ext === '.scss') {
      report(cssColorHits(text))
    } else if (ext === '.vue') {
      const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '')
      report(styles.flatMap(cssColorHits))
      const rest = text.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
      for (const m of rest.matchAll(/\sstyle="([^"]*)"/g)) report(cssColorHits(m[1] ?? ''))
      report([...rest.matchAll(INLINE_COLOR)].map((m) => m[0]))
    } else if (ext === '.ts' || ext === '.tsx' || ext === '.js') {
      report([...text.matchAll(INLINE_COLOR)].map((m) => m[0]))
    }
  }
  expect(problems).toEqual([])
})

test('API-05 화면 쪽: 가짜 응답 모드의 콘솔 로그에 경험 한 줄·들은 답 원문이 없다', async ({ page }) => {
  test.setTimeout(90_000)
  const logs: string[] = []
  page.on('console', (m) => logs.push(m.text()))
  await makeFinalQuestions(page)
  const all = logs.join('\n')
  for (const secret of [PRESET_A.experience, ...Object.values(R04_ANSWERS)]) expect(all, `콘솔에 "${secret}"`).not.toContain(secret)
})

test('API-06 빌드 결과물에 ENNOIA · process.env · apiKey 문자열이 없다', async () => {
  test.setTimeout(300_000)
  const outDir = 'review/tmp/api06-dist'
  const build = run(`npx vite build --outDir ${outDir} --emptyOutDir`)
  expect(build.ok, `vite build\n${build.output}`).toBe(true)
  const files = listFiles(join(REPO_ROOT, outDir)).filter((f) => TEXT_EXT.has(extname(f)))
  expect(files.length, '빌드 결과 파일').toBeGreaterThan(0)
  const hits: string[] = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const word of ['ENNOIA', 'process.env', 'apiKey']) if (text.includes(word)) hits.push(`${rel(f)} → ${word}`)
  }
  expect(hits).toEqual([])
})
