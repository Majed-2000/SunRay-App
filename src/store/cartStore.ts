import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage, PERSIST_VERSION } from './persistStorage';
import type { CartLine, OrderType, Product, Coupon } from '@/types';
import { router } from 'expo-router';
import { buildCartLine, needsMethodChoice, selectionUnitPrice, type ProductSelection } from '@/utils/cart';
import { validateCoupon, describeCouponError } from '@/services/storeOffers';
import { onAuthChanged } from '@/services/storeAuth';
import { useCatalogStore } from './catalogStore';
import { toast } from './uiStore';
import { useLoyaltyStore } from './loyaltyStore';
import {
  buildRewardLine,
  checkRewardRoom,
  rewardCartPoints,
  type RewardLike,
  type RewardProductLike,
  type RewardRoom,
} from '@/utils/rewards';

interface CartState {
  lines: CartLine[];
  orderType: OrderType;
  addressId: string | null;
  scheduledTime: string | null; // null = ASAP
  coupon: Coupon | null;
  useWallet: boolean;
  redeemPoints: boolean;

  addProduct: (product: Product, sel: ProductSelection) => void;
  quickAdd: (product: Product) => void;
  incLine: (id: string) => void;
  decLine: (id: string) => void;
  removeLine: (id: string) => void;
  setLineNotes: (id: string, notes: string) => void;
  /**
   * Put a loyalty reward in the cart as its own free line (qty 1, no stepper).
   * Refused — with the website's wording — when the cart's reward points plus
   * this one would exceed the balance. Points are taken by `createStoreOrder`
   * only; nothing is deducted here.
   */
  addReward: (reward: RewardLike & { id: string }, product: RewardProductLike, temp?: string) => RewardRoom;
  clear: () => void;

  setOrderType: (type: OrderType) => void;
  setAddress: (id: string | null) => void;
  setScheduledTime: (time: string | null) => void;

  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  setUseWallet: (v: boolean) => void;
  setRedeemPoints: (v: boolean) => void;

