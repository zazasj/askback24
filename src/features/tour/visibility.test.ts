/** TR-06·07: 안내 대상 찾기가 checkVisibility 없는 사파리(iOS 16.4~17.3)에서도 예외 없이 같은 답을 낸다 */
import { describe, expect, it, vi } from 'vitest'
import { isShown, type StyleOf, type VisibilityNode } from './visibility'

interface Fake extends VisibilityNode {
  rects: number
  visibility: string
  opacity: string
  parentElement: Fake | null
}

function node(over: Partial<Fake> = {}, parent: Fake | null = null): Fake {
  const n: Fake = { rects: 1, visibility: 'visible', opacity: '1', parentElement: parent, getClientRects: () => ({ length: n.rects }), ...over }
  return n
}

const styleOf: StyleOf = (n) => n as Fake

describe('isShown — checkVisibility 가 없을 때(사파리 17.4 전)', () => {
  it('보이는 요소는 true, 상자가 없으면(display:none 자신·조상) false', () => {
    expect(isShown(node({}, node()), styleOf)).toBe(true)
    expect(isShown(node({ rects: 0 }, node()), styleOf)).toBe(false)
  })

  it('visibility 가 visible 이 아니면 false(물려받은 값이라 자신만 본다)', () => {
    expect(isShown(node({ visibility: 'hidden' }), styleOf)).toBe(false)
    expect(isShown(node({ visibility: 'collapse' }), styleOf)).toBe(false)
    expect(isShown(node({}, node({ visibility: 'hidden' })), styleOf)).toBe(true)
  })

  it('자신이나 조상의 opacity 가 0 이면 false', () => {
    expect(isShown(node({ opacity: '0' }), styleOf)).toBe(false)
    expect(isShown(node({}, node({}, node({ opacity: '0' }))), styleOf)).toBe(false)
    expect(isShown(node({ opacity: '0.5' }, node()), styleOf)).toBe(true)
  })
})

describe('isShown — checkVisibility 가 있으면 그것을 쓴다', () => {
  it('visibility·opacity 를 함께 보라고 넘기고 그 답을 그대로 쓴다', () => {
    const check = vi.fn(() => false)
    const el = node({ checkVisibility: check })
    const spy = vi.fn(styleOf)
    expect(isShown(el, spy)).toBe(false)
    expect(check).toHaveBeenCalledWith({ visibilityProperty: true, opacityProperty: true })
    expect(spy).not.toHaveBeenCalled()
  })
})
