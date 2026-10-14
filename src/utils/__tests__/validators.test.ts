import { describe, expect, it } from 'vitest';
import { isValidSaudiMobile, normalizeMobile } from '../validators';

describe('normalizeMobile', () => {
  it.each([
    ['501234567', '501234567'],
    ['0501234567', '501234567'],
    ['+966501234567', '501234567'],
    ['966501234567', '501234567'],
    ['00966501234567', '501234567'],
    ['+966 50 123 4567', '501234567'],
    ['٠٥٠١٢٣٤٥٦٧', '501234567'],
  ])('%s -> %s', (input, out) => {
    expect(normalizeMobile(input)).toBe(out);
  });
  it('caps at 9 digits while typing', () => {
    expect(normalizeMobile('50123456789')).toBe('501234567');
  });
});

describe('isValidSaudiMobile', () => {
  it('accepts common shapes', () => {
    for (const v of ['0501234567', '+966501234567', '501234567']) expect(isValidSaudiMobile(v)).toBe(true);
  });
  it('rejects non-mobile', () => {
    expect(isValidSaudiMobile('0112345678')).toBe(false);
    expect(isValidSaudiMobile('50123')).toBe(false);
  });
});
