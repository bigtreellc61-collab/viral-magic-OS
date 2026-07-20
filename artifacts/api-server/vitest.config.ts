import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Run test files in this package only
    include: ["src/**/*.test.ts"],
    // Ensure env vars are set before the DB module is imported
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SESSION_SECRET: "test-secret-for-unit-tests",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      // Map workspace packages to their source so vitest can resolve them
      // without needing a compiled dist/
      "@workspace/db": resolve(__dirname, "../../lib/db/src/index.ts"),
    },
  },
});
