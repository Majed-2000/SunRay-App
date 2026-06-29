/**
 * `authenticate` — require a valid access token AND a live session.
 *
 * Steps:
 *  1) Read the `Authorization: Bearer <jwt>` header.
 *  2) Verify the JWT signature + expiry.
 *  3) Confirm the session row still exists, isn't revoked, and hasn't expired.
 *     (This DB check is what makes logout/expiry take effect immediately instead
 *     of waiting for the access token's 15-minute lifetime to run out.)
 *
 * On success it sets `req.auth = { customerId, sessionId }`. On any failure it
 * forwards a 401 through the standard error handler.
 *
 * PRODUCTION NOTE: the per-request session lookup is a single indexed read. At
 * higher scale, cache it (e.g. Redis) to avoid a DB round-trip per request.
 */
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { Unauthorized, AppError } from '../common/errors';
import { verifyAccess } from '../common/jwt';

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) throw Unauthorized('مطلوب تسجيل الدخول');

    const { sub, sid } = verifyAccess(token); // throws on bad/expired signature

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { id: true, customerId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.customerId !== sub) {
      throw Unauthorized('انتهت الجلسة، يرجى تسجيل الدخول من جديد');
    }

    req.auth = { customerId: sub, sessionId: sid };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : Unauthorized('الرمز غير صالح أو منتهي'));
  }
}
