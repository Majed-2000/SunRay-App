import { describe, expect, it } from 'vitest';
import { calcTotals, pointsEarned } from '@/utils/money';
import type { CartLine } from '@/types';

const line = (unitPrice: number, qty = 1): CartLine => ({
  id: `l${unitPrice}x${qty}`,
  productId: 'p',
  nameAr: 'قهوة',
  nameEn: '',
  icon: 'cup-hot',
  optionLabel: '',
  addOnIds: [],
  unitPrice,
  qty,
});

describe('calcTotals — VAT is inclusive', () => {
  it('extracts VAT from the total and never adds it on top', () => {
    const t = calcTotals({ lines: [line(11.5)], isDelivery: false });
    // 11.50 on the shelf is 11.50 charged; 1.50 of it is the 15% tax.
    expect(t.total).toBe(11.5);
    expect(t.vat).toBe(1.5);
  });

  it('sums quantities', () => {
    const t = calcTotals({ lines: [line(9, 2), line(11)], isDelivery: false });
    expect(t.subtotal).toBe(29);
    expect(t.total).toBe(29);
  });

  it('ignores a delivery fee when the order is not delivery', () => {
    const t = calcTotals({ lines: [line(10)], isDelivery: false, deliveryFee: 15 });
    expect(t.deliveryFee).toBe(0);
    expect(t.total).toBe(10);
  });

  it('never lets a discount push the total below zero', () => {
    const t = calcTotals({ lines: [line(10)], isDelivery: false, discount: 5, walletApplied: 50 });
    expect(t.total).toBe(0);
    expect(t.walletApplied).toBe(5);
  });

  it('treats negative inputs as zero', () => {
    const t = calcTotals({ lines: [line(10)], isDelivery: false, discount: -3 });
    expect(t.discount).toBe(0);
    expect(t.total).toBe(10);
  });
});

describe('pointsEarned', () => {
  it('uses the rate the ledger reports', () => {
    expect(pointsEarned(39, 1)).toBe(39);
    expect(pointsEarned(39, 2)).toBe(78);
  });
  it('earns nothing at a non-positive rate', () => {
    expect(pointsEarned(39, 0)).toBe(0);
    expect(pointsEarned(39, -1)).toBe(0);
  });
});
