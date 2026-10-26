/**
 * 처음 온 사람 안내(TR)의 자리 계산. DOM 을 읽지 않는 순수 함수라 단위 시험으로 잰다.
 * 좌표는 모두 화면(viewport) 기준 px. 구멍 = 비출 대상 둘레(대상 + PAD), 상자 = 설명 상자.
 */

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface View {
  vw: number
  vh: number
}

/** 대상과 구멍 테두리 사이 */
export const PAD = 8
/** 구멍과 설명 상자 사이 */
export const GAP = 16
/** 설명 상자와 화면 끝 사이 */
export const EDGE = 16
/**
 * 구멍이 화면 끝에 닿지 않게 남기는 거리. 양옆 끝에 다 닿으면 "화면 전체가 밝은" 것과 구분되지 않고,
 * 아래끝에 닿으면 화면 밖까지 이어진 구멍처럼 보인다(TR-07). 위는 시연 띠의 "시연 도구"가 화면 맨 위라 짧게
 */
export const HOLE_SIDE = 12
export const HOLE_TOP = 4
export const HOLE_BOTTOM = 12
/** 이보다 좁거나 낮으면 구멍을 내지 않고 대상 없는 상자로 */
export const MIN_HOLE = 24
/** 데스크톱 설명 상자 폭 */
export const BOX_WIDTH = 380

export type Side = 'below' | 'above' | 'right' | 'left'
/** 같은 이동 거리면 이 순서: 아래가 먼저(읽는 순서), 그다음 위, 옆 */
export const SIDES: readonly Side[] = ['below', 'above', 'right', 'left']

export const intersects = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const grow = (r: Rect, g: number): Rect => ({ left: r.left - g, top: r.top - g, right: r.right + g, bottom: r.bottom + g })

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi))

export function boxWidth(vw: number): number {
  return Math.min(BOX_WIDTH, vw - EDGE * 2)
}

/**
 * 대상 둘레의 구멍. 화면 안(위 limitTop · 아래 limitBottom)으로 자르고, 잘라서 너무 작아지면 null.
 * 대상이 화면 밖으로 일부 나가 있어도 보이는 부분만 비춘다(화면 밖 구멍 없음).
 */
export function holeFor(t: Rect, v: View, limitBottom = v.vh - HOLE_BOTTOM, limitTop = HOLE_TOP): Rect | null {
  const r: Rect = {
    left: Math.max(t.left - PAD, HOLE_SIDE),
    right: Math.min(t.right + PAD, v.vw - HOLE_SIDE),
    top: Math.max(t.top - PAD, limitTop),
    bottom: Math.min(t.bottom + PAD, limitBottom),
  }
  return r.right - r.left >= MIN_HOLE && r.bottom - r.top >= MIN_HOLE ? r : null
}

/** 구멍의 한쪽에 붙인 상자. 붙인 쪽과 직각 방향은 구멍 가운데에 맞추되 화면 안으로 */
export function boxAt(side: Side, hole: Rect, v: View, bw: number, bh: number): Rect {
  const cx = (hole.left + hole.right) / 2
  const cy = (hole.top + hole.bottom) / 2
  const left = side === 'right' ? hole.right + GAP : side === 'left' ? hole.left - GAP - bw : clamp(cx - bw / 2, EDGE, v.vw - EDGE - bw)
  const top = side === 'below' ? hole.bottom + GAP : side === 'above' ? hole.top - GAP - bh : clamp(cy - bh / 2, EDGE, v.vh - EDGE - bh)
  return { left, top, right: left + bw, bottom: top + bh }
}

/** 상자 전체가 화면 안(끝에서 EDGE)이고 구멍과 GAP 이상 떨어져 있다 */
export function boxFits(box: Rect, v: View, hole: Rect | null): boolean {
  const inside = box.left >= EDGE - 0.5 && box.top >= EDGE - 0.5 && box.right <= v.vw - EDGE + 0.5 && box.bottom <= v.vh - EDGE + 0.5
  return inside && (!hole || !intersects(box, grow(hole, GAP - 1)))
}

export interface DesktopPlace {
  hole: Rect | null
  box: { top: number; left: number }
}

function center(v: View, bw: number, bh: number): { top: number; left: number } {
  return { top: Math.max(EDGE, Math.round((v.vh - bh) / 2)), left: Math.max(EDGE, Math.round((v.vw - bw) / 2)) }
}

