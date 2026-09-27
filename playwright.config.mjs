import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  // A stray test.only would silently skip the rest of the suite in CI.
  forbidOnly: !!process.env.CI,
})
