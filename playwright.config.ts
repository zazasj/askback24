import { defineConfig, devices } from '@playwright/test'

// 시험은 가짜 응답 모드 빌드(vite build --mode mock)를 vite preview로 띄워서 돈다.
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
