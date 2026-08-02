/**
 * Time-of-day greeting for the home screen.
 *
 * The greeting was hardcoded to "GOOD MORNING ☀ / صباح الإشراق" — the first
 * line a customer reads, wrong for two thirds of the day, and wrong in the most
 * noticeable way for a cafe whose evening trade is real.
 *
 * The bands follow how the day is actually spoken about in the Hijaz rather
 * than clock quarters: صباح runs to the noon prayer, then الظهيرة through the
 * hottest stretch when nobody is walking anywhere, مساء from العصر, and ليل once
 * the shop is lit from inside. "الإشراق" is the brand's own word, so it stays
 * with sunrise and does not get spread across every band.
 */
export interface Greeting {
  /** Latin eyebrow above the headline. */
  eyebrow: string;
  /** Arabic headline, before the customer's name. */
  ar: string;
}

export function greetingFor(date: Date = new Date()): Greeting {
  const h = date.getHours();
  if (h < 5) return { eyebrow: 'STILL UP', ar: 'ليلة هادئة' };
  if (h < 11) return { eyebrow: 'GOOD MORNING ☀', ar: 'صباح الإشراق' };
  if (h < 15) return { eyebrow: 'GOOD AFTERNOON', ar: 'نهارك مشرق' };
  if (h < 19) return { eyebrow: 'GOOD EVENING', ar: 'مساء الخير' };
  return { eyebrow: 'GOOD EVENING 🌙', ar: 'مساؤك ورد' };
}
