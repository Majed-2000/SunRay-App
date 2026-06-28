/**
 * Money helpers. We store and calculate money as INTEGER halalas (1 SAR = 100
 * halalas) to avoid floating-point rounding bugs. Convert only at the edges.
 */
export const sarToHalalas = (sar: number) => Math.round(sar * 100);
export const halalasToSar = (halalas: number) => halalas / 100;
export const formatSar = (halalas: number) => `${(halalas / 100).toFixed(2)} ﷼`;

export const VAT_RATE = 0.15; // KSA VAT 15%
export const DELIVERY_FEE = sarToHalalas(15); // flat delivery fee in halalas

/** VAT amount (halalas) for a given subtotal (halalas), rounded to the nearest halala. */
export const vatOf = (subtotalHalalas: number) => Math.round(subtotalHalalas * VAT_RATE);
