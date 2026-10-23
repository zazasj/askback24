/** 클립보드 복사 + 알림. 클립보드를 못 쓰는 브라우저(권한·http)에서는 직접 선택하도록 안내한다. */
import { useToastStore } from '@/stores/toast'

export const COPIED = '복사했어요'

export function useCopy() {
  const toast = useToastStore()

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      toast.show(COPIED)
      return true
    } catch {
      toast.show('복사하지 못했어요. 문장을 길게 눌러 직접 선택해 주세요')
      return false
    }
  }

  return { copy }
}
