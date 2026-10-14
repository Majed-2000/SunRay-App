import { toWesternDigits } from './numerals';

/** Saudi mobile: 9 digits, starts with 5 (local form, after +966). */
export function isValidSaudiMobile(local: string): boolean {
  return /^5\d{8}$/.test(normalizeMobile(local));
}

/**
 * Normalize a phone field to the 9-digit local form (Western digits).
 * Strips a leading `00966`, `966` or `0` first, so `0501234567`, `+966501234567`
 * and `501234567` all become `501234567`.
 */
export function normalizeMobile(input: string): string {
  let d = toWesternDigits(input).replace(/\D/g, '');
  if (d.startsWith('00966')) d = d.slice(5);
  else if (d.startsWith('966')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
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

/** Left-to-Right Mark. `writingDirection` is iOS-only; this works on Android too. */
export const LRM = String.fromCharCode(0x200e);

/**
 * Prefix text with an LRM so a phone number keeps its left-to-right order
 * ("+966 50 123 4567") inside an RTL line instead of being reordered.
 */
export function ltr(text: string): string {
  return text ? LRM + text : text;
}
