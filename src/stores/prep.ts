/**
 * S4 ② 선택(카드·경험 한 줄)을 지원 건마다 브라우저에 저장한다(rq:v1:prep).
 * 저장이 막혀도 메모리로 동작하고(G-13), "시연 초기화"에 같이 비워진다(G-12).
 * 질문 결과(M3)·1차 면접 정리(M5)는 따로 둔다. 들은 답은 여기에 넣지 않는다(R-09).
 */
import { defineStore } from 'pinia'
import { PRESETS, type PresetKey } from '@shared/catalog'
import type { CardPick, Pref } from '@shared/contract'
import { usePersisted } from '@/lib/storage'
import {
  EXPERIENCE_MAX,
  choose,
  emptySelection,
  fromPreset,
  isSelection,
  toCardPicks,
  toggle,
  type PrepSelection,
} from '@/features/interview-prep/picks'
import { onDemoReset } from './demoTools'

type SelectionBook = Record<string, PrepSelection>

const isSelectionBook = (v: unknown): v is SelectionBook =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every(isSelection)

export const usePrepStore = defineStore('prep', () => {
  const selections = usePersisted<SelectionBook>('prep', () => ({}), isSelectionBook)

  onDemoReset(() => {
    selections.value = {}
  })

  /** 아직 아무것도 고르지 않은 지원 건은 빈 선택(저장하지 않음) */
  function selectionOf(applyId: string): PrepSelection {
    return selections.value[applyId] ?? emptySelection()
  }

  function update(applyId: string, change: (s: PrepSelection) => PrepSelection): void {
    selections.value = { ...selections.value, [applyId]: change(selectionOf(applyId)) }
  }

  function setPref(applyId: string, cardId: string, pref: Pref | null): void {
    update(applyId, (s) => ({ ...s, picks: choose(s.picks, cardId, pref) }))
  }

  /** 라디오를 누를 때: 고른 것을 다시 누르면 풀린다 */
  function togglePref(applyId: string, cardId: string, pref: Pref): void {
    update(applyId, (s) => ({ ...s, picks: toggle(s.picks, cardId, pref) }))
  }

  /** cardId 를 주면(이력서 칩) 그 카드 질문에 붙이고, 직접 고쳐 쓰면 붙일 카드는 그대로 둔다 */
  function setExperience(applyId: string, text: string, cardId?: string | null): void {
    update(applyId, (s) => ({
      ...s,
      experience: text.slice(0, EXPERIENCE_MAX),
      exp_card: cardId === undefined ? s.exp_card : cardId,
    }))
  }

  function fillPreset(applyId: string, key: PresetKey): void {
    update(applyId, () => fromPreset(PRESETS[key]))
  }

  function cardPicks(applyId: string): CardPick[] {
    return toCardPicks(selectionOf(applyId))
  }

  return { selections, selectionOf, setPref, togglePref, setExperience, fillPreset, cardPicks }
})
