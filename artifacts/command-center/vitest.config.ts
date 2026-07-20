import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Standalone Vitest config for the command-center package.
 *
 * We define the config independently (rather than merging vite.config.ts)
 * because vite.config.ts throws at load-time when PORT/BASE_PATH env-vars
 * are not set — those vars are irrelevant for unit / integration tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Only pick up tests under src/tests/ — exclude the Playwright spec tree.
    include: ['src/tests/**/*.{test,spec}.{ts,tsx}'],
    // Run each test file in an isolated environment so mocks don't bleed.
    isolate: true,
    // Limit concurrency on CI to avoid OOM.
    maxConcurrency: process.env.CI ? 2 : 4,
    // Generous timeout: first-load of some page modules can be slow.
    testTimeout: 20_000,
  },
});
