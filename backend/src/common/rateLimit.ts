/**
 * Rate limiting (IP-based, in-memory).
 *
 * We expose a small factory plus a set of pre-tuned limiters for the routes that
 * matter. Every limiter returns OUR standard error envelope on 429 so the mobile
 * app can handle it like any other error.
 *
 * PRODUCTION NOTE: the default store is in-memory — it resets on restart and is
 * NOT shared across instances. Before running more than one process, swap in a
 * shared store (e.g. `rate-limit-redis`). IP-based keying also depends on a
 * correct `trust proxy` setting (see config/env TRUST_PROXY).
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../config/env';

const MINUTE = 60_000;

/** Shared 429 handler — keeps the response shape identical to all other errors. */
function rateLimitedHandler(_req: Request, res: Response) {
  res.status(429).json({
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'محاولات كثيرة، يرجى المحاولة بعد قليل.' },
  });
}

interface LimiterOpts {
  windowMs: number;
  limit: number;
  /** Bypass entirely while running the test suite (so tests aren't throttled). */
  skipInTest?: boolean;
}

/** Build a limiter with our standard envelope + headers. */
export function createLimiter({ windowMs, limit, skipInTest }: LimiterOpts): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler,
    skip: skipInTest ? () => env.NODE_ENV === 'test' : undefined,
  });
}

// General ceiling for /api. Deliberately high: the app polls order tracking every
// few seconds, so a low limit would 429 normal use. Tune for real traffic.
export const apiLimiter = createLimiter({ windowMs: 15 * MINUTE, limit: 1000, skipInTest: true });

// Brute-force defense for OTP login/verify and token refresh.
export const authLimiter = createLimiter({ windowMs: 15 * MINUTE, limit: 10, skipInTest: true });

// Gift card redeem is cash-like — keep it tight.
export const giftRedeemLimiter = createLimiter({ windowMs: 60 * MINUTE, limit: 10, skipInTest: true });

// Order creation — moderate.
export const orderCreateLimiter = createLimiter({ windowMs: 10 * MINUTE, limit: 30, skipInTest: true });

// Dev/admin status endpoint — strict.
export const devLimiter = createLimiter({ windowMs: MINUTE, limit: 20, skipInTest: true });
