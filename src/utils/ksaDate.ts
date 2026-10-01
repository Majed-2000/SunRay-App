/**
 * Gregorian dates in Riyadh time, written out by hand.
 *
 * The website formats these as `ar-EG-u-ca-gregory` in Asia/Riyadh — explicitly
 * *not* plain `ar-SA`, whose default calendar is Hijri, so a receipt dated
 * 2 October would read as a date in Rabi' al-Thani. Hermes' Intl support for
 * calendars and time zones varies by platform, so rather than hope the engine
 * agrees, the date is built from UTC+3 (Saudi Arabia has no daylight saving).
 */
import { toArabicDigits } from './numerals';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** «٢ أكتوبر ٢٠٢٦», or with `time` «٢ أكتوبر ٢٠٢٦ · ٩:٠٥م». Empty for a missing date. */
export function ksaDate(ms: number | null | undefined, time = false): string {
  if (!ms || !Number.isFinite(Number(ms))) return '';
  const d = new Date(Number(ms) + 3 * 60 * 60 * 1000);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!time) return toArabicDigits(date);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return toArabicDigits(`${date} · ${h % 12 || 12}:${m}`) + (h < 12 ? 'ص' : 'م');
}
