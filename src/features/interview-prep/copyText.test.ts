/** RS-04·V-02: "전체 복사" 글은 화면 순서 그대로, 유형 꼬리표 없음, 1차는 끝에 "더 알아볼 질문" 소제목(있을 때만) */
import { describe, expect, it } from 'vitest'
import { EXTRA_COPY_HEADING, finalCopyText, firstCopyText } from './copyText'

const HEAD = '(주)OO소프트 · 백엔드 개발자\n1차·기술 면접 질문'
const FIVE = ['첫째 질문인가요?', '둘째 질문인가요?', '셋째 질문인가요?', '넷째 질문인가요?', '다섯째 질문인가요?']

describe('RS-04 1차 전체 복사', () => {
  it('질문 5개를 화면 순서로 1.~5., 그 뒤 한 줄짜리 소제목 "더 알아볼 질문"과 그 문장들', () => {
    const text = firstCopyText(HEAD, FIVE, ['탐색 하나인가요?', '탐색 둘인가요?'])
    expect(text.split('\n')).toEqual([
      '(주)OO소프트 · 백엔드 개발자',
      '1차·기술 면접 질문',
      '',
      '1. 첫째 질문인가요?',
      '2. 둘째 질문인가요?',
      '3. 셋째 질문인가요?',
      '4. 넷째 질문인가요?',
      '5. 다섯째 질문인가요?',
      '',
      EXTRA_COPY_HEADING,
      '- 탐색 하나인가요?',
      '- 탐색 둘인가요?',
    ])
    expect(EXTRA_COPY_HEADING).toBe('더 알아볼 질문')
  })

  it('더 알아볼 질문이 없으면 소제목도 없다', () => {
    const text = firstCopyText(HEAD, FIVE, [])
    expect(text).not.toContain(EXTRA_COPY_HEADING)
    expect(text.endsWith('5. 다섯째 질문인가요?')).toBe(true)
  })

  it('대괄호 꼬리표("[차이 확인]")를 붙이지 않는다(V-02)', () => {
    expect(firstCopyText(HEAD, FIVE, ['탐색 하나인가요?'])).not.toMatch(/\[[^\]]*\]/)
  })
})

describe('RS-04·V-02 최종 전체 복사', () => {
  it('소제목 두 개 아래로 나뉘고, 번호는 화면처럼 묶음을 건너 이어 센다', () => {
    const text = finalCopyText('(주)OO소프트 · 백엔드 개발자\n최종 면접·처우 질문', [
      { title: '최종 면접에서 물을 것', texts: ['가인가요?', '나인가요?'] },
      { title: '처우 협의 때 물을 것', texts: ['다인가요?'] },
    ])
    expect(text.split('\n')).toEqual([
      '(주)OO소프트 · 백엔드 개발자',
      '최종 면접·처우 질문',
      '',
      '최종 면접에서 물을 것',
      '1. 가인가요?',
      '2. 나인가요?',
      '',
      '처우 협의 때 물을 것',
      '3. 다인가요?',
    ])
  })

  it('질문이 없는 묶음은 소제목도 넣지 않는다', () => {
    const text = finalCopyText('머리', [
      { title: '최종 면접에서 물을 것', texts: ['가인가요?'] },
      { title: '처우 협의 때 물을 것', texts: [] },
    ])
    expect(text).not.toContain('처우 협의 때 물을 것')
  })
})
