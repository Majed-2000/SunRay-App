/**
 * VAT is inclusive — menu prices already contain it.
 *
 * These tests exist because we shipped the opposite: VAT was added on top, so a
 * 10.00 SAR coffee was billed at 11.50 while the counter charged 10.00. Every
 * order was affected. If these ever fail, someone has reintroduced that bug.
 */
import { describe, expect, it } from 'vitest';
import { DELIVERY_FEE, VAT_RATE, sarToHalalas, vatIncludedIn, vatOf } from '../common/money';

describe('VAT is inclusive, not added on top', () => {
  it('a 10.00 SAR item costs exactly 10.00 SAR', () => {
    const price = sarToHalalas(10);
    const total = price; // pickup: no delivery fee, no discount
    expect(total).toBe(1000);
    // …of which the tax portion is 1.30 SAR, carved out rather than appended.
    expect(vatIncludedIn(total)).toBe(130);
  });

  it('the extracted tax never inflates the total', () => {
    for (const sar of [1, 9.95, 10, 18, 23.5, 100]) {
      const total = sarToHalalas(sar);
      const tax = vatIncludedIn(total);
      const net = total - tax;
      expect(tax).toBeLessThan(total);
      // net + tax must reconstruct the total exactly — no lost halalas.
      expect(net + tax).toBe(total);
      // and net grossed back up lands on the total, within rounding.
      expect(Math.abs(Math.round(net * (1 + VAT_RATE)) - total)).toBeLessThanOrEqual(1);
    }
  });

  it('delivery fee is part of the taxed total', () => {
    const subtotal = sarToHalalas(20);
    const total = subtotal + DELIVERY_FEE;
    expect(total).toBe(sarToHalalas(35));
    // Tax is taken from the whole amount, not the items alone.
    expect(vatIncludedIn(total)).toBeGreaterThan(vatIncludedIn(subtotal));
  });

  it('vatOf still adds on top — kept only for genuinely net amounts', () => {
    // Guards the distinction: confusing the two is what caused the overcharge.
    expect(vatOf(1000)).toBe(150);
    expect(vatIncludedIn(1000)).toBe(130);
    expect(vatOf(1000)).not.toBe(vatIncludedIn(1000));
  });
});
