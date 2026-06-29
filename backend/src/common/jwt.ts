/**
 * Access-token signing/verification (HS256 JWT).
 *
 * The access token is short-lived and carries just enough to identify the caller:
 *   sub = customerId, sid = sessionId.
 * It is verified statelessly by signature; the `authenticate` middleware ALSO
 * checks the session row so logout/expiry takes effect immediately.
 */
import jwt from 'jsonwebtoken';
import { env, ACCESS_TTL_SECONDS } from '../config/env';

export interface AccessClaims {
  /** customerId */
  sub: string;
  /** sessionId */
  sid: string;
}

export function signAccess(claims: AccessClaims): string {
  return jwt.sign({ sub: claims.sub, sid: claims.sid }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

/** Verify signature + expiry and return our claims. Throws if invalid/expired. */
export function verifyAccess(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || typeof (decoded as { sid?: unknown }).sid !== 'string') {
    throw new Error('Invalid access token payload');
  }
  return { sub: String(decoded.sub), sid: (decoded as { sid: string }).sid };
}
