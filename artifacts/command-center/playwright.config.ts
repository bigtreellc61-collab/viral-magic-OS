import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for command-center navigation tests.
 *
 * The test server starts the Vite dev server on a dedicated port (5174)
 * so it doesn't collide with the normal dev workflow (which reads PORT from
 * the environment).  BASE_PATH=/ keeps all routes at the root, which is the
 * simplest layout for a self-contained test environment.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    // Don't wait longer than 15 s for any navigation / assertion
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Use the same pnpm filter pattern as the workflow so the build env is
    // identical. PORT / BASE_PATH are supplied here; the vite config reads
    // them at startup.
    command: 'pnpm --filter @workspace/command-center run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: '5174',
      BASE_PATH: '/',
    },
  },
});
