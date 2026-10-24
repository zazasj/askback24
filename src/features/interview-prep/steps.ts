import type { Mode } from '@shared/contract'

export type StepNo = 1 | 2 | 3

/** S4 단계 이름(ACCEPTANCE 「정확한 문구」). 1차와 최종은 ②③이 다르다 */
export const STEP_LABELS: Record<Mode, readonly [string, string, string]> = {
  first: ['공고 확인', '내 기대·걱정', '질문 받기'],
  final: ['공고 확인', '1차 면접 정리', '최종 질문 받기'],
}

export const MODE_LABELS: Record<Mode, string> = {
  first: '1차·기술 면접',
  final: '최종 면접·처우 협의',
}

/** ① 다음 버튼 */
export const NEXT_FROM_POSTING: Record<Mode, string> = {
  first: '내 기대·걱정 고르기',
  final: '1차 면접 정리하기',
}

const one = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v)

export function parseStep(v: unknown): StepNo | null {
  const s = one(v)
  return s === '1' || s === '2' || s === '3' ? (Number(s) as StepNo) : null
}

export function parseMode(v: unknown): Mode | null {
  const s = one(v)
  return s === 'first' || s === 'final' ? s : null
}

/** 지원결과가 "1차 합격"이면 최종으로 연다 */
export function defaultModeFor(result: string): Mode {
  return result === '1차 합격' ? 'final' : 'first'
}

/**
 * S1에서 들어올 때 열 단계. 지원결과로 정한 면접 종류의 결과가 이미 있으면 ③(만든 질문 그대로), 없으면 ①.
 * ①부터 다시 지나가게 하면 ②의 "질문 만들기"가 질문을 다시 만드는 것처럼 보였다(A2-01)
 */
export function entryStep(result: string, hasResult: (mode: Mode) => boolean): StepNo {
  return hasResult(defaultModeFor(result)) ? 3 : 1
}
