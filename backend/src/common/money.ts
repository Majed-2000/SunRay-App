/**
 * Money helpers. We store and calculate money as INTEGER halalas (1 SAR = 100
 * halalas) to avoid floating-point rounding bugs. Convert only at the edges.
 */
export const sarToHalalas = (sar: number) => Math.round(sar * 100);
export const halalasToSar = (halalas: number) => halalas / 100;
export const formatSar = (halalas: number) => `${(halalas / 100).toFixed(2)} ﷼`;

export const VAT_RATE = 0.15; // KSA VAT 15%
export const DELIVERY_FEE = sarToHalalas(15); // flat delivery fee in halalas

/**
 * 🔴 VAT IS INCLUSIVE. Menu prices already contain it.
 *
 * Foodics stores shelf prices — what the customer actually hands over at the
 * counter — and the business is configured VAT-inclusive. So a product listed at
 * 10.00 SAR costs 10.00 SAR, of which 1.30 is tax; it is NOT 10.00 + 15%.
 *
 * We got this wrong at first and charged 11.50 for a 10.00 coffee on every
 * order, which is why `vatOf` below is deliberately no longer used for totals.
 *
 * Use `vatIncludedIn` to report how much tax sits inside a total — for the
 * receipt breakdown and for the `taxes[]` array Foodics expects on each line.
 */
export const vatIncludedIn = (totalHalalas: number) =>
  totalHalalas - Math.round(totalHalalas / (1 + VAT_RATE));

/**
 * VAT added ON TOP of a net amount.
 *
 * ⚠️ Not used for order totals — see `vatIncludedIn`. Kept only for the case of
 * a genuinely tax-exclusive amount, and if you reach for it in the checkout path
 * you are about to overcharge the customer.
 */
export const vatOf = (netHalalas: number) => Math.round(netHalalas * VAT_RATE);
