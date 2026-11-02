/**
 * 이력서 중 AI에 보낼 칸(허용 목록)만 고른다. 이름·연락처·병역·학교·자기소개·기간·날짜는 보내지 않는다.
 * 화면이 보낼 때(resumeForAi)와 서버가 받을 때(cleanResume) 같은 규칙으로 거른다.
 * 경험 한 줄처럼 서버에서 저장·기록하지 않는다.
 */
import type { ResumeForAi } from './contract.js'
import type { RankedPick } from './rules.js'

export type { ResumeForAi } from './contract.js'

/** 칸 하나의 글자 수 한도 */
export const RESUME_FIELD_MAX = 80
export const RESUME_LIMITS = { skills: 15, projects: 5, trainings: 3, certificates: 5 } as const
/** 이력서를 붙일 수 있는 depth·opportunity 문항 수(경험 문항은 따로) */
const CITABLE_EXTRA = 2

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, RESUME_FIELD_MAX) : ''
}

function strings(v: unknown, max: number): string[] {
  return asArray(v).map(str).filter((s) => s !== '').slice(0, max)
}

/** 허용 키만 읽는다. 값이 모두 빈 줄은 뺀다 */
function pickObjects<K extends string>(v: unknown, keys: readonly K[], max: number): Array<Record<K, string>> {
  const out: Array<Record<K, string>> = []
  for (const item of asArray(v)) {
    if (!isRecord(item)) continue
    const row = Object.fromEntries(keys.map((k) => [k, str(item[k])])) as Record<K, string>
    if (keys.every((k) => row[k] === '')) continue
    out.push(row)
    if (out.length >= max) break
  }
  return out
}

/** 서버가 받은 값을 다시 거른다. 허용 칸이 하나도 안 남으면 undefined */
export function cleanResume(v: unknown): ResumeForAi | undefined {
  if (!isRecord(v)) return undefined
  const r: ResumeForAi = {
    career: str(v.career),
    skills: strings(v.skills, RESUME_LIMITS.skills),
    projects: pickObjects(v.projects, ['name', 'stack', 'summary'] as const, RESUME_LIMITS.projects),
    trainings: pickObjects(v.trainings, ['name', 'summary'] as const, RESUME_LIMITS.trainings),
    certificates: strings(v.certificates, RESUME_LIMITS.certificates),
  }
  const empty = r.career === '' && !r.skills.length && !r.projects.length && !r.trainings.length && !r.certificates.length
  return empty ? undefined : r
}

/** data/persona.json 모양(희망 경력·기술·프로젝트·교육·자격증)에서 허용 칸만 고른다 */
export function resumeForAi(persona: unknown): ResumeForAi | undefined {
  if (!isRecord(persona)) return undefined
  const hope = isRecord(persona.hope) ? persona.hope : {}
  return cleanResume({
    career: hope.career,
    skills: persona.skills,
    projects: persona.projects,
    trainings: persona.trainings,
    // 자격증은 이름만(취득일은 보내지 않는다)
    certificates: asArray(persona.certificates).map((c) => (isRecord(c) ? c.name : c)),
  })
}

/** 검사·판정에 쓰는 글: 모든 칸을 공백으로 이어 붙인다 */
export function resumeText(r: ResumeForAi): string {
  return [
    r.career,
    ...r.skills,
    ...r.projects.flatMap((p) => [p.name, p.stack, p.summary]),
    ...r.trainings.flatMap((t) => [t.name, t.summary]),
    ...r.certificates,
  ]
    .filter((s) => s !== '')
    .join(' ')
}

/**
 * 이력서를 붙일 수 있는 질문 순위. 경험 문항과, 그 밖의 depth·opportunity 중 순위가 높은 2개.
 * 충돌·예방 질문까지 이력서 얘기로 흐르지 않게 한다.
 */
export function citableRanks(ranked: readonly RankedPick[], hasResume: boolean): Set<number> {
  const out = new Set<number>()
  if (!hasResume) return out
  let extra = 0
  ranked.forEach((r, i) => {
    const rank = i + 1
    if (r.has_exp) out.add(rank)
    else if ((r.type === 'depth' || r.type === 'opportunity') && extra < CITABLE_EXTRA) {
      out.add(rank)
      extra++
    }
  })
  return out
}
