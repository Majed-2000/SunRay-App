/**
 * Catering and support-ticket rules, as the website applies them.
 *
 * Pure functions only — no Firebase — so they can be tested in node and so the
 * screens and the record writers cannot drift apart. Every figure and every
 * string that lands in a record is copied from sunray.sa, not designed here:
 *
 *   catering  → web_main/js/client-catering.js + catering.html
 *   tickets   → web_main/js/tickets.js + ticket.html
 *   statuses  → store/js/store-account.js (CK_AR / TK_AR)
 *
 * The staff dashboard reads app submissions and website submissions from the
 * same nodes, so a field spelled differently here is a field staff never see.
 */

// ---------------------------------------------------------------------------
// Catering — packs and money
// ---------------------------------------------------------------------------

/**
 * The website's packs. They are radio values in catering.html, not config: the
 * site does not read them from the database, so neither can the app. The
 * stored `order.pack` is the raw radio value (`"50|699"`), which is what the
 * dashboard parses — keep the strings byte-identical.
 */
export const CATERING_PACKS = [
  { value: '50|699', cups: 50, priceSar: 699 },
  { value: '100|1150', cups: 100, priceSar: 1150 },
  { value: '150|1850', cups: 150, priceSar: 1850 },
  { value: '200|2650', cups: 200, priceSar: 2650 },
] as const;

/** «أكثر…» — more than 200 cups, priced per extra cup. */
export const PACK_MORE = 'more';
export type CateringPack = (typeof CATERING_PACKS)[number]['value'] | typeof PACK_MORE;

/** 15 ﷼ per cup above 200 — the site notes this matches the server. */
export const EXTRA_CUP_SAR = 15;
/** catering.html: `<input id="moreCups" min="201" max="1000">`. */
export const MORE_CUPS_MIN = 201;
export const MORE_CUPS_MAX = 1000;

/** Refundable equipment insurance, added to whatever is paid. */
export const INSURANCE_SAR = 300;
/** Non-refundable deposit share of the service total. */
export const DEPOSIT_RATE = 0.7;

/** The drinks the site offers (two must be picked). */
export const CATERING_DRINKS = ['قهوة مقطرة', 'كركديه', 'ايس تي'] as const;

/** Service total in riyals, or null while the pick is incomplete. Mirrors `currentTotal()`. */
export function packTotal(pack: CateringPack | null, moreCups: number): number | null {
  if (!pack) return null;
  const fixed = CATERING_PACKS.find((p) => p.value === pack);
  if (fixed) return fixed.priceSar;
  if (pack === PACK_MORE) {
    return moreCups > 200 && moreCups <= MORE_CUPS_MAX ? Math.round(2650 + (moreCups - 200) * EXTRA_CUP_SAR) : null;
  }
  return null;
}

export interface CateringQuote {
  total: number;
  /** 70% of the total, rounded the way the site rounds it. */
  deposit: number;
  insurance: number;
  /** Paid now on «العربون + التأمين». */
  depositDue: number;
  /** Paid now on «كامل المبلغ». */
  fullDue: number;
  /** What `finance.remain` stores: total − deposit (insurance excluded). */
  remain: number;
}

/** The money summary exactly as `calcPrice()` and the submit handler compute it. */
export function quote(total: number): CateringQuote {
  const deposit = Math.round(total * DEPOSIT_RATE);
  return {
    total,
    deposit,
    insurance: INSURANCE_SAR,
    depositDue: deposit + INSURANCE_SAR,
    fullDue: total + INSURANCE_SAR,
    remain: total - deposit,
  };
}

// ---------------------------------------------------------------------------
// Catering — dates
// ---------------------------------------------------------------------------

const p2 = (n: number) => String(n).padStart(2, '0');

/** Local `YYYY-MM-DD` — the format the site's `<input type="date">` stores. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Whole days from today to `dateStr` (local midnight to midnight). Mirrors `daysUntilDate`. */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return 999;
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

/** The site's booking window: from tomorrow to 30 days out. */
export const MIN_DAYS_AHEAD = 1;
export const MAX_DAYS_AHEAD = 30;

