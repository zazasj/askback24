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

/** 지원결과가 "1차 합격"이면 최종으로 연다(저장된 결과가 없을 때만, H2-04) */
export function defaultModeFor(result: string): Mode {
  return result === '1차 합격' ? 'final' : 'first'
}

/**
 * 들어올 때 열 면접 종류(H2-04): 내가 만든 최종 결과가 있으면 최종, 1차 결과만 있으면 1차,
 * 저장된 결과가 없을 때만 지원결과로 정한다. 지원결과는 회사가 늦게 넣거나 비워 두는 일이 흔하다.
 * saved 는 브라우저에 저장된 결과만 본다(시연 시드는 넣지 않아 S1 2행은 지원결과대로 최종, S1-06).
 */
export function entryMode(result: string, saved: (mode: Mode) => boolean): Mode {
  if (saved('final')) return 'final'
  if (saved('first')) return 'first'
  return defaultModeFor(result)
}

/**
 * S1에서 들어올 때 열 단계. 그 면접 종류의 결과가 이미 있으면 ③(만든 질문 그대로), 없으면 ①.
 * ①부터 다시 지나가게 하면 ②의 "질문 만들기"가 질문을 다시 만드는 것처럼 보였다(A2-01).
 * hasResult 는 시드를 포함한 결과, saved 는 저장된 결과만
 */
export function entryStep(result: string, hasResult: (mode: Mode) => boolean, saved: (mode: Mode) => boolean = () => false): StepNo {
  return hasResult(entryMode(result, saved)) ? 3 : 1
}

/** S1 면접 준비 버튼 이름(S1-04): 들어갈 면접 종류를 따른다(H2-04 ②) */
export function prepButtonLabel(mode: Mode): string {
  return mode === 'final' ? '최종 면접 준비' : '면접 역질문 준비'
}
