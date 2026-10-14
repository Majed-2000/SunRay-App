import type { CartLine } from '@/types';

/**
 * Loyalty rewards in the cart. Pure logic only — the app never deducts points.
 * `createStoreOrder` takes them when the order is written; everything here is
 * the guard and the shape of the line it sends.
 */

/** A product a reward can be taken as (`myLoyalty.rewards[].products[]`). */
export interface RewardProductLike {
  /** Key in `menu/products` — the `serviceId` of the order item. */
  key: string;
  name?: string;
  /** Allowed temps; `"-"` means the product has none. */
  fxTemps?: string[];
}

export interface RewardLike {
  id?: string;
  points: number;
  label?: string;
  products?: RewardProductLike[];
}

/** Temps the customer may pick from. Empty means «no temp» — nothing to ask. */
export function rewardTemps(product: RewardProductLike | undefined): string[] {
  const seen = new Set<string>();
  for (const t of product?.fxTemps ?? []) {
    const v = String(t ?? '').trim();
    if (v && v !== '-') seen.add(v);
  }
  return [...seen];
}

const TEMP_AR: Record<string, string> = {
  hot: 'حار',
  cold: 'بارد',
  classic: 'كلاسيك',
  freddo: 'فريدو',
};

/** Arabic label for a temp key; an unknown key is shown as the server sent it. */
export function rewardTempLabel(temp: string): string {
  return TEMP_AR[temp] ?? temp;
}

/** Points the reward lines already in the cart will take. */
export function rewardCartPoints(lines: Pick<CartLine, 'rewardId' | 'rewardPoints' | 'qty'>[]): number {
  return lines.reduce((sum, l) => (l.rewardId ? sum + (l.rewardPoints ?? 0) * (l.qty || 1) : sum), 0);
}

export type RewardRoom = { ok: true } | { ok: false; message: string };

/**
 * May one more reward of `rewardPoints` go in? Same rule and wording as the
 * website: the cart's reward points plus this one must not exceed the balance.
 */
export function checkRewardRoom(balance: number, cartPoints: number, rewardPoints: number): RewardRoom {
  const room = (Number.isFinite(balance) ? balance : 0) - cartPoints;
  if (rewardPoints > room) {
    return {
      ok: false,
      message:
        room < 0
          ? `سلّتك تجاوزت رصيدك بـ ${-room} نقطة — أفرغ مكافآت السلّة أولاً.`
          : `المتبقّي لك ${room} نقطة، وهذه المكافأة تحتاج ${rewardPoints}.`,
    };
  }
  return { ok: true };
}

/** True when the cart's reward lines are within the balance (checkout guard). */
export function rewardsWithinBalance(balance: number, lines: CartLine[]): RewardRoom {
  const points = rewardCartPoints(lines);
  if (points === 0) return { ok: true };
  return checkRewardRoom(balance, 0, points);
}

/**
 * The cart line for a reward: its own line, quantity one, price zero. The id is
 * unique per redemption so two rewards never merge into one line with a stepper.
 */
export function buildRewardLine(
  reward: RewardLike & { id: string },
  product: RewardProductLike,
  temp: string | undefined,
  nonce: string | number = Date.now(),
): CartLine {
  const label = reward.label?.trim() || 'مكافأة';
  return {
    id: `rw:${reward.id}:${product.key}:${temp ?? ''}:${nonce}`,
    productId: product.key,
    nameAr: product.name?.trim() || product.key,
    nameEn: '',
    optionLabel: temp ? `${label} · ${rewardTempLabel(temp)}` : label,
    addOnIds: [],
    unitPrice: 0,
    qty: 1,
    rewardId: reward.id,
    rewardPoints: reward.points,
    rewardTemp: temp,
  };
}
