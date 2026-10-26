/** TR-06·TR-07: 안내 설명 상자는 화면 안, 비춘 곳과 겹치지 않고, 구멍은 화면 밖으로 나가지 않는다 */
import { describe, expect, it } from 'vitest'
import {
  BOX_WIDTH,
  EDGE,
  GAP,
  HOLE_BOTTOM,
  HOLE_SIDE,
  HOLE_TOP,
  PAD,
  boxWidth,
  holeFor,
  intersects,
  placeDesktop,
  placeSheet,
  scrollDelta,
  sheetScrollDelta,
  type Rect,
  type View,
} from './tourLayout'

const rect = (left: number, top: number, width: number, height: number): Rect => ({ left, top, right: left + width, bottom: top + height })
const D1440: View = { vw: 1440, vh: 900 }
const D1366: View = { vw: 1366, vh: 657 }
const M375: View = { vw: 375, vh: 812 }
const BH = 215

function boxRect(p: { top: number; left: number }, bw: number, bh: number): Rect {
  return { left: p.left, top: p.top, right: p.left + bw, bottom: p.top + bh }
}

function inside(r: Rect, v: View): boolean {
  return r.left >= EDGE - 0.5 && r.top >= EDGE - 0.5 && r.right <= v.vw - EDGE + 0.5 && r.bottom <= v.vh - EDGE + 0.5
}

describe('holeFor: 구멍 = 대상 + 여백, 화면 끝에 닿지 않게 자른다', () => {
  it('화면 가운데 대상은 여백만큼 넓힌다', () => {
    expect(holeFor(rect(100, 200, 80, 40), D1440)).toEqual({ left: 100 - PAD, top: 200 - PAD, right: 180 + PAD, bottom: 240 + PAD })
  })

  it('양옆·위·아래 끝에서 정한 거리만큼 띄운다(화면 전체 폭·화면 밖 구멍 없음)', () => {
    const h = holeFor(rect(0, 0, 1440, 2000), D1440)!
    expect(h.left).toBe(HOLE_SIDE)
    expect(h.right).toBe(1440 - HOLE_SIDE)
    expect(h.top).toBe(HOLE_TOP)
    expect(h.bottom).toBe(900 - HOLE_BOTTOM)
  })

  it('화면 밖이거나 잘라서 너무 작으면 null(대상 없는 상자)', () => {
    expect(holeFor(rect(100, 1200, 80, 40), D1440)).toBeNull()
    expect(holeFor(rect(100, -100, 80, 40), D1440)).toBeNull()
    expect(holeFor(rect(100, 880, 80, 40), D1440)).toBeNull()
  })
})

describe('placeDesktop: 상자는 화면 안, 구멍과 GAP 이상 떨어진다', () => {
  it('대상이 없으면 가운데 상자, 구멍 없음', () => {
    const p = placeDesktop(null, D1440, BOX_WIDTH, BH)
    expect(p.hole).toBeNull()
    expect(p.box.left).toBe(Math.round((1440 - BOX_WIDTH) / 2))
  })

  it('아래에 자리가 있으면 아래', () => {
    const t = rect(100, 110, 100, 56)
    const p = placeDesktop(t, D1440, BOX_WIDTH, BH)
    expect(p.box.top).toBeGreaterThanOrEqual(p.hole!.bottom + GAP)
  })

  it('아래에 자리가 없으면 위', () => {
    const t = rect(1180, 650, 120, 40)
    const p = placeDesktop(t, D1440, BOX_WIDTH, BH)
    expect(boxRect(p.box, BOX_WIDTH, BH).bottom).toBeLessThanOrEqual(p.hole!.top - GAP)
  })

  it('화면만큼 큰 대상은 상자를 아래에 두고 구멍을 그 위까지만 자른다', () => {
    const t = rect(380, 200, 960, 900)
    const p = placeDesktop(t, D1366, BOX_WIDTH, BH)
    const b = boxRect(p.box, BOX_WIDTH, BH)
    expect(inside(b, D1366)).toBe(true)
    expect(p.hole).not.toBeNull()
    expect(intersects(p.hole!, b)).toBe(false)
  })

  it('여러 대상·화면에서 상자는 늘 화면 안이고 구멍과 겹치지 않는다', () => {
    let seed = 7
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (const v of [D1440, D1366, { vw: 1100, vh: 900 }, { vw: 1024, vh: 600 }]) {
      const bw = boxWidth(v.vw)
      for (let i = 0; i < 400; i++) {
        const w = 20 + rand() * (v.vw - 40)
        const h = 20 + rand() * v.vh * 1.2
        const t = rect(rand() * (v.vw - w), -100 + rand() * (v.vh + 200), w, h)
        const bh = 150 + Math.round(rand() * 120)
        const p = placeDesktop(t, v, bw, bh)
        const b = boxRect(p.box, bw, bh)
        expect(inside(b, v), `${JSON.stringify(t)} 상자 ${JSON.stringify(b)} 화면 ${v.vw}×${v.vh}`).toBe(true)
        if (p.hole) {
          expect(intersects(p.hole, b), `${JSON.stringify(t)} 구멍 ${JSON.stringify(p.hole)} 상자 ${JSON.stringify(b)}`).toBe(false)
          expect(p.hole.left).toBeGreaterThanOrEqual(HOLE_SIDE)
          expect(p.hole.right).toBeLessThanOrEqual(v.vw - HOLE_SIDE)
          expect(p.hole.bottom).toBeLessThanOrEqual(v.vh - HOLE_BOTTOM)
        }
      }
    }
  })
})

