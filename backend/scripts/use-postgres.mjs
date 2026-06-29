/**
 * Switch the Prisma datasource provider from sqlite → postgresql.
 *
 * Prisma fixes the `provider` at the schema level (it cannot be an env var), and
 * the SQLite migrations don't apply to Postgres. To keep ONE source of truth for
 * the models while supporting both dev (SQLite) and prod (Postgres), this script
 * rewrites only the `datasource` block. It runs INSIDE the production Docker build
 * (on the container's copy of the schema) — do NOT run it on your dev checkout, or
 * it will flip your local schema (rerun with `sqlite` to undo).
 *
 * Usage: node scripts/use-postgres.mjs [postgresql|sqlite]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2] === 'sqlite' ? 'sqlite' : 'postgresql';
const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '../prisma/schema.prisma');

const original = readFileSync(schemaPath, 'utf8');
const updated = original.replace(
  /datasource\s+db\s*\{[\s\S]*?\}/,
  `datasource db {
  provider = "${target}"
  url      = env("DATABASE_URL")
}`,
);

if (updated === original) {
  console.error('use-postgres: could not find the datasource block to rewrite.');
  process.exit(1);
}

writeFileSync(schemaPath, updated);
console.log(`use-postgres: datasource provider set to "${target}".`);
