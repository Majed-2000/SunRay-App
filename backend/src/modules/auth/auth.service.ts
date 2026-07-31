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
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { prisma } from '../../database/prisma';
import { env, ACCESS_TTL_SECONDS } from '../../config/env';
import { signAccess } from '../../common/jwt';
import { Unauthorized, BadRequest } from '../../common/errors';
import { findOrCreateByPhone, getCustomerById, toCustomerDTO } from '../customers/customers.service';
import { sendSms } from './sms.yamamah';

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

/** Cryptographically random 4-digit code. Math.random() is not acceptable here. */
function newOtpCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, '0');
}

/**
 * Start a login. With a real provider this generates a code, stores only its
 * hash, and sends it by SMS. With OTP_PROVIDER=mock it keeps the old behaviour
 * so local development needs no SMS account.
 */
export async function requestOtp(phone: string) {
  if (env.OTP_PROVIDER === 'mock') {
    return {
      requestId: randomUUID(),
      expiresInSeconds: env.OTP_TTL_SECONDS,
      devHint: 'تجريبي: أدخل أي ٤ أرقام في خطوة التحقق',
    };
  }

  const code = newOtpCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  // Invalidate any earlier pending code so only the newest one can be used —
  // otherwise every resend would widen the guessing surface.
  await prisma.otpChallenge.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const challenge = await prisma.otpChallenge.create({
    data: { phone, codeHash: hashToken(code), expiresAt },
  });

  const minutes = Math.round(env.OTP_TTL_SECONDS / 60);
  const sent = await sendSms(phone, `رمز الدخول إلى سن راي: ${code}\nصالح لمدة ${minutes} دقائق.`);

  if (!sent.ok) {
    // Burn the challenge: a code nobody received must not stay guessable.
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw BadRequest('تعذّر إرسال رمز التحقق، حاول مرة أخرى');
  }

  return { requestId: challenge.id, expiresInSeconds: env.OTP_TTL_SECONDS };
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

export async function verifyOtp(phone: string, code: string, userAgent?: string) {
  if (env.OTP_PROVIDER !== 'mock') {
    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    // One deliberately vague message for "no code", "expired", "too many tries"
    // and "wrong code" alike — distinguishing them tells an attacker which
    // phone numbers have a login in progress.
    const rejected = Unauthorized('رمز التحقق غير صحيح أو منتهي الصلاحية');
    if (!challenge) throw rejected;

    if (challenge.attempts + 1 >= env.OTP_MAX_ATTEMPTS) {
      // Burn it on the final attempt whether or not this guess is right, so a
      // 4-digit code can never be walked through.
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 }, consumedAt: new Date() },
      });
      throw rejected;
    }

    if (challenge.codeHash !== hashToken(code)) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw rejected;
    }

    // Correct: consume it immediately so the code is strictly single-use.
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

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
