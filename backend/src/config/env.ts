/**
 * Environment configuration.
 *
 * We load values from the `.env` file (via dotenv) and validate them with Zod.
 * If something is missing/wrong, the server refuses to start and prints a clear
 * message — much better than a confusing crash later.
 */
import 'dotenv/config';
import { z } from 'zod';

/**
 * Insecure secret used ONLY in development/test so the project runs with no setup.
 * In production the server refuses to boot if the secret is still this value.
 */
const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Security middleware ────────────────────────────────────────────────────
  /** Comma-separated allowlist of browser origins. Empty = permissive (dev). */
  CORS_ORIGINS: z.string().default(''),
  /** Max JSON body size accepted by the server. */
  BODY_LIMIT: z.string().default('100kb'),
  /** Number of proxy hops to trust for client IP (rate limiting). 0 = none. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // ── Auth / tokens ──────────────────────────────────────────────────────────
  /** HMAC secret for signing access JWTs. MUST be overridden in production. */
  JWT_ACCESS_SECRET: z.string().min(1).default(DEV_JWT_SECRET),
  /** Access token lifetime (any `jsonwebtoken` expiresIn string, e.g. "15m"). */
  ACCESS_TTL: z.string().default('15m'),
  /** Refresh token lifetime in days. */
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** When true, dev/admin-only endpoints are allowed even in production. */
  ADMIN_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // ── Foodics POS ────────────────────────────────────────────────────────────
  /**
   * Long-lived Foodics access token. This is a SECRET with write access to the
   * real business — it belongs in deploy/.env on the server, never in the app
   * bundle and never in git. Empty disables all Foodics calls, so the backend
   * still boots and serves the locally-seeded menu.
   */
  FOODICS_TOKEN: z.string().default(''),
  FOODICS_BASE_URL: z.string().url().default('https://api.foodics.com/v5'),
  /**
   * Foodics branch UUID that the app orders from. Menu sync keeps only products
   * linked to this branch, because /products cannot be filtered by branch
   * server-side (filter[branches.id] returns 400) — we filter locally instead.
   */
  FOODICS_BRANCH_ID: z.string().default(''),
  /**
   * Master switch for anything that WRITES to Foodics (order injection).
   * Deliberately separate from the token: syncing the menu is read-only and
   * harmless, whereas POST /orders puts a real ticket in front of real staff at
   * the counter. Keep this false until the branch is genuinely ready.
   */
  FOODICS_ORDER_INJECTION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * Which OTP provider actually verifies the login code.
   *
   * `mock` means ANY 4-digit code authenticates ANY phone number — so the phone
   * in a session proves nothing about who is holding it. Features that expose
   * personal data keyed by phone MUST refuse to run while this is `mock`; see
   * foodics.history.ts. Set to a real provider only once it genuinely verifies.
   */
  OTP_PROVIDER: z.enum(['mock', 'unifonic', 'msegat', 'twilio']).default('mock'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

// Never ship the insecure development secret to production.
if (isProd && env.JWT_ACCESS_SECRET === DEV_JWT_SECRET) {
  console.error('❌ JWT_ACCESS_SECRET must be set to a strong, unique value in production.');
  process.exit(1);
}

// Reject a weak (crackable) signing secret in production. A randomBytes(48) value
// (~64 chars, what deploy/prod.env.example generates) passes comfortably; keep the
// exact dev-default check above too (the dev default is 34 chars and would slip past this).
if (isProd && env.JWT_ACCESS_SECRET.length < 32) {
  console.error('❌ JWT_ACCESS_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

/** Parsed CORS allowlist (empty array = reflect any origin, intended for dev). */
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Access-token TTL expressed in seconds, for the `expiresIn` field we return. */
export const ACCESS_TTL_SECONDS = ttlToSeconds(env.ACCESS_TTL);

/** Convert a short TTL string ("15m", "30s", "2h", "1d") to seconds. */
function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) return 900; // sensible default (15m)
  const value = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * factor;
}
