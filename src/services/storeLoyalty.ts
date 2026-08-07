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

/** Save the customer's birth month (used for the birthday reward). */
export async function setBirthMonth(month: number): Promise<boolean> {
  try {
    const res = await callFn<{ ok?: boolean }>('setMyBirthMonth', { month });
    return res?.ok !== false;
  } catch {
    return false;
  }
}
