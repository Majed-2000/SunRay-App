# Production image for the Sun Ray backend (PostgreSQL).
#
# Build and run stages share the same base so Prisma's auto-detected "native"
# query-engine binary matches at runtime (no binaryTargets juggling needed).

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Prisma's engines link against libssl; node:slim (bookworm) ships without it.
# Install it BEFORE npm ci/prisma generate so the correct engine is selected.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install ALL deps (incl. prisma CLI + tsc) for the build.
COPY package*.json ./
RUN npm ci

COPY . .
# The schema targets PostgreSQL directly now — development, test and production
# all use it, so there is no provider to flip at build time. The script that did
# that (scripts/use-postgres.mjs) is gone along with SQLite.
RUN npx prisma generate \
 && npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# libssl is needed at runtime too (prisma db push + the @prisma/client engine).
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy node_modules from build (includes the generated Prisma client + prisma CLI,
# which the entrypoint needs to apply the schema to the database).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY package*.json ./

EXPOSE 4000

# On start: ensure the DB schema exists (idempotent, additive), then run the server.
# `db push` creates/updates tables from the schema. For ongoing prod changes,
# prefer generating real Postgres migrations and running `prisma migrate deploy`
# as a separate release step (see DEPLOYMENT.md). Single-instance friendly.
# `migrate deploy` applies the reviewed migration files and nothing else.
#
# This used to be `db push`, which infers changes from the schema and refuses
# anything it deems risky — it rejected a unique constraint as "possible data
# loss" and crash-looped the container, twice. Schema changes then had to be
# applied by hand with psql, which is how production ended up with no migration
# history at all. `migrate deploy` never guesses and never drops.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
