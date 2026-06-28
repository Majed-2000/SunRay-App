/** Arabic-Indic numeral helpers. The app currently renders Eastern Arabic digits. */
const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Convert any number/string to Eastern Arabic digits (٠١٢٣…). */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => EASTERN[Number(d)]);
}

/** Convert Eastern Arabic digits back to Western (for parsing input). */
export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));
}

/** Format a riyal amount with Eastern digits + ﷼ symbol, e.g. "٢٨ ﷼". */
export function formatRiyal(amount: number, withSymbol = true): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = Number.isInteger(rounded)
    ? toArabicDigits(rounded)
    : toArabicDigits(rounded.toFixed(2));
  return withSymbol ? `${text} ﷼` : text;
}

/** The riyal glyph, exposed for layouts that place it separately. */
export const RIYAL = '﷼';