/**
 * 데스크톱: 구멍 아래·위·오른쪽·왼쪽 중 상자가 화면 안에 다 들어가고 구멍과 겹치지 않는 첫 자리.
 * 어디에도 안 들어가면(대상이 화면만큼 큼) 상자를 화면 아래(안 되면 위)에 두고 구멍을 그 사이만큼 자른다.
 * 대상이 없거나 화면 밖이면 대상 없는 가운데 상자.
 */
export function placeDesktop(t: Rect | null, v: View, bw: number, bh: number): DesktopPlace {
  const mid = center(v, bw, bh)
  const hole = t ? holeFor(t, v) : null
  if (!t || !hole) return { hole: null, box: mid }
  for (const side of SIDES) {
    const b = boxAt(side, hole, v, bw, bh)
    if (boxFits(b, v, hole)) return { hole, box: { top: Math.round(b.top), left: Math.round(b.left) } }
  }
  const lowTop = v.vh - EDGE - bh
  const cut = holeFor(t, v, lowTop - GAP)
  if (cut) return { hole: cut, box: { top: Math.round(lowTop), left: mid.left } }
  const cutTop = holeFor(t, v, v.vh - HOLE_BOTTOM, EDGE + bh + GAP)
  if (cutTop) return { hole: cutTop, box: { top: EDGE, left: mid.left } }
  return { hole: null, box: mid }
}

/** 휴대폰: 상자는 화면 아래 시트(높이 bh). 구멍은 시트 위에서만(시트에 가리는 부분은 자른다) */
export function placeSheet(t: Rect | null, v: View, bh: number): Rect | null {
  return t ? holeFor(t, v, v.vh - bh - GAP) : null
}

/** 스크롤 양(아래로 +)이 [min, max] 안이면 되는 자리. 0에 가장 가까운 값을 고른다 */
type Span = [min: number, max: number]

const nearestZero = ([min, max]: Span): number => clamp(0, min, max)

/**
 * 데스크톱에서 "다음"으로 대상을 화면 안으로 옮길 세로 스크롤 양. 구멍과 상자가 함께 들어가는 자리(아래·위·옆) 가운데 덜 움직이는 쪽.
 * bottomCover = 화면 아래에 붙은 고정 바가 덮는 높이(구멍은 그 위에 있어야 한다, 상자는 바를 덮어도 된다).
 * 어느 자리도 안 되면(대상이 화면만큼 큼) 대상 위끝을 화면 위에 맞춘다(구멍은 placeDesktop 이 자른다).
 */
export function scrollDelta(t: Rect, v: View, bw: number, bh: number, bottomCover = 0): number {
  const top = t.top - PAD
  const bottom = t.bottom + PAD
  const lo = EDGE
  const hi = v.vh - Math.max(EDGE, bottomCover)
  const spans: Span[] = []
  // 아래: 구멍 위끝 ≥ lo, 구멍 아래끝 ≤ hi, 상자 아래끝 ≤ 화면 아래 - EDGE
  spans.push([Math.max(bottom - hi, bottom + GAP + bh - (v.vh - EDGE)), top - lo])
  // 위: 상자 위끝 ≥ EDGE, 구멍 아래끝 ≤ hi
  spans.push([bottom - hi, top - GAP - bh - EDGE])
  // 옆: 가로 자리가 있으면 구멍만 화면 안
  const sideRoom = Math.max(t.left - PAD - GAP - EDGE, v.vw - EDGE - (t.right + PAD + GAP))
  if (sideRoom >= bw && bh <= v.vh - EDGE * 2) spans.push([bottom - hi, top - lo])
  const ok = spans.filter(([min, max]) => min <= max)
  if (!ok.length) return top - lo
  return ok.map(nearestZero).reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a))
}

/** 휴대폰: 대상을 시트 위 칸(화면 위 EDGE ~ 시트 위끝 - GAP)으로 옮길 세로 스크롤 양. 칸보다 크면 위끝을 맞춘다 */
export function sheetScrollDelta(t: Rect, v: View, bh: number): number {
  const top = t.top - PAD
  const bottom = t.bottom + PAD
  const lo = EDGE
  const hi = v.vh - bh - GAP
  if (bottom - top > hi - lo) return top - lo
  return nearestZero([bottom - hi, top - lo])
}
