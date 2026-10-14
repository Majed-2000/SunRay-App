import { describe, expect, it } from 'vitest';
import { RESUME_MS, isResumable, resumeDecision, type InflightCheckoutRecord } from '../inflightCheckout';

const rec = (over: Partial<InflightCheckoutRecord> = {}): InflightCheckoutRecord => ({
  order: { orderId: 'o1', code: 'SR-1', totalHalalas: 1000, currency: 'SAR', free: false },
  cartKey: 'k',
  at: 1_000,
  uid: 'u1',
  ...over,
});

describe('isResumable', () => {
  it('resumes the same cart for the same customer within the window', () => {
    expect(isResumable(rec(), 'k', 'u1', 1_000 + 1000)).toBe(true);
  });
  it('not for a changed cart, another customer, or a stale order', () => {
    expect(isResumable(rec(), 'other', 'u1', 2_000)).toBe(false);
    expect(isResumable(rec(), 'k', 'u2', 2_000)).toBe(false);
    expect(isResumable(rec(), 'k', 'u1', 1_000 + RESUME_MS + 1)).toBe(false);
    expect(isResumable(null, 'k', 'u1')).toBe(false);
  });
});

describe('resumeDecision', () => {
  it('never re-opens the card form for a paid or in-review order', () => {
    expect(resumeDecision('paid')).toBe('done');
    expect(resumeDecision('review')).toBe('done');
  });
  it('starts over for cancelled, refunded, expired or missing orders', () => {
    for (const s of ['cancelled', 'refunded', 'expired', null, undefined]) expect(resumeDecision(s)).toBe('dead');
  });
  it('keeps collecting for anything unpaid', () => {
    for (const s of ['pending', 'awaiting_payment', 'failed']) expect(resumeDecision(s)).toBe('pay');
  });
});
