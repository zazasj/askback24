/** 지원일은 고정 날짜 대신 "오늘 기준 며칠 전"으로 만든다(심사 기간에 봐도 최근 기록처럼 보이게). */

const pad = (n: number) => String(n).padStart(2, '0')

/** 오늘 0시 기준 n일 전 */
export function daysBefore(days: number, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

/** 2026.10.14 */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** 2026-10-14 (저장용) */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
