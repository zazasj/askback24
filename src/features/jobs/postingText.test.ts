import { describe, expect, it } from 'vitest'
import { POSTINGS, getAnalysis } from '@shared/catalog'
import { marksOf, segmentsFor } from '@/features/interview-prep/highlight'
import { lastLineOf, lineKind, plainSegments, postingLines } from './postingText'

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const sourceLines = (text: string) => text.split(/\r?\n/).map(norm).filter(Boolean)
const lineText = (l: ReturnType<typeof postingLines>[number]) => l.pieces.map((p) => p.text).join('')

describe('공고 글 블록 줄 나누기', () => {
  it('P-03·P-05 공고 7건: 그린 줄 = 원문 줄(소제목·목록 기호 그대로, 빈 줄만 빠짐)', () => {
    for (const p of POSTINGS) {
      const lines = postingLines(plainSegments(p.jobCont))
      expect(lines.map((l) => norm(lineText(l))), p.wantedAuthNo).toEqual(sourceLines(p.jobCont))
    }
  })

  it('형광펜 조각을 줄마다 자르고, 원래 조각(열쇠·카드)을 그대로 넘긴다', () => {
    const text = '[담당업무]\n- 서버 개발 및 기타 업무 지원\n\n[우대사항]'
    const segs = [
      { text: '[담당업무]\n- ', start: 0, cardIds: [] },
      { text: '서버 개발', start: 9, cardIds: ['BE01'] },
      { text: ' 및 기타 업무 지원\n\n[우대사항]', start: 14, cardIds: [] },
    ]
    expect(segs.map((s) => s.text).join('')).toBe(text)
    const lines = postingLines(segs)
    expect(lines.map(lineText)).toEqual(['[담당업무]', '- 서버 개발 및 기타 업무 지원', '[우대사항]'])
    expect(lines[1]?.pieces.map((x) => [x.text, x.seg.start, x.seg.cardIds])).toEqual([
      ['- ', 0, []],
      ['서버 개발', 9, ['BE01']],
      [' 및 기타 업무 지원', 14, []],
    ])
    expect(lines.map((l) => l.gap)).toEqual([false, false, true])
  })

  it('P-03 모든 분석의 직무내용 형광펜은 한 줄 안에 있고 같은 줄에 다른 글이 붙어 있다(문단 안 형광펜)', () => {
    for (const p of POSTINGS) {
      const marks = marksOf(getAnalysis(p.wantedAuthNo))
      for (const line of postingLines(segmentsFor('jobCont', p.jobCont, marks))) {
        const marked = line.pieces.filter((x) => x.seg.cardIds.length)
        for (const m of marked) {
          expect(m.text, `${p.wantedAuthNo}: 형광펜이 줄을 넘지 않는다`).toBe(m.seg.text)
          expect(norm(lineText(line)).length, `${p.wantedAuthNo} "${m.text}": 줄에 형광펜만 있으면 안 된다`).toBeGreaterThan(m.text.length)
        }
      }
    }
  })

  it('줄 모양: 기호 소제목·[ ] 소제목·짧은 소제목 줄 / 목록·번호 / 참고(※) / 하위 항목(앞 공백)', () => {
    const at = { afterBreak: true, beforeText: true }
    const mid = { afterBreak: false, beforeText: true }
    expect(lineKind('■ 담당 업무', mid)).toBe('head')
    expect(lineKind('[근무환경 및 복지]', mid)).toBe('head')
    expect(lineKind('1. 회사 소개', at)).toBe('head')
    expect(lineKind('하는 일', at)).toBe('head')
    expect(lineKind('혜택 및 복지', at)).toBe('head')
    // 빈 줄 뒤가 아니거나 문장이면 소제목이 아니다
    expect(lineKind('서류전형 후 면접', mid)).toBe('text')
    expect(lineKind('어떤 일을 하나요?', at)).toBe('text')
    expect(lineKind('① 결제 승인 API 개발', at)).toBe('item')
    expect(lineKind('○ 자격증 취득 축하금, 사내 교육', at)).toBe('item')
    expect(lineKind('- 4대 보험, 퇴직금', mid)).toBe('item')
    expect(lineKind('※ 제출 서류: 이력서', mid)).toBe('note')
    expect(lineKind('팀 구성: 현재 백엔드 개발자 2명', mid)).toBe('text')

    const sub = postingLines(plainSegments('□ 담당 업무\n ○ 기존 데이터 이관'))
    expect(sub.map((l) => [l.kind, l.sub, lineText(l)])).toEqual([
      ['head', false, '□ 담당 업무'],
      ['item', true, '○ 기존 데이터 이관'],
    ])
  })

  it('형광펜 설명 자리: 그 형광펜이 든 줄 바로 밑(OO소프트 "기타 업무 지원"은 담당업무 줄), 줄을 넘는 조각은 끝 줄', () => {
    const oo = POSTINGS.find((p) => p.corpNm === '(주)OO소프트')
    expect(oo).toBeDefined()
    const lines = postingLines(segmentsFor('jobCont', oo?.jobCont ?? '', marksOf(getAnalysis(oo?.wantedAuthNo ?? ''))))
    const at = lastLineOf(lines, (seg) => seg.text === '기타 업무 지원')
    const line = lines.find((l) => l.index === at)
    expect(line && lineText(line)).toContain('기타 업무 지원')
    // 칸 끝(마지막 줄)이 아니라 형광펜 줄 밑이라 긴 공고에서 설명이 형광펜과 떨어지지 않는다
    expect(at).toBeLessThan(lines[lines.length - 1]?.index ?? 0)

    const segs = [
      { text: '첫 줄\n둘째 ', start: 0, cardIds: [] },
      { text: '줄 넘는\n형광펜', start: 7, cardIds: ['BE01'] },
      { text: ' 뒤\n넷째 줄', start: 14, cardIds: [] },
    ]
    expect(lastLineOf(postingLines(segs), (seg) => seg.cardIds.length > 0)).toBe(2)
    expect(lastLineOf(postingLines(segs), () => false)).toBeNull()
  })

  it('빈 글은 줄이 없다', () => {
    expect(postingLines(plainSegments(''))).toEqual([])
    expect(postingLines(plainSegments('\n\n'))).toEqual([])
  })
})