/**
 * The days a customer may pick: tomorrow to +30, minus any date the
 * dashboard closed in `announcements/cateringSystem/blockedDates`.
 *
 * The site also scans every catering record to refuse a third booking on a
 * date. The app deliberately does not: that scan only works because
 * `sunray/catering` is world-readable, which is a leak, not a feature. The team
 * confirms each request instead, and the screen says so.
 */
export function bookableDates(blocked: Record<string, unknown> | null | undefined, now: Date = new Date()): string[] {
  const out: string[] = [];
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  for (let i = MIN_DAYS_AHEAD; i <= MAX_DAYS_AHEAD; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const key = ymd(d);
    if (blocked?.[key] === true) continue;
    out.push(key);
  }
  return out;
}

/**
 * Day names as catering.html's `<select id="day">` spells them — «الاحد» and
 * «الاربعاء» without hamza. That select is what the site stores, so these are
 * the strings the dashboard has always received.
 */
const DAY_NAMES = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;

export function dayNameFor(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return '';
  return DAY_NAMES[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
}

/** ≤3 days away: the site forces card payment (bank transfer disabled). */
export function isUrgent(dateStr: string, now: Date = new Date()): boolean {
  return daysUntil(dateStr, now) <= 3;
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/**
 * `CK-####` / `TK-####`, four digits 1000–9999, as both pages generate them.
 * Not unique — the site accepts the collision risk and so does `shortIndex`
 * (last write wins). The push key is the real identity; the code is for people.
 */
export function genCode(prefix: 'CK' | 'TK', rand: () => number = Math.random): string {
  return `${prefix}-${Math.floor(rand() * 9000 + 1000)}`;
}

/** Accept «TK-1234», «tk 1234», «١٢٣٤» or «1234»; return «TK-1234» or null. */
export function normalizeTicketCode(input: string): string | null {
  const digits = String(input ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/^\s*tk\s*-?\s*/i, '')
    .trim();
  return /^\d{4}$/.test(digits) ? `TK-${digits}` : null;
}

// ---------------------------------------------------------------------------
// Catering — the record
// ---------------------------------------------------------------------------

export interface CateringInput {
  name: string;
  /** Local `05XXXXXXXX`, the format the site's phone field enforces. */
  phone: string;
  occasion: string;
  date: string;
  /** `HH:MM`, 24-hour. */
  time: string;
  location: { lat: number | null; lng: number | null; desc: string };
  pack: CateringPack;
  moreCups: number;
  drinks: [string, string];
  notes: string;
}

/**
 * The record the site pushes to `sunray/catering`, field for field.
 *
 * `createdAt` / `agreedTermsAt` are passed in so the caller can hand over the
 * RTDB server-timestamp sentinel (keeps this module free of Firebase).
 *
 * Fields copied as the site writes them, including the odd ones:
 *  - `location.lat/lng` are STRINGS on the site (read from hidden inputs) or
 *    null. Written as strings here too, so the dashboard parses one shape.
 *  - `payMethodChosen` is always `"card"`: the app has no bank transfer.
 *  - No `source`/`channel` field: the site's catering record has none, and a
 *    new field is one the dashboard was never written to expect.
 */
export function buildCateringRecord(input: CateringInput, code: string, timestamp: unknown) {
  const total = packTotal(input.pack, input.moreCups);
  if (total == null) throw new Error('catering: incomplete pack');
  const q = quote(total);
  return {
    code,
    client: { name: input.name.trim(), phone: input.phone.trim() },
    eventDetails: {
      occasion: input.occasion.trim(),
      date: input.date,
      time: input.time,
      day: dayNameFor(input.date),
      location: {
        lat: input.location.lat != null ? String(input.location.lat) : null,
        lng: input.location.lng != null ? String(input.location.lng) : null,
        desc: input.location.desc.trim(),
      },
    },
    order: {
      pack: input.pack,
      moreCups: input.pack === PACK_MORE ? input.moreCups : 0,
      drinks: [input.drinks[0], input.drinks[1]],
      notes: input.notes.trim(),
    },
    finance: {
      total: q.total,
      deposit: q.deposit,
      insurance: INSURANCE_SAR,
      remain: q.remain,
      status: 'pending_verify',
    },
    status: 'new',
    agreedTerms: true,
    agreedTermsAt: timestamp,
    payMethodChosen: 'card',
    createdAt: timestamp,
  };
}

/** What we read back. Every field optional: the dashboard edits these records. */
export interface CateringRecord {
  code?: string;
  status?: string;
  client?: { name?: string; phone?: string };
  eventDetails?: { occasion?: string; date?: string; time?: string; day?: string; location?: { desc?: string } };
  order?: { pack?: string; moreCups?: number; drinks?: string[] };
  finance?: { total?: number; deposit?: number; insurance?: number; remain?: number; paidHalalas?: number; status?: string };
}

/** CK_AR from store-account.js — the labels the customer's account page shows. */
export const CATERING_STATUS_AR: Record<string, string> = {
  new: 'بانتظار الدفع',
  pending: 'قيد المراجعة',
  confirmed: 'مؤكد',
  delivered: 'تم التسليم',
  closed: 'مكتمل',
  cancelled: 'ملغي',
};

/** Halalas paid so far, as the server records it (`finance.paidHalalas`). */
export function paidHalalas(rec: CateringRecord | null | undefined): number {
  const n = Number(rec?.finance?.paidHalalas);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * What is still owed, in halalas, for display.
 *
 * ⚠️ Inferred, not read: the account page gets `remainderHalalas` from the
 * `myOrders` callable, whose source is not in this repo. This assumes the full
 * bill is total + insurance (what «كامل المبلغ» charges) less what has been
 * paid. The figure actually charged always comes from `createCateringPayment`.
 */
export function remainderHalalas(rec: CateringRecord | null | undefined): number {
  const total = Number(rec?.finance?.total);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const insurance = Number(rec?.finance?.insurance ?? INSURANCE_SAR) || 0;
  return Math.max(0, Math.round((total + insurance) * 100) - paidHalalas(rec));
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export type TicketType = 'complaint' | 'suggestion';
export type ContactType = 'phone' | 'instagram';

export interface TicketContact {
  contactType: ContactType;
  contactValue: string;
  contactMethod: string;
}

/** Mirrors `validateContact` in tickets.js; null when unusable. */
export function validateContact(type: ContactType, raw: string): TicketContact | null {
  const val = String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .trim();
  if (!val) return null;
  if (type === 'phone') {
    const digits = val.replace(/\D/g, '');
    if (digits.length < 9) return null;
    return { contactType: 'phone', contactValue: digits, contactMethod: digits };
  }
  const handle = val.replace(/^@+/, '').trim();
  if (!handle) return null;
  return { contactType: 'instagram', contactValue: handle, contactMethod: `@${handle}` };
}

export interface TicketInput {
  type: TicketType;
  title: string;
  body: string;
  contact: TicketContact;
  /** `YYYY-MM-DDTHH:MM` (the site's datetime-local), complaints only. */
  incidentTime: string | null;
}

/**
 * The record tickets.js pushes to `sunray/tickets`. `source: "customer"` is
 * the site's own field, so it is kept as is. `attachments` is null because the
 * app has no image picker; the site writes null too when there are none.
 */
export function buildTicketRecord(input: TicketInput, code: string, timestamp: unknown) {
  return {
    code,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    source: 'customer',
    contactType: input.contact.contactType,
    contactValue: input.contact.contactValue,
    contactMethod: input.contact.contactMethod,
    incidentTime: input.type === 'complaint' && input.incidentTime ? input.incidentTime : null,
    attachments: null,
    status: 'new',
    createdAt: timestamp,
  };
}

export interface TicketRecord {
  code?: string;
  type?: string;
  title?: string;
  body?: string;
  status?: string;
  /** The staff reply — the only reply field the site's tracking view reads. */
  adminReply?: string;
  incidentTime?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

/** TK_AR from store-account.js. */
export const TICKET_STATUS_AR: Record<string, string> = {
  new: 'جديدة',
  open: 'مفتوحة',
  progress: 'قيد المعالجة',
  resolved: 'تم الرد',
  closed: 'مغلقة',
  terminated: 'مغلقة',
};
