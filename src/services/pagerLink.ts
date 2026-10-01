/**
 * What a scanned code means, and the follow-code alphabet — pure, no Firebase.
 *
 * Kept apart from `storePager.ts` so the rules can be unit-tested in Node:
 * deciding which QR codes the app will act on is a security boundary, not a
 * UI detail, and it should not need a device to check.
 *
 * ## Why a regex and not `new URL()`
 *
 * React Native's `URL` is a partial polyfill: on several RN versions `host`,
 * `pathname` and `searchParams` throw "not implemented". A parser that throws
 * on a real customer's phone would reject every Sun Ray code, so the shape is
 * matched by hand — and matched strictly, so `https://sunray.sa@evil.example`
 * or `https://sunray.sa.evil.example` can never pass as ours.
 */

/** Same hosts the website's scanner accepts (`scan.html`, `HOSTS`). */
const SUNRAY_URL = /^(https?):\/\/(?:www\.)?sunray\.sa(\/[^?#\s]*)?(\?[^#\s]*)?(#\S*)?$/i;

/** Cashier QR token: 64 lowercase hex. The site's pager checks exactly this. */
export const PAGER_TOKEN_RE = /^[a-f0-9]{64}$/;
/** Pager session returned by `pagerOpen` / `pagerFollow`: 48 lowercase hex. */
export const PAGER_SESSION_RE = /^[a-f0-9]{48}$/;

/** The site serves the pager both as `pager.html` and under a clean URL. */
const PAGER_PATH = /^\/store\/pager(?:\.html)?\/?$/i;

export type ScanResult =
  /** A cashier pager code — open the pager screen in the app. */
  | { kind: 'pager'; token?: string; session?: string }
  /** Some other sunray.sa page — open it in the browser (always https). */
  | { kind: 'site'; url: string }
  /** Not ours. The app does not open arbitrary links from a camera. */
  | { kind: 'foreign' };

function param(query: string | undefined, key: string): string | null {
  if (!query) return null;
  for (const pair of query.replace(/^[?#]/, '').split('&')) {
    const eq = pair.indexOf('=');
    const k = eq < 0 ? pair : pair.slice(0, eq);
    if (k === key) {
      try {
        return decodeURIComponent(eq < 0 ? '' : pair.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Classify the text inside a QR code.
 *
 * Mirrors the website: only `sunray.sa` / `www.sunray.sa` over http(s). A
 * pager link carries `?t=<64hex>`; the follow flow can also put the session
 * after `#s=` (the site keeps it out of the query so it never reaches a
 * server log), so both are understood. A pager link with neither is treated
 * as a plain site page rather than a broken pager.
 */
export function classifyScan(raw: string): ScanResult {
  const text = String(raw ?? '').trim();
  const m = SUNRAY_URL.exec(text);
  if (!m) return { kind: 'foreign' };
  const [, , path = '/', query, hash] = m;
  if (PAGER_PATH.test(path)) {
    const t = param(query, 't');
    const s = param(hash, 's');
    const token = t && PAGER_TOKEN_RE.test(t) ? t : undefined;
    const session = s && PAGER_SESSION_RE.test(s) ? s : undefined;
    if (token || session) return { kind: 'pager', token, session };
  }
  // Opened in the browser, so upgrade the scheme: a plain-http link on a
  // café's Wi-Fi is exactly where a page can be swapped in transit.
  return { kind: 'site', url: text.replace(/^http:/i, 'https:') };
}

/** Follow-code alphabet: no 0/O, 1/I/L — the letters people misread. */
export const FOLLOW_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FOLLOW_LENGTH = 6;

/**
 * Normalize what the customer typed into a follow code.
 *
 * Same rule as the site's `storeapp.html`: upper-case, drop anything outside
 * the alphabet, keep six. Arabic-Indic digits are mapped first because the
 * Arabic keyboard types them, and the alphabet's 2–9 would otherwise vanish.
 */
export function normalizeFollowCode(input: string): string {
  return String(input ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toUpperCase()
    .split('')
    .filter((c) => FOLLOW_ALPHABET.includes(c))
    .join('')
    .slice(0, FOLLOW_LENGTH);
}

/** Point-of-sale line as `pagerInvoice` returns it (Foodics snapshot). */
export interface PosLine {
  name: string;
  qty: number;
  returned?: number;
  unit?: number;
  total?: number | null;
  mods?: { name?: string }[];
}

/** `pagerInvoice().order` — amounts in riyals, as Foodics reports them. */
export interface PosSnapshot {
  checkNumber?: string;
  number?: string;
  closedAt?: number | string;
  branchName?: string;
  subtotal?: number;
  taxExclDiscount?: number;
  discount?: number;
  rounding?: number;
  total?: number;
  lines?: PosLine[];
  payments?: { method?: string; amount?: number }[];
}

export interface ReceiptLine {
  name: string;
  qty: number;
  mods: string;
  lineHalalas: number | null;
}

export interface Receipt {
  code: string;
  number: string;
  branchName?: string;
  closedAt?: number | string;
  lines: ReceiptLine[];
  subExclHalalas: number;
  vatHalalas: number;
  discountHalalas: number;
  roundingHalalas: number;
  totalHalalas: number;
  payments: { method: string; amountHalalas: number }[];
}

const h = (v: unknown) => Math.round((Number(v) || 0) * 100);

/**
 * Turn a POS snapshot into a receipt — the site's `SRInvoiceDoc.fromPos`.
 *
 * The totals are the point of sale's own, never re-added from the lines: a
 * receipt whose sum disagrees with what the customer paid is worse than none.
 * VAT is derived as total − rounding − subtotal so it always balances to the
 * halala. Missing pieces return null instead of a misleading document.
 */
export function receiptFromPos(number: string | undefined, s: PosSnapshot | null | undefined): Receipt | null {
  if (!s || !s.checkNumber || s.total == null || s.subtotal == null || !s.lines || !s.lines.length) return null;
  const subExcl = (Number(s.subtotal) || 0) - (Number(s.taxExclDiscount) || 0);
  const totalHalalas = h(s.total);
  const roundingHalalas = h(s.rounding);
  const subExclHalalas = Math.round(subExcl * 100);
  const lines = s.lines
    .filter((l) => (Number(l.qty) || 0) - (Number(l.returned) || 0) > 0)
    .map((l) => ({
      name: String(l.name ?? ''),
      qty: (Number(l.qty) || 0) - (Number(l.returned) || 0),
      mods: (l.mods ?? []).map((m) => m?.name).filter(Boolean).join(' · '),
      lineHalalas: l.total != null ? h(l.total) : null,
    }));
  return {
    code: String(s.checkNumber),
    number: String(number || s.number || ''),
    branchName: s.branchName,
    closedAt: s.closedAt,
    lines,
    subExclHalalas,
    vatHalalas: totalHalalas - roundingHalalas - subExclHalalas,
    discountHalalas: h(s.discount),
    roundingHalalas,
    totalHalalas,
    payments: (s.payments ?? []).map((p) => ({ method: String(p.method || '—'), amountHalalas: h(p.amount) })),
  };
}