  /**
   * Put a past order's items back in the cart, at today's menu and prices.
   * Returns how many lines were added and the names no longer on the menu.
   */
  reorder: (items: { nameAr: string; qty: number }[]) => { added: number; missing: string[]; needChoice: string[] };

  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
  (set, get) => ({
  lines: [],
  orderType: 'pickup',
  addressId: null,
  scheduledTime: null,
  coupon: null,
  useWallet: false,
  redeemPoints: false,

  addProduct: (product, sel) => {
    const line = buildCartLine(product, sel);
    set((s) => {
      const idx = s.lines.findIndex((l) => l.id === line.id);
      if (idx >= 0) {
        const lines = [...s.lines];
        lines[idx] = { ...lines[idx], qty: lines[idx].qty + line.qty };
        return { lines };
      }
      return { lines: [...s.lines, line] };
    });
  },

  quickAdd: (product) => {
    if (!product.isAvailable) {
      toast('نفد اليوم');
      return;
    }
    // The "+" on a menu card cannot ask a question, and hot vs cold is one the
    // app must not answer for the customer — a 2-litre jug made hot for someone
    // who wanted it cold is 59 ﷼ poured away. Open the product instead.
    if (needsMethodChoice(product)) {
      router.push(`/product/${product.id}`);
      toast('اختر حار أو بارد');
      return;
    }
    const sel: ProductSelection = {
      sizeId: product.sizes.find((z) => z.id === 'M')?.id ?? product.sizes[0]?.id,
      // pick the first "milk" option (works for both mock and backend products)
      addOnIds: (() => {
        const milk = product.addOns.find((a) => a.group === 'milk');
        return milk ? [milk.id] : [];
      })(),
      qty: 1,
    };
    get().addProduct(product, sel);
    toast('أُضيف إلى السلة ✓');
  },

  // A reward line is one redemption: it has no quantity to raise.
  incLine: (id) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.id === id && !l.rewardId ? { ...l, qty: l.qty + 1 } : l)),
    })),
  decLine: (id) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (l.id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    })),
  removeLine: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
  setLineNotes: (id, notes) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.id === id ? { ...l, notes: notes.trim() || undefined } : l)),
    })),
  addReward: (reward, product, temp) => {
    const balance = useLoyaltyStore.getState().data?.balance ?? 0;
    const room = checkRewardRoom(balance, rewardCartPoints(get().lines), reward.points);
    if (!room.ok) {
      toast(room.message);
      return room;
    }
    // The reward feed may carry no product name; the menu has it. Without this
    // the cart showed the raw `menu/products` key.
    const named = product.name?.trim()
      ? product
      : { ...product, name: useCatalogStore.getState().products.find((p) => p.id === product.key)?.nameAr };
    set((s) => ({ lines: [...s.lines, buildRewardLine(reward, named, temp)] }));
    toast('أُضيفت المكافأة إلى السلة');
    return room;
  },
  clear: () =>
    set({ lines: [], coupon: null, useWallet: false, redeemPoints: false, scheduledTime: null }),

  setOrderType: (type) => set({ orderType: type }),
  setAddress: (id) => set({ addressId: id }),
  setScheduledTime: (time) => set({ scheduledTime: time }),

  /**
   * Check a coupon code with the store.
   *
   * This used to match against a hand-written array in `src/data/coupons.ts` —
   * so a code the business had retired still "worked" here, and a real code the
   * business had just issued did not. Neither outcome is recoverable on the
   * device; only the server knows.
   *
   * Even a success is provisional. `createStoreOrder` resolves the coupon again
   * against the real cart at order time, and can still refuse it — used in the
   * meantime, expired, or not applicable to these items. The discount shown
   * here is a preview so the cart matches the invoice, never a promise.
   */
  applyCoupon: async (code) => {
    const subtotalHalalas = Math.round(
      get().lines.reduce((a, l) => a + l.unitPrice * l.qty, 0) * 100,
    );
    const res = await validateCoupon(code, subtotalHalalas);
    if (!res.ok) {
      toast(describeCouponError(res.reason));
      return false;
    }
    set({
      coupon: {
        code: res.code ?? code.trim().toUpperCase(),
        titleAr: res.kind === 'percent' ? `خصم ${res.value}٪` : `خصم ${res.value} ﷼`,
        kind: res.kind === 'percent' ? 'percent' : 'amount',
        value: res.value ?? 0,
      } as Coupon,
    });
    toast('تم تطبيق الكوبون');
    return true;
  },
  removeCoupon: () => set({ coupon: null }),
  setUseWallet: (v) => set({ useWallet: v }),
  setRedeemPoints: (v) => set({ redeemPoints: v }),

  /**
   * Matched by name because that is all the order feed carries — no product
   * id, no brewing method. So a reordered drink comes back with the product's
   * first method, and anything renamed or taken off the menu is reported as
   * missing instead of being guessed at. Prices are always today's: the server
   * prices from the live menu, never from the old order.
   */
  reorder: (items) => {
    const products = useCatalogStore.getState().products;
    const missing: string[] = [];
    // The feed does not say whether it was hot or cold, so those are not
    // guessed: they are named back to the customer to add from the menu.
    const needChoice: string[] = [];
    let added = 0;
    for (const it of items) {
      const product = products.find((p) => p.nameAr === it.nameAr);
      if (!product || !product.isAvailable) {
        missing.push(it.nameAr);
        continue;
      }
      if (needsMethodChoice(product)) {
        needChoice.push(it.nameAr);
        continue;
      }
      get().addProduct(product, { addOnIds: [], qty: Math.max(1, it.qty) });
      added += 1;
    }
    return { added, missing, needChoice };
  },

  count: () => get().lines.reduce((a, l) => a + l.qty, 0),
  }),
  {
    name: 'sunray.cart',
    version: PERSIST_VERSION,
    storage: deviceStorage,
    // The lines and the service mode survive a restart. Not the coupon: the
    // server re-checks it at order time anyway, and a stale one would show a
    // discount that is no longer there.
    partialize: (s) => ({ lines: s.lines, orderType: s.orderType }),
  },
  ),
);

/** Coupon discount value (﷼) for the current lines. */
export function couponDiscount(coupon: Coupon | null, lines: CartLine[]): number {
  if (!coupon) return 0;
  const base = coupon.appliesToCategory
    ? lines
        .filter((l) => useCatalogStore.getState().productById(l.productId)?.categoryId === coupon.appliesToCategory)
        .reduce((a, l) => a + l.unitPrice * l.qty, 0)
    : lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  if (coupon.kind === 'percent') return Math.round(base * (coupon.value / 100) * 100) / 100;
  return Math.min(coupon.value, base);
}

/**
 * Keep a saved cart honest against the live menu.
 *
 * The cart survives restarts now, so it can outlive what it holds: an item the
 * branch pulled, or a price changed since. Each time the menu changes, lines
 * for items no longer orderable are dropped (and the customer told), and unit
 * prices are re-read — the server prices the order from the same rows anyway,
 * so a stale figure here would only mislead.
 */
