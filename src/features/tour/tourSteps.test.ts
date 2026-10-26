/** TR-01·02 안내 글: 단계 수, 서비스 안내에 기능 전체, 문구 원칙(해요체·사칭 금지), 대상 이름이 화면에 있는지 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TourStep } from '@/stores/tour'
import { FINAL_RESULT_TOUR, FIRST_RESULT_TOUR, JOBS_TOUR, JOB_TOUR, PICK_TOUR, RESUME_TOUR, REVIEW_TOUR, S1_TOUR, postingTour } from './tourSteps'

const SCREEN_TOURS: Record<string, readonly TourStep[]> = {
  jobs: JOBS_TOUR,
  job: JOB_TOUR,
  resume: RESUME_TOUR,
  'posting(1차)': postingTour('내 기대·걱정 고르기'),
  'posting(최종)': postingTour('1차 면접 정리하기'),
  pick: PICK_TOUR,
  first: FIRST_RESULT_TOUR,
  review: REVIEW_TOUR,
  final: FINAL_RESULT_TOUR,
}
const ALL: Array<[string, readonly TourStep[]]> = [['s1', S1_TOUR], ...Object.entries(SCREEN_TOURS)]
const textOf = (steps: readonly TourStep[]) => steps.map((s) => `${s.title} ${s.text}`).join(' ')

describe('단계 수(DESIGN-REVIEW D19)', () => {
  it('S1 서비스 안내는 6~8단계, 다른 화면은 2~3단계', () => {
    expect(S1_TOUR.length).toBeGreaterThanOrEqual(6)
    expect(S1_TOUR.length).toBeLessThanOrEqual(8)
    for (const [name, steps] of Object.entries(SCREEN_TOURS)) {
      expect(steps.length, name).toBeGreaterThanOrEqual(2)
      expect(steps.length, name).toBeLessThanOrEqual(3)
    }
  })
})

describe('S1 서비스 안내는 사이트 기능 전체를 소개한다(TR-01)', () => {
  it('채용정보·지원 현황·1차·최종·이력서·시연 도구', () => {
    const all = textOf(S1_TOUR)
    for (const w of ['채용정보', '지원 현황', '1차', '최종', '이력서', '시연 도구', '시연 사이트']) expect(all).toContain(w)
  })

  it('첫 단계는 대상 없는 소개, 그다음은 화면 요소를 비춘다', () => {
    expect(S1_TOUR[0]?.target).toBeUndefined()
    expect(S1_TOUR.slice(1).every((s) => (s.target?.length ?? 0) > 0)).toBe(true)
  })

  it('공고 상세 안내는 입사지원 → 지원 현황을 말한다(TR-02)', () => {
    const all = textOf(JOB_TOUR)
    expect(all).toContain('입사지원')
    expect(all).toContain('지원 현황')
  })

  it('① 안내는 그 면접 종류의 다음 단계 버튼 이름을 쓴다', () => {
    expect(textOf(postingTour('1차 면접 정리하기'))).toContain('"1차 면접 정리하기"')
  })
})

describe('문구 원칙', () => {
  it.each(ALL)('%s: 해요체로 끝나고 이 사이트를 "고용24"라고 부르지 않는다', (_name, steps) => {
    for (const s of steps) {
      expect(s.text, s.title).toMatch(/요\.$/)
      expect(s.title.endsWith('.'), s.title).toBe(false)
      expect(`${s.title} ${s.text}`, s.title).not.toContain('고용24')
    }
  })

  it.each(ALL)('%s: 단계 표시 "N/M"과 헷갈릴 숫자/숫자가 없다', (_name, steps) => {
    expect(textOf(steps)).not.toMatch(/\d\s*\/\s*\d/)
  })

  it.each(ALL)('%s: 지금 분석한다는 말이 없다(공고 분석은 미리 만든 결과, LD-05)', (_name, steps) => {
    expect(textOf(steps)).not.toMatch(/분석\s*(?:하는\s*)?중|분석하고\s*있/)
  })
})

describe('대상 이름(data-tour)이 화면 코드에 있다', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.vue')) files.push(p)
    }
  }
  walk(root)
  const source = files.map((f) => readFileSync(f, 'utf8')).join('\n')

  it.each(ALL)('%s', (_name, steps) => {
    for (const s of steps) for (const t of s.target ?? []) expect(source, `${s.title}: ${t}`).toMatch(new RegExp(`['"]${t}['"]|data-tour="[^"]*\\b${t}\\b`))
  })
})
