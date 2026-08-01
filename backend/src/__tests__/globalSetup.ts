/**
 * Vitest global setup — prepare an isolated PostgreSQL test database.
 *
 * Tests run against the same engine as production (see README §3). SQLite was
 * the previous setup, and deleting a file was its isolation; PostgreSQL has no
 * equivalent, so the safety has to be explicit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 THE GUARD BELOW IS NOT OPTIONAL
 *
 * The suite truncates tables. Development and production databases live on the
 * SAME PostgreSQL instance, reachable through the same SSH tunnel, differing
 * only by the name at the end of DATABASE_URL. One wrong tunnel, one copied
 * .env, one exported shell variable — and a test run wipes real data.
 *
 * So we refuse to start unless the database name ends with `_test`. Cheap,
 * absolute, and it fails before a single row is touched.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Database name from a PostgreSQL URL, ignoring query parameters. */
function databaseNameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

export default function setup() {
  const url = process.env.DATABASE_URL ?? '';
  const dbName = databaseNameOf(url);

  if (!url) {
    throw new Error('DATABASE_URL is not set — refusing to run tests against an unknown database.');
  }

  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${dbName || url}".\n` +
        'The suite truncates tables, and this database name does not end with "_test".\n' +
        'Production and development sit on the same server; this guard is what stops a\n' +
        'mistyped connection string from wiping them. Point DATABASE_URL at sunray_test.',
    );
  }

  // Build the schema from the committed migrations. `migrate deploy` only rolls
  // forward — it never resets or drops — so it stays safe even if this somehow
  // ran against a populated database.
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../../'),
    stdio: 'inherit',
    env: process.env,
  });
}
