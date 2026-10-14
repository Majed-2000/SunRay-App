/**
 * Catering — «حجز كاترينق» on sunray.sa.
 *
 * ## How the website does it, and what the app copies
 *
 *  1. the request is pushed straight into `sunray/catering` (no callable),
 *     with a `CK-####` code and a `sunray/shortIndex/catering/<code>` entry;
 *  2. `linkCatering({ cateringKey })` files it under the customer's phone so it
 *     shows in «طلباتي» on the web account page;
 *  3. `createCateringPayment({ cateringKey, mode })` returns the amount and an
 *     intent id; the Moyasar form is opened with
 *     `metadata: { catering_key, catering_intent }` and the server settles from
 *     Moyasar's webhook, writing `finance.paidHalalas` / `status` back.
 *
 * ## What the app does NOT copy
 *
 *  - The per-date capacity check (max two bookings a day). The site does it by
 *    reading every record in `sunray/catering` — names, phones and addresses
 *    of every customer — which only works because the node is world-readable.
 *    The app relies on `blockedDates` from the dashboard plus the team's own
 *    confirmation, and tells the customer so.
 *  - Bank transfer and receipt upload (no file picker in the app), and so the
 *    ≤3-days "card only" rule is automatic: card is the only way.
 *  - Coupons and client-side cancel (`status = "cancelled"` written from the
 *    browser) — neither was asked for, and the terms say there is no cancel.
 */
import { get, onValue, off, push, ref, serverTimestamp, set, type DataSnapshot } from 'firebase/database';
import { auth, callFn, db } from './firebase';
import {
  buildCateringRecord,
  genCode,
  paidHalalas,
  type CateringInput,
  type CateringRecord,
} from './requestRules';
import { rememberRequest } from './myRequests';

export interface CateringSystem {
  /** `announcements/cateringSystem/open` — only an explicit `false` closes it, as on the site. */
  open: boolean;
  blockedDates: Record<string, unknown>;
}

/** Live open/closed state and the dates the dashboard has closed. */
export function subscribeCateringSystem(cb: (s: CateringSystem) => void, onError?: (e: Error) => void): () => void {
  const openRef = ref(db(), 'announcements/cateringSystem/open');
  const blockedRef = ref(db(), 'announcements/cateringSystem/blockedDates');
  let state: CateringSystem = { open: true, blockedDates: {} };
  const onOpen = (s: DataSnapshot) => {
    state = { ...state, open: s.val() !== false };
    cb(state);
  };
  const onBlocked = (s: DataSnapshot) => {
    const v = s.val();
    state = { ...state, blockedDates: v && typeof v === 'object' ? (v as Record<string, unknown>) : {} };
    cb(state);
  };
  onValue(openRef, onOpen, (e) => onError?.(e));
  onValue(blockedRef, onBlocked, (e) => onError?.(e));
  return () => {
    off(openRef, 'value', onOpen);
    off(blockedRef, 'value', onBlocked);
  };
}

/** One fresh read of a single date, right before submitting — the dashboard may have just closed it. */
export async function isDateBlocked(date: string): Promise<boolean> {
  const snap = await get(ref(db(), `announcements/cateringSystem/blockedDates/${date}`));
  return snap.val() === true;
}

export interface CreatedCatering {
  key: string;
  code: string;
}

/**
 * Write the request exactly as the website does, then remember its key.
 *
 * Requires a signed-in customer: the site signs in anonymously first because
 * the `shortIndex` write needs auth, and `createCateringPayment` is called
 * with that session. The app has a real session instead of an anonymous one.
 */
export async function createCateringRequest(input: CateringInput): Promise<CreatedCatering> {
  const uid = auth().currentUser?.uid ?? null;
  const code = genCode('CK');
  const r = push(ref(db(), 'sunray/catering'));
  const key = r.key as string;
  await set(r, buildCateringRecord(input, code, serverTimestamp()));
  // Best-effort, like the site: a failed index does not undo the request.
  await set(ref(db(), `sunray/shortIndex/catering/${code}`), key).catch(() => {});
  await rememberRequest('catering', { key, code, uid });
  // Files it under the customer's phone for the web account page. Fire and forget.
  void callFn('linkCatering', { cateringKey: key }).catch(() => {});
  return { key, code };
}

