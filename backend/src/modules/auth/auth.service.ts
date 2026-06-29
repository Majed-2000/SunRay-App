/**
 * Auth service — development-grade real tokens (OTP itself is still mock).
 *
 * Flow:
 *  1) requestOtp(phone)         -> pretend to send an OTP (any 4-digit code works).
 *  2) verifyOtp(phone, code)    -> find/create the customer, create a Session, and
 *                                  return { accessToken, refreshToken, expiresIn, customer }.
 *  3) refresh(refreshToken)     -> validate + ROTATE the refresh token, mint a new access.
 *  4) logout(sessionId)         -> revoke the session (refresh stops working immediately).
 *  5) me(customerId)            -> the current session's customer.
 *
 * Security:
 *  - The refresh token is an opaque random secret; we persist only its sha256 hash.
 *  - The access token is a short-lived signed JWT (see common/jwt.ts).
 *
 * PRODUCTION TODO: replace the mock OTP with a real SMS/OTP provider, and consider
 * a refresh-token "family" id to auto-revoke a whole chain if a rotated token is
 * replayed (theft detection). See docs/SECURITY_HARDENING_NOTES.md.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../../database/prisma';
import { env, ACCESS_TTL_SECONDS } from '../../config/env';
import { signAccess } from '../../common/jwt';
import { Unauthorized } from '../../common/errors';
import { findOrCreateByPhone, getCustomerById, toCustomerDTO } from '../customers/customers.service';

const REFRESH_BYTES = 32;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(REFRESH_BYTES).toString('base64url');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function requestOtp(_phone: string) {
  // We don't store anything in this mock — the code is ignored on verify.
  return {
    requestId: randomUUID(),
    expiresInSeconds: 300,
    devHint: 'تجريبي: أدخل أي ٤ أرقام في خطوة التحقق',
  };
}

/** Create a Session row and return a fresh access + refresh pair. */
async function issueSession(customerId: string, userAgent?: string) {
  const refreshToken = newRefreshToken();
  const session = await prisma.session.create({
    data: {
      customerId,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: userAgent?.slice(0, 255),
      expiresAt: refreshExpiry(),
    },
  });
  const accessToken = signAccess({ sub: customerId, sid: session.id });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

export async function verifyOtp(phone: string, _code: string, userAgent?: string) {
  const customer = await findOrCreateByPhone(phone);
  const tokens = await issueSession(customer.id, userAgent);
  return { ...tokens, customer: toCustomerDTO(customer) };
}

/** Validate a refresh token, ROTATE it (same session row), and mint a new access. */
export async function refresh(rawRefreshToken: string, userAgent?: string) {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(rawRefreshToken) },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw Unauthorized('انتهت الجلسة، يرجى تسجيل الدخول من جديد');
  }

  const rotated = newRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(rotated),
      lastUsedAt: new Date(),
      userAgent: userAgent?.slice(0, 255) ?? session.userAgent,
    },
  });

  const accessToken = signAccess({ sub: session.customerId, sid: session.id });
  return { accessToken, refreshToken: rotated, expiresIn: ACCESS_TTL_SECONDS };
}

/** Revoke a session so its refresh token (and the per-request check) fail. Idempotent. */
export async function logout(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(customerId: string) {
  return getCustomerById(customerId);
}
