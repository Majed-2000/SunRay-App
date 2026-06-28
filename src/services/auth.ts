/**
 * Auth service interface (OTP login by phone). The app currently uses a mock
 * flow in `authStore` (any 4-digit OTP signs in the demo user). These functions
 * describe the future backend endpoints. The backend talks to the SMS/OTP
 * provider and to Foodics Customers; the app never holds provider secrets.
 *
 * Customer identity is the PHONE number (Foodics matches customers by
 * country_code + phone — `.claude/FOODICS_API.md §5`).
 */
import { request } from './api';
import type { Customer } from './foodics.types';

export interface OtpRequestResult {
  requestId: string;
  expiresInSeconds: number;
}

export interface VerifyOtpResult {
  token: string;
  customer: Customer;
}

/** POST /api/auth/otp/request — backend sends an OTP via the SMS provider. */
export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  return request<OtpRequestResult>('/api/auth/otp/request', {
    method: 'POST',
    body: { phone },
  });
}

/**
 * POST /api/auth/otp/verify — backend verifies the OTP, upserts the Foodics
 * customer (by phone), and returns a session token + customer profile.
 */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  return request<VerifyOtpResult>('/api/auth/otp/verify', {
    method: 'POST',
    body: { phone, code },
  });
}

/** GET /api/auth/me — current session's customer. */
export async function getMe(token: string): Promise<Customer> {
  return request<Customer>('/api/auth/me', { token });
}
