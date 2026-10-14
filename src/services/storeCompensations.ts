/**
 * «تعويضاتي» — compensations the branch issued to this customer.
 *
 * When an order goes wrong, staff issue a compensation from the dashboard: a
 * drink or an offer the customer collects on a later visit by showing a code at
 * the till. The customer's phone is taken from the verified sign-in on the
 * server, never sent from here — otherwise anyone could list another number's
 * compensations by changing one field. That is why this is a callable and not a
 * database read.
 *
 * Shapes from the website's `store-account.js` (`compsLoad` / `compsPaint`).
 */
import { callFn } from './firebase';

export type CompState = 'active' | 'redeemed' | 'cancelled' | string;

export interface CompItem {
  name: string;
  /** «حار» / «بارد» when the drink has one. */
  temp?: string | null;
  qty?: number;
}

export interface Compensation {
  /** The code the cashier enters. Shown large only while `active`. */
  code?: string | null;
  state: CompState;
  items?: CompItem[];
  /** Free-text offer when the compensation is not specific items. */
  offer?: string | null;
  /** Where to collect it. */
  branch?: string | null;
  issuedAt?: number | null;
  redeemedAt?: number | null;
  invoiceCode?: string | null;
  cancelledAt?: number | null;
  orderRef?: string | null;
  ticketRef?: string | null;
}

export interface MyCompensations {
  /** False when the account has no verified phone — a sign-in problem, not "none". */
  hasPhone?: boolean;
  comps: Compensation[];
}

export type CompsResult =
  | { ok: true; data: MyCompensations }
  | { ok: false; reason: 'login' | 'error' };

export async function fetchMyCompensations(): Promise<CompsResult> {
  try {
    const res = await callFn<MyCompensations>('myCompensations', {});
    return { ok: true, data: { hasPhone: res?.hasPhone, comps: Array.isArray(res?.comps) ? res.comps : [] } };
  } catch (e) {
    const msg = String((e as { message?: string; code?: string })?.message ?? '') + String((e as { code?: string })?.code ?? '');
    return { ok: false, reason: /unauthenticated|login_required/.test(msg) ? 'login' : 'error' };
  }
}
