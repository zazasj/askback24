/**
 * npm run api:examples — docs/api-examples/*.json 6개를 지금 코드로 다시 쓴다(AS-03, scripts/apiExamples.ts).
 * shared/ 의 import 꼴(.js)과 화면 코드의 @shared 별칭을 Node 가 바로 읽지 못해 Vite 모듈 실행기(runnerImport)로 불러온다.
 * 네트워크를 쓰지 않는다(가짜 공급자). 규칙·데이터·가짜 공급자를 고친 뒤 이 명령을 돌리고, 단위 시험이 파일과 코드를 비교한다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import type * as Examples from './apiExamples.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const at = (p: string) => join(root, p)

const { module } = await runnerImport<typeof Examples>(at('scripts/apiExamples.ts'), {
  root,
  logLevel: 'warn',
  resolve: { alias: { '@': at('src'), '@shared': at('shared'), '@data': at('data') } },
})

const { files } = await module.buildApiExamples()
const dir = at(module.API_EXAMPLE_DIR)
mkdirSync(dir, { recursive: true })
for (const name of module.API_EXAMPLE_NAMES) {
  writeFileSync(join(dir, `${name}.json`), module.exampleText(files[name]), 'utf8')
  console.log(`${module.API_EXAMPLE_DIR}/${name}.json`)
}
