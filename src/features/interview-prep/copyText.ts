/**
 * "전체 복사" 글(1차·최종 ③). 면접장에 들고 가는 메모라 유형 꼬리표("[차이 확인]")를 붙이지 않고(H2-01 ②),
 * 순서는 화면 순서 그대로다(RS-04). 인쇄도 화면 순서라 따로 정렬하지 않는다.
 */

/** 1차 복사 글 끝 소제목(더 알아볼 질문이 있을 때만, RS-04) */
export const EXTRA_COPY_HEADING = '더 알아볼 질문'

/** 머리 + 질문 5개(번호) + 소제목 "더 알아볼 질문"과 그 문장들(번호 대신 "-", 질문 5개와 섞이지 않게) */
export function firstCopyText(head: string, questions: readonly string[], explores: readonly string[] = []): string {
  const parts = [head, questions.map((t, i) => `${i + 1}. ${t}`).join('\n')]
  if (explores.length > 0) parts.push([EXTRA_COPY_HEADING, ...explores.map((t) => `- ${t}`)].join('\n'))
  return parts.join('\n\n')
}

/** 머리 + 소제목 묶음마다 질문(번호는 화면처럼 묶음을 건너 이어 센다, H1-12) */
export function finalCopyText(head: string, groups: ReadonlyArray<{ title: string; texts: readonly string[] }>): string {
  let n = 0
  const body = groups.filter((g) => g.texts.length > 0).map((g) => [g.title, ...g.texts.map((t) => `${++n}. ${t}`)].join('\n'))
  return [head, ...body].join('\n\n')
}
