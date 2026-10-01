/**
 * Loyalty, read from the real ledger.
 *
 * The app shipped a cup card — "buy 6, get the 7th free" — with a 200-point
 * goal and bronze/silver/gold tiers. None of it existed. The live programme is
 * **points earned on spend, one point per riyal**, carried over 1:1 from Boonus
 * for 19,279 customers. So a customer holding a real balance of 2,546 points
 * opened this app and was shown "4 of 6 cups".
 *
 * That is not a cosmetic mismatch. `functions/loyalty_core.js` derives the
 * model from the actual Boonus export and notes that points-per-visit is far
 * too scattered for visits to be the unit (Q1 6.4 · median 15 · Q3 24.3).
 * Spend is the unit.
 *
 * ## The threshold is deliberately withheld
 *
 * `loyaltyPublicInfo` returns `rewardThreshold: null` until an admin sets
 * `thresholdConfirmed`. That is the server refusing to guess, and the reason is
 * written into the system: showing "you have earned a reward" against an
 * estimated threshold is a promise the customer reads as a commitment.
 *
 * So this app shows the balance and stays silent about the goal until the
 * server supplies one. Filling the gap with a plausible number is the exact
 * mistake the old cup card made.
 *
 * ## Redemption is not a coupon
 *
 * A reward is added to the cart at price zero and the deduction happens inside
 * `createStoreOrder` when the order completes. A `RW-#####` coupon flow was
 * built and then deliberately scrapped. Nothing here mints or redeems a code.
 */
import { callFn } from './firebase';

/** One entry in the customer's points history. */
export interface LoyaltyEvent {
  type: 'earn' | 'import' | 'adjust' | 'redeem' | 'expire' | 'reverse';
  points: number;
  at: number | null;
  channel: string | null;
  channelAr: string | null;
  note: string | null;
  /** Order total in halalas, on `earn` rows only. */
  totalHalalas: number | null;
}

/** A rung on the reward ladder, with the real product behind it. */
export interface LoyaltyReward {
  points: number;
  label?: string;
  productId?: string;
  affordable: boolean;
}

export interface MyLoyalty {
  linked: boolean;
  reason?: string;
  phoneMasked: string | null;
  exists: boolean;
  balance: number;
  /** null while the admin has not confirmed the threshold — do not invent one. */
  threshold: number | null;
  remaining: number | null;
  rewardsDue: number;
  rewardLabel: string;
  eligible: boolean;
  thresholdConfirmed: boolean;
  visits: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  enrolledAt: number | null;
  lastActivityAt: number | null;
  /** True when the balance came across in the Boonus migration. */
  bonatImported: boolean;
  status: string | null;
  tier: { key?: string; label?: string; multiplier?: number } | null;
  birthMonth: number | null;
  birthdayDue: boolean;
  /** This year's birthday reward has already been issued. */
  birthdayGranted?: boolean;
  birthdayEnabled: boolean;
  birthdayLabel: string;
  pointsPerSar: number;
  expiryMonths: number;
  /** Points lapse through INACTIVITY, not on a calendar date. */
  expiresAt: number | null;
  expiryWarn: boolean;
  timeline: LoyaltyEvent[];
  timelineTruncated: boolean;
  rewards: LoyaltyReward[];
}

/** What a signed-out visitor may know about the programme. */
export interface LoyaltyPublicInfo {
  pointsPerSar: number;
  rewardLabel: string;
  thresholdConfirmed: boolean;
  /** null unless confirmed — see the note above. */
  rewardThreshold: number | null;
}

/** The signed-in customer's balance, history and reward ladder. */
export async function fetchMyLoyalty(): Promise<MyLoyalty | null> {
  try {
    const res = await callFn<MyLoyalty>('myLoyalty');
    // `linked: false` means this account has no phone the ledger recognises —
    // a real state, not an error, and the screen should say so rather than
    // render a zero balance as though the customer had never bought anything.
    return res ?? null;
  } catch {
    return null;
  }
}

/** Programme facts safe to show before sign-in. */
export async function fetchLoyaltyPublicInfo(): Promise<LoyaltyPublicInfo | null> {
  try {
    return await callFn<LoyaltyPublicInfo>('loyaltyPublicInfo');
  } catch {
    return null;
  }
}

/**
 * Save the customer's birth month (used for the birthday reward).
 *
 * ⚠️ The field is `birthMonth`, not `month`. This sent `{ month }` until
 * 2026-10-02; the website's `saveBirthMonth` (store-account.js) sends
 * `{ birthMonth: v }`, and that is the shape the server reads — so every month
 * a customer picked in the app was silently dropped and their birthday reward
 * never came due. `null` clears it, as on the website.
 */
export async function setBirthMonth(month: number | null): Promise<boolean> {
  try {
    const res = await callFn<{ ok?: boolean }>('setMyBirthMonth', { birthMonth: month });
    return res?.ok !== false;
  } catch {
    return false;
  }
}

