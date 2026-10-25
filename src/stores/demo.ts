/** 지원 내역·안내 띠 상태. 브라우저에 저장하되 저장이 막혀도 메모리로 동작한다. */
import { defineStore } from 'pinia'
import { getPosting } from '@shared/catalog'
import { cloneSeed } from '@/demoData'
import { toIsoDate } from '@/lib/dates'
import { isBoolean, usePersisted } from '@/lib/storage'
import type { Application } from '@/types'

const isApplicationList = (v: unknown): v is Application[] =>
  Array.isArray(v) &&
  v.every(
    (a) =>
      typeof a === 'object' &&
      a !== null &&
      typeof (a as Application).apply_id === 'string' &&
      typeof (a as Application).wantedAuthNo === 'string' &&
      typeof (a as Application).result === 'string' &&
      ['corpNm', 'wantedTitle'].every((k) => {
        const v = (a as Record<string, unknown>)[k]
        return v === undefined || typeof v === 'string'
      }),
  )

export const useDemoStore = defineStore('demo', () => {
  const applications = usePersisted<Application[]>('applications', cloneSeed, isApplicationList)
  const guideClosed = usePersisted<boolean>('guide-closed', () => false, isBoolean)

  function findApplication(applyId: string): Application | undefined {
    return applications.value.find((a) => a.apply_id === applyId)
  }

  function hasApplied(wantedAuthNo: string): boolean {
    return applications.value.some((a) => a.wantedAuthNo === wantedAuthNo)
  }

  /** S3 입사지원: 맨 위에 한 줄 더한다. 반환값은 새 apply_id */
  function apply(wantedAuthNo: string, now: Date = new Date()): string {
    const used = new Set(applications.value.map((a) => a.apply_id))
    let n = applications.value.length + 1
    while (used.has(`A-${String(n).padStart(4, '0')}`)) n++
    const applyId = `A-${String(n).padStart(4, '0')}`
    const posting = getPosting(wantedAuthNo)
    applications.value.unshift({
      apply_id: applyId,
      wantedAuthNo,
      applied_on: toIsoDate(now),
      viewed_days_ago: null,
      result: '-',
      // 공고가 목록에서 빠져도 지원 내역에 남기려고 이름을 같이 둔다(H2-16)
      ...(posting ? { corpNm: posting.corpNm, wantedTitle: posting.wantedTitle } : {}),
    })
    return applyId
  }

  function closeGuide(): void {
    guideClosed.value = true
  }

  function showGuide(): void {
    guideClosed.value = false
  }

  function reset(): void {
    applications.value = cloneSeed()
    guideClosed.value = false
  }

  return { applications, guideClosed, findApplication, hasApplied, apply, closeGuide, showGuide, reset }
})
