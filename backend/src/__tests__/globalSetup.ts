/**
 * Vitest global setup — build a fresh, isolated SQLite test database before the
 * suite runs. We never touch the dev database (dev.db); tests use prisma/test.db.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default function setup() {
  const backendRoot = resolve(__dirname, '../../');
  const dbFile = resolve(backendRoot, 'prisma/test.db');

  // Remove any leftover test DB so each run starts clean (the file is the only
  // state; deleting it is what guarantees isolation — no destructive reset needed).
  for (const file of [dbFile, `${dbFile}-journal`]) {
    if (existsSync(file)) rmSync(file);
  }

  // Apply migrations forward to the fresh, empty test DB. `migrate deploy` is the
  // non-destructive, production-safe command (it never resets/drops data), so it
  // builds the full schema from prisma/migrations without touching dev.db.
  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
