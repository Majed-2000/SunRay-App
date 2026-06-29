import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    // Tests share one SQLite test DB, so run files sequentially (no parallel writes).
    fileParallelism: false,
    hookTimeout: 60_000,
    // These are applied to process.env before any module (incl. config/env.ts) loads.
    // dotenv won't override already-set vars, so the dev .env can't leak into tests.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_ACCESS_SECRET: 'test-secret-not-for-production',
      ACCESS_TTL: '15m',
      REFRESH_TTL_DAYS: '30',
    },
  },
});
