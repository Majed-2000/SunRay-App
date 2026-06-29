/**
 * Ownership + dev-access guards.
 *
 * `requireSelfParam` blocks Insecure Direct Object Reference (IDOR): a logged-in
 * customer may only touch their OWN `/customers/:id/...` resources. It compares
 * the `:id` in the URL with the customerId derived from the access token.
 *
 * `requireDev` gates development/admin-only endpoints (e.g. the order status
 * override). Outside development it returns 404 so the endpoint is invisible.
 *
 * Both assume `authenticate` ran first (so `req.auth` is set).
 */
import type { NextFunction, Request, Response } from 'express';
import { Forbidden, NotFound, Unauthorized } from '../common/errors';
import { env, isProd } from '../config/env';

/** Require the URL `:param` to equal the authenticated customer's id. */
export function requireSelfParam(param = 'id') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Unauthorized('مطلوب تسجيل الدخول'));
    if (req.params[param] !== req.auth.customerId) {
      return next(Forbidden('غير مصرح لك بالوصول لبيانات عميل آخر'));
    }
    next();
  };
}

/** Allow only in development, or when ADMIN_ENABLED=true; otherwise hide (404). */
export function requireDev(_req: Request, _res: Response, next: NextFunction) {
  if (!isProd || env.ADMIN_ENABLED) return next();
  return next(NotFound('المسار غير موجود'));
}
