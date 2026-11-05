/**
 * 안내가 비출 대상이 보이는지(display·visibility·opacity). Element.checkVisibility 는 사파리 17.4부터라
 * 그 전 아이폰(iOS 16.4~17.3)에서 부르면 예외로 안내가 멈춘다 — 없으면 같은 기준을 직접 본다.
 */
export interface VisibilityNode {
  checkVisibility?: (options?: CheckVisibilityOptions) => boolean
  getClientRects(): { readonly length: number }
  readonly parentElement: VisibilityNode | null
}

export type StyleOf = (n: VisibilityNode) => { visibility: string; opacity: string }

const domStyle: StyleOf = (n) => getComputedStyle(n as unknown as Element)

export function isShown(el: VisibilityNode, styleOf: StyleOf = domStyle): boolean {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
  // 자신이나 조상이 display:none 이면 상자가 없다
  if (el.getClientRects().length === 0) return false
  // visibility 는 물려받으므로 자신만, opacity 는 조상까지(checkVisibility 와 같은 기준)
  if (styleOf(el).visibility !== 'visible') return false
  for (let n: VisibilityNode | null = el; n; n = n.parentElement) if (styleOf(n).opacity === '0') return false
  return true
}
