/**
 * 공고의 전형 방법(selMthd)에서 면접 횟수를 센다(H3-r2-03): "면접"이 들어간 단계 수.
 * "서류전형, 1차 면접(실무), 최종 면접(임원)" → 2 · "서류전형, 면접" → 1 · 면접이 없으면 0.
 */
export function interviewRounds(selMthd: string): number {
  return selMthd.split(/[,→>]/).filter((stage) => stage.includes('면접')).length
}
