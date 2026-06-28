import { toWesternDigits } from './numerals';

/** Saudi mobile: 9 digits, starts with 5 (local form, after +966). */
export function isValidSaudiMobile(local: string): boolean {
  const digits = toWesternDigits(local).replace(/\D/g, '');
  return /^5\d{8}$/.test(digits);
}

/** Normalize a phone field to digits only (Western), max 9. */
export function normalizeMobile(input: string): string {
  return toWesternDigits(input).replace(/\D/g, '').slice(0, 9);
}

/** Format local mobile for display: 5X XXX XXXX. */
export function formatMobileDisplay(local: string): string {
  const d = normalizeMobile(local);
  if (!d) return '';
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean);
  return parts.join(' ');
}

/** OTP: 4 digits. */
export function isValidOtp(code: string): boolean {
  return /^\d{4}$/.test(toWesternDigits(code));
}

export function isNonEmpty(s: string): boolean {
  return s.trim().length > 0;
}
