/**
 * Vercel 함수 POST /api/questions (웹 표준 형식, D-015). 1차·최종을 mode 하나로 받는다(D-011).
 * LLM 키는 여기서 process.env 로만 읽는다.
 */
import { handleQuestions } from './_lib/handler.js'

export function POST(request: Request): Promise<Response> {
  return handleQuestions(request, {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    AI_ENDPOINT: process.env.AI_ENDPOINT,
    AI_API_KEY: process.env.AI_API_KEY,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_AUTOMATION_BYPASS_SECRET: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  })
}
