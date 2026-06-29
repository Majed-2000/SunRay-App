/**
 * Express app factory.
 *
 * The app is built here and EXPORTED (without calling `listen`) so tests can
 * drive it in-process with supertest. `server.ts` imports this and starts it.
 *
 * Middleware order matters — requests flow top to bottom:
 *   trust proxy → helmet → cors → json(limit) → logger → rate limit → routes
 *   → 404 → error handler.
 */
import express from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import { env, corsOrigins } from './config/env';
import { requestLogger } from './common/logger';
import { errorHandler, notFoundHandler } from './common/errors';
import { apiLimiter } from './common/rateLimit';
import { rootRouter } from './routes';

/**
 * CORS policy. With no allowlist configured we reflect any origin (convenient in
 * development). Configure `CORS_ORIGINS` in production to restrict it. Requests
 * with no `Origin` header (curl, the mobile app) are always allowed — CORS is a
 * browser concern only.
 */
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (corsOrigins.length === 0) return callback(null, true);
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
};

export function createApp() {
  const app = express();

  // Behind a proxy/load balancer, trust N hops so the client IP used for rate
  // limiting is the real one (and X-Forwarded-For can't be spoofed past it).
  app.set('trust proxy', env.TRUST_PROXY);

  // Security headers (also strips X-Powered-By).
  app.use(helmet());

  // Cross-origin access for browser callers.
  app.use(cors(corsOptions));

  // Parse JSON bodies, rejecting anything larger than the configured limit.
  app.use(express.json({ limit: env.BODY_LIMIT }));

  // One log line per finished request.
  app.use(requestLogger);

  // General rate limit across the whole API. Stricter per-route limiters live
  // inside individual routers (auth, orders, gift-card redeem, dev endpoint).
  app.use('/api', apiLimiter);

  // /health (root) and everything under /api.
  app.use(rootRouter);

  // Unknown route → standard 404 JSON.
  app.use(notFoundHandler);

  // Final error handler — converts ANY error to our standard envelope.
  app.use(errorHandler);

  return app;
}

export const app = createApp();