describe('placeSheet: 휴대폰 시트 위에만 구멍', () => {
  it('시트 위 대상은 그대로, 시트에 걸치면 시트 위끝 - GAP 까지 자른다', () => {
    expect(placeSheet(rect(16, 300, 343, 100), M375, 220)).toEqual({ left: 12, top: 292, right: 363, bottom: 408 })
    const cut = placeSheet(rect(16, 500, 343, 200), M375, 220)!
    expect(cut.bottom).toBe(812 - 220 - GAP)
  })

  it('시트 뒤에 숨은 대상(아래 고정 바)은 구멍 없음', () => {
    expect(placeSheet(rect(16, 730, 343, 70), M375, 220)).toBeNull()
  })
})

describe('scrollDelta·sheetScrollDelta: "다음"이면 대상을 화면 안으로', () => {
  it('이미 상자와 함께 들어가면 움직이지 않는다', () => {
    expect(scrollDelta(rect(100, 110, 100, 56), D1440, BOX_WIDTH, BH)).toBe(0)
  })

  it('화면 아래 대상은 아래로, 위 대상은 위로 옮긴다', () => {
    expect(scrollDelta(rect(380, 1200, 900, 300), D1440, BOX_WIDTH, BH)).toBeGreaterThan(0)
    expect(scrollDelta(rect(380, -400, 900, 300), D1440, BOX_WIDTH, BH)).toBeLessThan(0)
  })

  it('옮긴 뒤에는 구멍과 상자가 함께 화면에 들어간다', () => {
    for (const v of [D1440, D1366]) {
      const t = rect(380, 1300, 960, 315)
      const d = scrollDelta(t, v, BOX_WIDTH, BH)
      const moved = rect(t.left, t.top - d, t.right - t.left, t.bottom - t.top)
      const p = placeDesktop(moved, v, BOX_WIDTH, BH)
      expect(p.hole).not.toBeNull()
      expect(p.hole!.bottom - p.hole!.top).toBe(315 + PAD * 2)
    }
  })

  it('아래 고정 바가 덮는 높이 위로 구멍을 올린다', () => {
    const t = rect(380, 700, 900, 120)
    expect(scrollDelta(t, D1440, BOX_WIDTH, BH, 100)).toBeGreaterThan(scrollDelta(t, D1440, BOX_WIDTH, BH, 0))
  })

  it('휴대폰: 시트 위 칸에 들도록, 칸보다 크면 위끝을 맞춘다', () => {
    expect(sheetScrollDelta(rect(16, 300, 343, 100), M375, 220)).toBe(0)
    const d = sheetScrollDelta(rect(16, 900, 343, 200), M375, 220)
    expect(900 + 200 + PAD - d).toBeLessThanOrEqual(812 - 220 - GAP)
    expect(sheetScrollDelta(rect(16, 900, 343, 900), M375, 220)).toBe(900 - PAD - EDGE)
  })
})