export type CateringPayMode = 'deposit' | 'full' | 'remainder';

export interface CateringPaymentIntent {
  amountHalalas: number;
  intentId: string;
  /** Fully covered (e.g. by a staff-applied discount) — nothing to charge. */
  free?: boolean;
}

/**
 * Ask the server what to charge. The amount is the server's, never the app's:
 * the screen's quote is for display only.
 *
 * The site sends `couponCode: null` from the booking page and omits it from
 * the account page's remainder button; both are copied.
 */
export async function startCateringPayment(cateringKey: string, mode: CateringPayMode): Promise<CateringPaymentIntent> {
  const payload = mode === 'remainder' ? { cateringKey, mode } : { cateringKey, mode, couponCode: null };
  const d = (await callFn<Partial<CateringPaymentIntent>>('createCateringPayment', payload)) ?? {};
  if (d.free) return { amountHalalas: 0, intentId: String(d.intentId ?? ''), free: true };
  const amount = Number(d.amountHalalas);
  if (!Number.isFinite(amount) || amount <= 0 || !d.intentId) throw new Error('catering-pay-bad-reply');
  return { amountHalalas: Math.round(amount), intentId: String(d.intentId) };
}

/** Moyasar description and metadata, copied from client-catering.js. */
export function cateringPaymentDescription(code: string): string {
  return `كاترينق ${code}`;
}
export function cateringPaymentMetadata(key: string, intentId: string): Record<string, string> {
  return { catering_key: key, catering_intent: intentId };
}

export function subscribeCatering(
  key: string,
  cb: (rec: CateringRecord | null) => void,
  onError?: (e: Error) => void,
): () => void {
  const r = ref(db(), `sunray/catering/${key}`);
  const handler = (snap: DataSnapshot) => cb((snap.val() as CateringRecord | null) ?? null);
  onValue(r, handler, (e) => onError?.(e));
  return () => off(r, 'value', handler);
}

export async function readCatering(key: string): Promise<CateringRecord | null> {
  const snap = await get(ref(db(), `sunray/catering/${key}`));
  return (snap.val() as CateringRecord | null) ?? null;
}

/**
 * Wait for the server to record a payment on this request.
 *
 * The card form's own result is a hint (see `storePay.ts`): the webhook is
 * what settles. Settled here means `finance.paidHalalas` rose above what it
 * was before this attempt. A timeout is not a failure — the charge may have
 * gone through and the webhook be a little behind — so the screen must say
 * "being confirmed", never "failed".
 */
export function waitForCateringPayment(key: string, paidBefore: number, timeoutMs = 90_000): Promise<'paid' | 'timeout'> {
  return new Promise((resolve) => {
    const r = ref(db(), `sunray/catering/${key}`);
    let done = false;
    const finish = (v: 'paid' | 'timeout') => {
      if (done) return;
      done = true;
      off(r, 'value', handler);
      clearTimeout(timer);
      resolve(v);
    };
    const handler = (snap: DataSnapshot) => {
      if (paidHalalas(snap.val() as CateringRecord | null) > paidBefore) finish('paid');
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    onValue(r, handler, () => finish('timeout'));
  });
}

/** Arabic for a callable failure, without leaking raw Firebase text. */
export function describeCateringError(e: unknown): string {
  const code = String((e as { code?: string })?.code ?? '');
  if (code.includes('unauthenticated')) return 'سجّل دخولك أولًا';
  if (code.includes('permission-denied')) return 'لا يمكن إتمام العملية لهذا الحجز';
  if (code.includes('failed-precondition')) return 'لا يمكن الدفع لهذا الحجز الآن — تواصل معنا';
  if (code.includes('unavailable') || code.includes('network')) return 'تحقّق من اتصالك بالإنترنت وحاول مجددًا';
  return 'تعذّر بدء الدفع، حاول مجددًا';
}
