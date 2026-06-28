import { create } from 'zustand';
import type { CartLine, OrderType, Product, Coupon } from '@/types';
import { buildCartLine, type ProductSelection } from '@/utils/cart';
import { couponByCode, productById } from '@/data';
import { toast } from './uiStore';

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
  clear: () => void;

  setOrderType: (type: OrderType) => void;
  setAddress: (id: string | null) => void;
  setScheduledTime: (time: string | null) => void;

  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  setUseWallet: (v: boolean) => void;
  setRedeemPoints: (v: boolean) => void;

  count: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
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
    const sel: ProductSelection = {
      sizeId: product.sizes.find((z) => z.id === 'M')?.id ?? product.sizes[0]?.id,
      addOnIds: product.addOns.some((a) => a.group === 'milk') ? ['milk_regular'] : [],
      qty: 1,
    };
    get().addProduct(product, sel);
    toast('أُضيف إلى السلة ✓');
  },

  incLine: (id) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l)),
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
  clear: () =>
    set({ lines: [], coupon: null, useWallet: false, redeemPoints: false, scheduledTime: null }),

  setOrderType: (type) => set({ orderType: type }),
  setAddress: (id) => set({ addressId: id }),
  setScheduledTime: (time) => set({ scheduledTime: time }),

  applyCoupon: (code) => {
    const coupon = couponByCode(code);
    if (!coupon) {
      toast('كود غير صالح');
      return false;
    }
    const subtotal = get().lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
    if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
      toast('الحد الأدنى للطلب غير مكتمل');
      return false;
    }
    set({ coupon });
    toast('تم تطبيق الكوبون 🎉');
    return true;
  },
  removeCoupon: () => set({ coupon: null }),
  setUseWallet: (v) => set({ useWallet: v }),
  setRedeemPoints: (v) => set({ redeemPoints: v }),

  count: () => get().lines.reduce((a, l) => a + l.qty, 0),
}));

/** Coupon discount value (﷼) for the current lines. */
export function couponDiscount(coupon: Coupon | null, lines: CartLine[]): number {
  if (!coupon) return 0;
  const base = coupon.appliesToCategory
    ? lines
        .filter((l) => productById(l.productId)?.categoryId === coupon.appliesToCategory)
        .reduce((a, l) => a + l.unitPrice * l.qty, 0)
    : lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  if (coupon.kind === 'percent') return Math.round(base * (coupon.value / 100) * 100) / 100;
  return Math.min(coupon.value, base);
}
