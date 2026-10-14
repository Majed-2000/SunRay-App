import { describe, expect, it } from 'vitest';
import { eventSign } from '../loyaltySign';

describe('eventSign', () => {
  it('a negative adjust is a minus, a positive one a plus', () => {
    expect(eventSign('adjust', -50)).toBe('−');
    expect(eventSign('adjust', 50)).toBe('+');
  });
  it('earn and import follow the value', () => {
    expect(eventSign('earn', 12)).toBe('+');
    expect(eventSign('import', 2546)).toBe('+');
  });
  it('redeem / expire / reverse are debits whichever way they are stored', () => {
    for (const t of ['redeem', 'expire', 'reverse']) {
      expect(eventSign(t, 100)).toBe('−');
      expect(eventSign(t, -100)).toBe('−');
    }
  });
  it('shows no sign for zero', () => expect(eventSign('adjust', 0)).toBe(''));
});
