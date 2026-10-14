import { describe, expect, it } from 'vitest';
import { cooldownRemaining, pickCooldownSec } from '../otpCooldown';

describe('pickCooldownSec', () => {
  it('uses the server value', () => expect(pickCooldownSec(45)).toBe(45));
  it('falls back to 60', () => {
    for (const v of [undefined, null, 0, -5, 'x', NaN]) expect(pickCooldownSec(v)).toBe(60);
  });
});

describe('cooldownRemaining', () => {
  it('counts down and clamps at zero', () => {
    expect(cooldownRemaining(61_000, 1_000)).toBe(60);
    expect(cooldownRemaining(1_500, 1_000)).toBe(1);
    expect(cooldownRemaining(1_000, 5_000)).toBe(0);
  });
});
