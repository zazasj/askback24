/**
 * 1차 면접 정리 입력(들은 답·답 모양·못 물은 이유·회사가 물어본 업무·분위기). 지원 건마다 메모리에만 둔다.
 * 면접 답변과 분위기는 기본 저장하지 않는다(R-09, 추가 개발 노트 「남은 결정」 3). 새로고침하면 지워지고 최종 질문만 남는다.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Clarity, Mood, NotAskedReason, Question } from '@shared/contract'
import {
  HEARD_MAX,
  emptyReviewDraft,
  exampleDraft,
  itemOf,
  type AskedChoice,
  type ReviewDraft,
  type ReviewItemDraft,
} from '@/features/interview-prep/review'
import { onDemoReset } from './demoTools'

export const useReviewStore = defineStore('review', () => {
  const drafts = ref<Record<string, ReviewDraft>>({})

  onDemoReset(() => {
    drafts.value = {}
  })

  function draftOf(applyId: string): ReviewDraft {
    return drafts.value[applyId] ?? emptyReviewDraft()
  }

  function update(applyId: string, change: (d: ReviewDraft) => ReviewDraft): void {
    drafts.value = { ...drafts.value, [applyId]: change(draftOf(applyId)) }
  }

  function updateItem(applyId: string, cardId: string, change: (i: ReviewItemDraft) => ReviewItemDraft): void {
    update(applyId, (d) => ({ ...d, items: { ...d.items, [cardId]: change(itemOf(d, cardId)) } }))
  }

  function setAsked(applyId: string, cardId: string, asked: AskedChoice): void {
    updateItem(applyId, cardId, (i) => ({ ...i, asked }))
  }

  function setHeard(applyId: string, cardId: string, heard: string): void {
    updateItem(applyId, cardId, (i) => ({ ...i, heard: heard.slice(0, HEARD_MAX) }))
  }

  function setClarity(applyId: string, cardId: string, clarity: Clarity): void {
    updateItem(applyId, cardId, (i) => ({ ...i, clarity }))
  }

  function setReason(applyId: string, cardId: string, reason: NotAskedReason | null): void {
    updateItem(applyId, cardId, (i) => ({ ...i, reason }))
  }

  function toggleReceived(applyId: string, cardId: string, on: boolean): void {
    update(applyId, (d) => {
      const rest = d.received.filter((id) => id !== cardId)
      return { ...d, received: on ? [...rest, cardId] : rest }
    })
  }

  function setMood(applyId: string, mood: Mood): void {
    update(applyId, (d) => ({ ...d, mood }))
  }

  /** 시연 도구 "1차 면접 다녀온 것으로 채우기" */
  function fillExample(applyId: string, questions: readonly Question[]): void {
    drafts.value = { ...drafts.value, [applyId]: exampleDraft(questions) }
  }

  return { drafts, draftOf, setAsked, setHeard, setClarity, setReason, toggleReceived, setMood, fillExample }
})
