import { defineConfig, devices } from '@playwright/test';
import { baseURL, scaled } from './config/environments';

const video = process.env.VIDEO === '1';
// Tests tagged @uses-up-users approve pool users for good, so they only run with USE_UP_USERS=1 (npm run test:use-up-users)
const useUpUsers = process.env.USE_UP_USERS === '1';

export default defineConfig({
  testDir: './tests',
  grepInvert: useUpUsers ? undefined : /@uses-up-users/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: scaled(30_000),
  expect: { timeout: scaled(10_000) },
  use: {
    baseURL,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    actionTimeout: scaled(15_000),
    navigationTimeout: scaled(30_000),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // VIDEO=1 records every test, slowed down so it can be followed as evidence (SLOWMO=ms, 0 = off)
    video: video ? 'on' : 'retain-on-failure',
    launchOptions: { slowMo: Number(process.env.SLOWMO || (video ? 500 : 0)) },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
