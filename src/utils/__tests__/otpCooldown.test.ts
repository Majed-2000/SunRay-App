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

import { canResumeOtp } from '../otpCooldown';

describe('canResumeOtp', () => {
  const prev = { phone: '501234567', at: 1_000_000 };
  it('resumes for the same phone on cooldown', () => {
    expect(canResumeOtp(prev, '501234567', 'cooldown', 1_030_000)).toBe(true);
  });
  it('does not resume for another phone', () => {
    expect(canResumeOtp(prev, '502222222', 'cooldown', 1_030_000)).toBe(false);
  });
  it('does not resume once the code has expired', () => {
    expect(canResumeOtp(prev, '501234567', 'cooldown', 1_000_000 + 301_000)).toBe(false);
  });
  it('does not resume on other refusals or with nothing sent', () => {
    expect(canResumeOtp(prev, '501234567', 'bad_phone', 1_030_000)).toBe(false);
    expect(canResumeOtp(null, '501234567', 'cooldown', 1_030_000)).toBe(false);
  });
});
