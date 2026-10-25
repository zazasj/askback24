/**
 * 인쇄·전체 복사 순서(H1-14): "면접에서 쓸 것 같아요"를 누른 질문을 맨 위로, 나머지는 화면 순서 그대로.
 * 실제 면접에서는 한두 개만 물을 수 있어 꼭 물을 것을 먼저 보이게 한다. 화면 순서는 바꾸지 않는다.
 */
export function keptFirst<T>(items: readonly T[], isKept: (item: T) => boolean): T[] {
  return [...items.filter(isKept), ...items.filter((q) => !isKept(q))]
}
