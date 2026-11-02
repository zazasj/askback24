import { describe, expect, it } from 'vitest'
import persona from '../data/persona.json'
import { citableRanks, cleanResume, resumeForAi, resumeText, type ResumeForAi } from './resume'
import type { RankedPick } from './rules'

describe('resumeForAi', () => {
  it('허용 칸 다섯 개만 남는다', () => {
    const r = resumeForAi(persona)
    expect(r).toBeDefined()
    expect(Object.keys(r!).sort()).toEqual(['career', 'certificates', 'projects', 'skills', 'trainings'])
    expect(r!.career).toBe('신입')
    expect(r!.certificates).toEqual(['정보처리기사', 'TOEIC 805'])
    expect(r!.trainings.map((t) => Object.keys(t).sort())).toEqual([['name', 'summary']])
    expect(r!.projects.map((p) => Object.keys(p).sort())).toEqual([['name', 'stack', 'summary'], ['name', 'stack', 'summary']])
  })

  it('이름·연락처·병역·학교·자기소개는 글에 없다', () => {
    const text = JSON.stringify(resumeForAi(persona))
    for (const banned of ['김00', '010-0000-0000', 'kim00@example.com', '군필', '○○대학교', '지원 동기']) expect(text).not.toContain(banned)
  })

  it('고를 것이 하나도 없으면 undefined', () => {
    expect(resumeForAi({ name: '김00', basic: { phone: '010-0000-0000' } })).toBeUndefined()
    expect(resumeForAi(null)).toBeUndefined()
    expect(resumeForAi('x')).toBeUndefined()
  })
})

describe('cleanResume', () => {
  it('cleanResume drops unknown fields', () => {
    const got = cleanResume({ skills: ['Java'], name: '김00', phone: '010', self_intro: [{ title: '지원 동기', body: '...' }] })
    expect(got).toEqual({ career: '', skills: ['Java'], projects: [], trainings: [], certificates: [] })
  })

  it('중첩 칸의 허용 밖 키도 뺀다(기간·날짜·학교)', () => {
    const got = cleanResume({
      projects: [{ name: 'A', stack: 'B', summary: 'C', period: '2026', school: '○○대학교' }],
      trainings: [{ name: 'T', summary: 'S', period: '2026.03' }],
    })
    expect(got?.projects).toEqual([{ name: 'A', stack: 'B', summary: 'C' }])
    expect(got?.trainings).toEqual([{ name: 'T', summary: 'S' }])
  })

  it('cleanResume caps', () => {
    const got = cleanResume({
      career: ' 신입 ',
      skills: Array.from({ length: 20 }, (_, i) => `S${i}`),
      projects: Array.from({ length: 8 }, () => ({ name: 'n'.repeat(100), stack: '', summary: '' })),
      trainings: Array.from({ length: 5 }, () => ({ name: 't', summary: '' })),
      certificates: Array.from({ length: 9 }, (_, i) => `C${i}`),
    })!
    expect(got.career).toBe('신입')
    expect(got.skills).toHaveLength(15)
    expect(got.projects).toHaveLength(5)
    expect(got.projects[0]!.name).toHaveLength(80)
    expect(got.trainings).toHaveLength(3)
    expect(got.certificates).toHaveLength(5)
  })

  it('빈 문자열·문자열 아닌 값은 뺀다, 모두 비면 undefined', () => {
    expect(cleanResume({ skills: ['', '  ', 3, 'Git'] })?.skills).toEqual(['Git'])
    expect(cleanResume({ skills: [''], projects: [{ name: '', stack: '', summary: '' }] })).toBeUndefined()
    expect(cleanResume(undefined)).toBeUndefined()
    expect(cleanResume([])).toBeUndefined()
  })
})

describe('resumeText', () => {
  it('모든 칸을 공백으로 이어 붙인다', () => {
    const r: ResumeForAi = {
      career: '신입',
      skills: ['Java'],
      projects: [{ name: 'P', stack: 'Spring', summary: 'S' }],
      trainings: [{ name: 'T', summary: 'U' }],
      certificates: ['정보처리기사'],
    }
    expect(resumeText(r)).toBe('신입 Java P Spring S T U 정보처리기사')
  })
})

describe('citableRanks', () => {
  const pick = (type: RankedPick['type'], has_exp = false) => ({ type, has_exp }) as RankedPick
  const ranked = [pick('depth', true), pick('depth'), pick('conflict'), pick('opportunity'), pick('depth')]

  it('이력서가 있으면 경험 문항 + 그 밖의 depth·opportunity 위 2개', () => {
    expect([...citableRanks(ranked, true)].sort()).toEqual([1, 2, 4])
  })

  it('이력서가 없으면 빈 집합', () => {
    expect(citableRanks(ranked, false).size).toBe(0)
  })

  it('경험 문항은 depth여도 2개 몫에 세지 않는다', () => {
    expect([...citableRanks(ranked, true)]).toContain(2)
    const onlyConflict = [pick('conflict'), pick('prevent'), pick('depth'), pick('opportunity'), pick('depth')]
    expect([...citableRanks(onlyConflict, true)].sort()).toEqual([3, 4])
  })
})
