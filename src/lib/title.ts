import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'

export const TITLE_SUFFIX = ' | 고용24 (시연)'

export function setDocumentTitle(title: string): void {
  document.title = `${title}${TITLE_SUFFIX}`
}

/** 화면마다 제목이 달라지는 곳(공고 상세 등)에서 쓴다. 고정 제목은 router meta.title 로 충분하다. */
export function usePageTitle(title: MaybeRefOrGetter<string | undefined>): void {
  watchEffect(() => {
    const t = toValue(title)
    if (t) setDocumentTitle(t)
  })
}

export const NOT_FOUND_TITLE = '페이지를 찾을 수 없어요'
