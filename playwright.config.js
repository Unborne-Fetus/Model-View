import { defineConfig, devices } from '@playwright/test';

const chromiumFlags = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
  '--enable-unsafe-swiftshader'
];

export default defineConfig({
  testDir: 'web/e2e',
  testMatch: 'model-view*.spec.js',
  timeout: 45000,
  expect: { timeout: 16000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  use: {
    baseURL: 'http://127.0.0.1:4173/Model-View/',
    acceptDownloads: true,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name:'chromium', testMatch:'model-view*.spec.js',
      use:{ ...devices['Desktop Chrome'], launchOptions:{args:chromiumFlags} } },
    { name:'firefox', testMatch:'model-view.compat.spec.js',
      use:{ ...devices['Desktop Firefox'] } },
    { name:'webkit', testMatch:'model-view.compat.spec.js',
      use:{ ...devices['Desktop Safari'] } },
    { name:'mobile-chrome', testMatch:'model-view.compat.spec.js',
      use:{ ...devices['Pixel 7'], launchOptions:{args:chromiumFlags} } },
    { name:'mobile-safari', testMatch:'model-view.compat.spec.js',
      use:{ ...devices['iPhone 13'] } },
  ],
  reporter: [['list'], ['html',{open:'never',outputFolder:'playwright-report'}]],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/Model-View/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
