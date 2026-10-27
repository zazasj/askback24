/**
 * 질문 만들기 화면을 열 때 AI 서버를 미리 깨운다(첫 호출이 느려서). 이 탭에서 한 번만, 결과는 기다리지 않는다.
 * 가짜 응답 모드에서는 부르지 않는다.
 */
import { API_MODE } from './client'

const KEY = 'rq:v1:warmup'
// 저장이 막힌 브라우저에서도 한 번만 부르게 하는 대비
let done = false

export function warmUpOnce(): void {
  if (API_MODE !== 'real' || done) return
  try {
    if (sessionStorage.getItem(KEY)) {
      done = true
      return
    }
  } catch {
    /* 저장 막힘 — 모듈 변수만 쓴다 */
  }
  done = true
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* 저장 막힘 */
  }
  fetch('/api/warmup', { method: 'POST', keepalive: true }).catch(() => {})
}
