import { defineConfig, devices } from '@playwright/test'

// 시험은 가짜 응답 모드 빌드(vite build --mode mock)를 vite preview로 띄워서 돈다.

/**
 * TR-09 시험 스위치: localStorage rq:test:tour-off = "1"이면 처음 온 사람 안내가 저절로 뜨지 않는다("시연 초기화"로 지워지지 않음).
 * 기존 시험은 모두 이 스위치를 켠 채 돈다. 안내(TR) 시험만 test.use({ storageState: { cookies: [], origins: [] } })로 비운 새 context에서 돈다.
 * origin을 4173으로 한정해, 이 설정을 펼쳐 쓰는 심사위원용 다른 포트(4179·4181~4185) 설정에는 스위치가 들어가지 않는다.
 */
export const TOUR_OFF_STATE = {
  cookies: [],
  origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'rq:test:tour-off', value: '1' }] }],
}

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: 'review/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: TOUR_OFF_STATE,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: 'npm run build:mock && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
