import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

/**
 * Test configuration reads `.env.test` — one file, one source of truth for the
 * test database. The credentials are not committed (`.env.test` is gitignored).
 *
 * It is loaded here, in the config process, and ALSO pushed into `test.env` for
 * the worker processes. Vitest's `test.env` reaches test files but NOT
 * globalSetup, and globalSetup is where the "database must end in _test" guard
 * lives — so it has to see the value too. Duplicating the URL in two places
 * would eventually let them drift, and a drifted test URL is how a suite ends
 * up truncating the wrong database.
 */
const { parsed = {} } = loadEnv({ path: '.env.test' });
Object.assign(process.env, parsed);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globalSetup: ['src/__tests__/globalSetup.ts'],
    // One shared PostgreSQL test database, so files run sequentially rather than
    // racing each other's truncations.
    fileParallelism: false,
    hookTimeout: 60_000,
    // Applied to process.env before any module (including config/env.ts) loads.
    // dotenv will not override an already-set variable, so the dev .env cannot
    // leak in and point the suite at the wrong database.
    env: {
      ...parsed,
      ACCESS_TTL: '15m',
      REFRESH_TTL_DAYS: '30',
    },
  },
});
