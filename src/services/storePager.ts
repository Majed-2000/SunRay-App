/**
 * The cashier pager — the website's «ماسح ضوئي» flow, on the same callables.
 *
 * At the counter the cashier shows a QR (`/store/pager.html?t=<64hex>`). The
 * token is single-order and short-lived; `pagerOpen` trades it for a session
 * `s` (48 hex) that the customer then polls with `pagerStatus`. A customer who
 * lost the page can get back in with the six-character follow code printed
 * by the site (`pagerFollow`). Points and the invoice hang off the same
 * session. Shapes below are read from the site's `pager.html` and
 * `storeapp.html` (2026-10-01), not inferred.
 *
 * ## Errors
 *
 * These callables refuse by throwing an HttpsError whose `message` is a short
 * reason (`link_invalid`, `too_many`, `bad_phone`, `not_signed_in`), unlike
 * the OTP callables that resolve `{ ok: false }`. `pagerReason` pulls it out.
 *
 * ## Auth
 *
 * The website signs in anonymously when nobody is signed in, and only then —
 * it waits for the saved session first so it never replaces a real customer
 * (pager.html `whoIsHere`). Probing `pagerStatus`/`pagerInvoice` without any
 * token answered `link_invalid`, not `unauthenticated`, so the reads do not
 * demand auth up front; whether `pagerOpen` does was not testable without a
 * live token. So the app does the narrower thing: call as-is, and only if the
 * server answers `unauthenticated` AND there is no Firebase user at all, sign
 * in anonymously and retry once. An OTP session is never touched.
 */
import { signInAnonymously } from '@firebase/auth';
import { auth, callFn } from './firebase';
import type { PosSnapshot } from './pagerLink';

export type PagerStage = 'new' | 'ready' | 'collected' | 'closed';

export type LoyaltyState = 'none' | 'intent' | 'processing' | 'awarded' | 'already' | 'attention';

export interface PagerLoyalty {
  state: LoyaltyState;
  /** Points this order earns, once its POS details have matched. */
  eligible?: number;
  /** Points actually credited (`awarded`). */
  points?: number;
  name?: string;
  phoneMasked?: string;
  /** Credited but not spendable until the hold passes. */
  held?: boolean;
  holdMinutes?: number;
  /** `attention` only — see `LOYALTY_REASON`. */
  reason?: string;
}

export interface PagerItem {
  qty: number;
  name: string;
  mods?: string[];
}

export interface PagerOrder {
  pid: string;
  number?: string;
  stage: PagerStage;
  expired?: boolean;
  createdAgoMs?: number;
  readyAgoMs?: number;
  /** Each "ready" call from the counter has a sequence; a re-call rings again. */
  call?: { seq?: number };
  details?: { state: 'awaiting' | 'delayed' | 'matched'; items?: PagerItem[] };
  loyalty?: PagerLoyalty;
  /** True once the POS invoice is available through `pagerInvoice`. */
  invoice?: boolean;
}

/** The signed-in customer, as the pager knows them (`withMe`). */
export interface PagerMe {
  name?: string;
  balance?: number;
  phoneMasked?: string;
}

/** Shared reply of `pagerOpen`, `pagerStatus` and `pagerLoyalty`. */
export interface PagerReply {
  s?: string;
  order?: PagerOrder;
  me?: PagerMe | null;
  /** Six-character follow code for coming back without the QR. */
  follow?: string;
}

export interface PagerInvoiceReply {
  ok?: boolean;
  number?: string;
  order?: PosSnapshot;
  merchant?: { legalName?: string; vatNumber?: string; address?: string };
}

/** What an ack tells the counter: the alert fired, or the customer is coming. */
export interface PagerAck {
  seq: number;
  kind: 'page_alert' | 'on_my_way';
}

/** The server's short reason from a thrown HttpsError, or a network marker. */
export function pagerReason(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '');
  if (code.endsWith('unauthenticated')) return 'unauthenticated';
  // A dropped connection surfaces as `internal` with the message "internal" —
  // checked first so it is not mistaken for a server reason of that name.
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded') || code.endsWith('internal')) return 'network';
  if (/^[a-z_]+$/.test(message)) return message;
  return code.includes('/') ? code.split('/')[1] : code || 'network';
}

async function callPager<T>(name: string, data: unknown): Promise<T> {
  try {
    return await callFn<T>(name, data);
  } catch (e) {
    if (pagerReason(e) !== 'unauthenticated' || auth().currentUser) throw e;
    await signInAnonymously(auth());
    return callFn<T>(name, data);
  }
}

/** Cashier QR token → session and the order's first state. */
export function pagerOpen(t: string): Promise<PagerReply> {
  return callPager<PagerReply>('pagerOpen', { t });
}

/** Six-character follow code → session (`{ s, url }`). */
export function pagerFollow(code: string): Promise<{ s?: string; url?: string }> {
  return callPager('pagerFollow', { code });
}

/**
 * Current state. `withMe` asks for the signed-in customer's name and balance,
 * which only the first read needs — the poll leaves it off and gets `null`.
 */
export function pagerStatus(s: string, opts: { withMe?: boolean; ack?: PagerAck | null } = {}): Promise<PagerReply> {
  const data: Record<string, unknown> = { s };
  if (opts.withMe) data.withMe = true;
  if (opts.ack) data.ack = opts.ack;
  return callPager<PagerReply>('pagerStatus', data);
}

/** Record this order's points on the signed-in (OTP) account. */
export function pagerLoyalty(s: string): Promise<PagerReply> {
  return callPager<PagerReply>('pagerLoyalty', { s, useAccount: true });
}

/** The POS invoice snapshot. `ok: false` means it has not arrived yet. */
export function pagerInvoice(s: string): Promise<PagerInvoiceReply> {
  return callPager<PagerInvoiceReply>('pagerInvoice', { s });
}

/** Arabic for each `attention` reason — the site's wording. */
export const LOYALTY_REASON: Record<string, string> = {
  claimed_other: 'هذا الطلب مسجّل لحسابٍ آخر — كلّم الكاشير إن كان خطأ',
  daily_cap: 'وصلت حدّ تسجيل الطلبات لليوم',
  expired_window: 'انتهت مهلة تسجيل نقاط هذا الطلب',
  staff_phone: 'أرقام الموظفين لا تُسجَّل من هنا',
  blocked: 'الحساب موقوف — كلّم الكاشير',
  order_unavailable: 'ما قدرنا نسجّل نقاط هذا الطلب — كلّم الكاشير',
  error: 'تعذّر التسجيل — كلّم الكاشير',
};

/** Arabic for a refused `pagerLoyalty` call. */
export function describeLoyaltyError(reason: string): string {
  switch (reason) {
    case 'not_signed_in':
    case 'unauthenticated':
      return 'سجّل دخولك أولًا';
    case 'too_many':
    case 'resource-exhausted':
      return 'محاولات كثيرة — انتظر قليلًا';
    case 'link_invalid':
      return 'انتهت صلاحية البيجر';
    default:
      return 'تعذّر التسجيل — حاول مرة ثانية';
  }
}

/** Arabic for a refused follow code. */
export function describeFollowError(reason: string): string {
  if (reason === 'too_many' || reason === 'resource-exhausted') return 'محاولات كثيرة — انتظر دقيقة';
  if (reason === 'network') return 'تعذّر الاتصال، تحقّق من الإنترنت';
  return 'الرمز غير صحيح أو انتهى طلبه';
}
