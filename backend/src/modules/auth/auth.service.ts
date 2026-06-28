/**
 * Auth service — MOCK ONLY. There is no real SMS and no real security here.
 *
 * Flow:
 *  1) login(phone)  -> we pretend to send an OTP and return a fake "session".
 *  2) verify(phone, code) -> we accept ANY 4-digit code, find/create the customer
 *     by phone, and return the customer + a FAKE token.
 *
 * Later (production), this is replaced by a real SMS/OTP provider and a real
 * signed token (JWT) — and that logic lives on the backend, never in the app.
 */
import { randomUUID } from 'node:crypto';
import { findOrCreateByPhone, toCustomerDTO } from '../customers/customers.service';

export function requestOtp(_phone: string) {
  // We don't store anything in this mock — the code is ignored on verify.
  return {
    requestId: randomUUID(),
    expiresInSeconds: 300,
    devHint: 'تجريبي: أدخل أي ٤ أرقام في خطوة التحقق',
  };
}

export async function verifyOtp(phone: string, _code: string) {
  const customer = await findOrCreateByPhone(phone);
  // FAKE token — just encodes the customer id. Not secure; for development only.
  const token = `dev.${Buffer.from(customer.id).toString('base64url')}`;
  return { token, customer: toCustomerDTO(customer) };
}