/** Why a birthday claim was refused, in the customer's words — never a server code. */
export type BirthdayRefusal =
  | 'already_granted'
  | 'not_due'
  | 'birthday_disabled'
  | 'no_account'
  | 'no_phone'
  | 'error';

/**
 * Issue this year's birthday reward.
 *
 * The server guards it with an atomic transaction, so a double tap cannot mint
 * two; the caller still disables its button before calling, so it does not
 * send two. Refusals arrive as thrown errors whose message carries the reason
 * code — the same codes the website matches on.
 */
export async function claimBirthdayReward(): Promise<{ ok: true } | { ok: false; reason: BirthdayRefusal }> {
  try {
    const res = await callFn<{ ok?: boolean; reason?: string }>('claimBirthdayReward', {});
    if (res && res.ok === false) return { ok: false, reason: refusalOf(res.reason ?? '') };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: refusalOf(String((e as { message?: string })?.message ?? '')) };
  }
}

function refusalOf(msg: string): BirthdayRefusal {
  for (const r of ['already_granted', 'not_due', 'birthday_disabled', 'no_account', 'no_phone'] as const) {
    if (msg.includes(r)) return r;
  }
  return 'error';
}

export const BIRTHDAY_REFUSAL_AR: Record<BirthdayRefusal, string> = {
  already_granted: 'استلمت مكافأة هذا العام',
  not_due: 'المكافأة تُصرف في شهر ميلادك فقط',
  birthday_disabled: 'المكافأة غير مفعّلة حالياً',
  no_account: 'احصل على أول نقاطك ثم عُد لنا',
  no_phone: 'وثّق رقم جوالك أولاً',
  error: 'تعذّر الإصدار — حاول بعد قليل',
};

// ── Branch visits ──────────────────────────────────────────────────────────

/**
 * The customer's 1–5 answers about a visit. The same three keys as an online
 * order's review (`storeExp`, `service`, `overall`) so reports can add them up;
 * only the question text differs for a visit.
 */
export interface VisitReview {
  storeExp: number;
  service: number;
  overall: number;
  comment: string | null;
  gender: string | null;
  at: number;
}

/**
 * An in-branch purchase recorded on the loyalty ledger (a Foodics invoice
 * matched to this phone). Shape from `myVisits` as the website renders it.
 */
export interface Visit {
  /** The loyalty event id — what `myVisitDetail` and `rateVisit` take. */
  id: string;
  type?: 'visit';
  createdAt?: number | null;
  branchName?: string | null;
  /** Printed invoice number, when the event carried one. */
  code?: string | null;
  totalHalalas?: number | null;
  points?: number | null;
  review?: Partial<VisitReview> | null;
  /** The server can fetch the full invoice for this visit. */
  hasDetail?: boolean;
}

/**
 * The customer's branch visits, newest first. `null` on failure — the caller
 * shows an error, not an empty list, because «no visits» is a claim about the
 * customer and a failed call cannot make it.
 */
export async function fetchMyVisits(): Promise<Visit[] | null> {
  try {
    const res = await callFn<{ visits?: Visit[] }>('myVisits', {});
    const list = Array.isArray(res?.visits) ? res.visits : [];
    return list.slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  } catch {
    return null;
  }
}

/** One line on a Foodics invoice. Money in riyals, as Foodics returns it. */
export interface VisitLine {
  name?: string;
  qty?: number;
  returned?: number;
  unit?: number | null;
  total?: number | null;
  mods?: { name?: string }[];
}

export interface VisitDetail {
  /** Order number. */
  number?: string | null;
  /** Printed invoice (check) number. */
  checkNumber?: string | null;
  lines?: VisitLine[];
  subtotal?: number;
  taxExclDiscount?: number;
  discount?: number;
  rounding?: number;
  total?: number;
  payments?: { method?: string; amount?: number }[];
}

/**
 * The full invoice behind a visit. The server checks the visit belongs to the
 * signed-in phone before fetching it from Foodics.
 */
export async function fetchVisitDetail(
  eventId: string,
): Promise<{ ok: true; detail: VisitDetail } | { ok: false; reason: 'unavailable' | 'error' }> {
  try {
    const res = await callFn<{ ok?: boolean; reason?: string; detail?: VisitDetail }>('myVisitDetail', { eventId });
    if (!res?.ok) return { ok: false, reason: 'unavailable' };
    return { ok: true, detail: res.detail ?? {} };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Save a rating on a visit. The server checks the visit is this customer's. */
export async function rateVisit(eventId: string, review: VisitReview): Promise<boolean> {
  try {
    const res = await callFn<{ ok?: boolean }>('rateVisit', { eventId, review });
    // The website treats anything but an explicit `ok: true` as a failure.
    return res?.ok === true;
  } catch {
    return false;
  }
}