function reconcileWithMenu() {
  const { products } = useCatalogStore.getState();
  if (products.length === 0) return;
  const { lines } = useCartStore.getState();
  if (lines.length === 0) return;
  const dropped: string[] = [];
  const next = lines.flatMap((l) => {
    const product = products.find((p) => p.id === l.productId);
    // A reward line stays free. Only a product the menu knows and has pulled
    // is dropped; one the app's catalog does not list is left for the server.
    if (l.rewardId) {
      if (product && !product.isAvailable) {
        dropped.push(l.nameAr);
        return [];
      }
      return [l];
    }
    if (!product || !product.isAvailable) {
      dropped.push(l.nameAr);
      return [];
    }
    const unitPrice = selectionUnitPrice(product, { sizeId: l.sizeId, addOnIds: l.addOnIds, method: l.method, qty: l.qty });
    return [unitPrice === l.unitPrice ? l : { ...l, unitPrice }];
  });
  if (dropped.length || next.some((l, i) => l !== lines[i])) useCartStore.setState({ lines: next });
  if (dropped.length) toast(`أُزيل من سلتك لأنه لم يعد متوفرًا: ${dropped.join('، ')}`);
}

useCatalogStore.subscribe((catalog, prev) => {
  if (catalog.products === prev.products) return;
  reconcileWithMenu();
});

// The saved cart loads from storage asynchronously. If the menu landed first,
// the subscription above saw an empty cart and did nothing — and the signature
// guard in storeCatalog means the next menu emission may never come — so the
// restored lines kept stale prices and pulled items until checkout failed.
useCartStore.persist.onFinishHydration(() => reconcileWithMenu());

/**
 * Keep an applied coupon honest against the cart it was checked for.
 *
 * `applyCoupon` validates against the subtotal at that moment, but the
 * discount was then recomputed locally forever after — so a code needing a
 * 50 ﷼ spend kept showing its discount on a 15 ﷼ cart, and one applied to a
 * cart since emptied was still there on the next one. The server refuses both
 * at `createStoreOrder`. So: an empty cart drops the coupon, and a changed
 * subtotal re-asks the store (debounced — the stepper fires per tap).
 */
const COUPON_REFUSALS = new Set(['not_found', 'invalid', 'expired', 'used', 'max_uses', 'below_min', 'wrong_scope']);
let couponCheck: ReturnType<typeof setTimeout> | null = null;
let couponCheckSeq = 0;
useCartStore.subscribe((cart, prev) => {
  if (cart.lines === prev.lines || !cart.coupon) return;
  if (couponCheck) clearTimeout(couponCheck);
  if (cart.lines.length === 0) {
    couponCheckSeq += 1;
    useCartStore.setState({ coupon: null });
    return;
  }
  const subtotalOf = (lines: CartLine[]) =>
    Math.round(lines.reduce((a, l) => a + l.unitPrice * l.qty, 0) * 100);
  if (subtotalOf(cart.lines) === subtotalOf(prev.lines)) return;
  const seq = ++couponCheckSeq;
  couponCheck = setTimeout(async () => {
    couponCheck = null;
    const { coupon, lines } = useCartStore.getState();
    if (!coupon) return;
    const res = await validateCoupon(coupon.code, subtotalOf(lines));
    // A newer change (or a removed / replaced coupon) supersedes this answer.
    if (seq !== couponCheckSeq || useCartStore.getState().coupon?.code !== coupon.code) return;
    if (!res.ok) {
      // Only a definite "no" drops it. A network failure says nothing about
      // the code, and the server checks it again at order time regardless.
      if (!COUPON_REFUSALS.has(String(res.reason ?? '').split(':')[0])) return;
      useCartStore.setState({ coupon: null });
      toast(`أُزيل الكوبون ${coupon.code}: ${describeCouponError(res.reason)}`);
      return;
    }
    const kind = res.kind === 'percent' ? 'percent' : 'amount';
    if (res.value != null && (kind !== coupon.kind || res.value !== coupon.value)) {
      useCartStore.setState({
        coupon: {
          ...coupon,
          kind,
          value: res.value,
          titleAr: kind === 'percent' ? `خصم ${res.value}٪` : `خصم ${res.value} ﷼`,
        } as Coupon,
      });
    }
  }, 800);
});

/**
 * A cart belongs to whoever filled it.
 *
 * The lines persist to the device and the coupon lives in memory, and logout
 * touched neither — so the next account on the phone opened onto the previous
 * customer's items and, in the same session, their personal coupon. Cleared
 * when a signed-in account signs out or changes. A guest who signs in keeps
 * the cart: that is the "log in to check out" path.
 */
let lastUid: string | null | undefined;
onAuthChanged((user) => {
  const uid = user?.uid ?? null;
  if (lastUid && uid !== lastUid) {
    couponCheckSeq += 1;
    useCartStore.getState().clear();
  }
  lastUid = uid;
});
