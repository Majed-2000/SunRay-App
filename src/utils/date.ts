import { toArabicDigits } from './numerals';

const DAY = 24 * 60 * 60 * 1000;
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function relativeDayAr(ts: number): string {
  const days = Math.floor((Date.now() - ts) / DAY);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return `قبل ${toArabicDigits(days)} أيام`;
  return formatDateAr(ts);
}

export function formatDateAr(ts: number): string {
  const d = new Date(ts);
  return `${toArabicDigits(d.getDate())} ${MONTHS_AR[d.getMonth()]}`;
}

/** Compact relative time: منذ دقائق / منذ ساعة / منذ ٣ ساعات / أمس / date. */
export function relativeTimeAr(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 1) return 'الآن';
  if (mins < 60) return 'منذ دقائق';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return hours === 1 ? 'منذ ساعة' : `منذ ${toArabicDigits(hours)} ساعات`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'أمس';
  if (days < 7) return `قبل ${toArabicDigits(days)} أيام`;
  return formatDateAr(ts);
}

export const MONTHS_AR_LIST = MONTHS_AR;
