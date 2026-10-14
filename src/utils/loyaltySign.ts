/** Ledger event types that can only take points away. */
const DEBIT_TYPES = new Set(['redeem', 'expire', 'reverse']);

/**
 * The sign to show for a ledger row.
 *
 * It comes from the number itself: an `adjust` of -50 is a debit, but showed
 * «+٥٠» because the sign was picked from the event type and `Math.abs` hid the
 * minus. The one thing the number cannot say is a debit recorded as a positive
 * magnitude, so redeem / expire / reverse stay debits either way.
 */
export function eventSign(type: string, points: number): '+' | '−' | '' {
  if (!Number.isFinite(points) || points === 0) return '';
  if (points < 0) return '−';
  return DEBIT_TYPES.has(type) ? '−' : '+';
}
