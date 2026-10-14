import { describe, expect, it } from 'vitest';
import {
  buildRewardLine,
  checkRewardRoom,
  rewardCartPoints,
  rewardsWithinBalance,
  rewardTemps,
} from '../rewards';

describe('rewardTemps', () => {
  it('drops "-" and blanks, keeps order, dedupes', () => {
    expect(rewardTemps({ key: 'a', fxTemps: ['hot', 'cold', 'hot'] })).toEqual(['hot', 'cold']);
    expect(rewardTemps({ key: 'a', fxTemps: ['-'] })).toEqual([]);
    expect(rewardTemps({ key: 'a' })).toEqual([]);
    expect(rewardTemps(undefined)).toEqual([]);
  });
});

describe('checkRewardRoom', () => {
  it('allows a reward the balance covers', () => {
    expect(checkRewardRoom(500, 0, 500)).toEqual({ ok: true });
    expect(checkRewardRoom(500, 200, 300)).toEqual({ ok: true });
  });
  it('blocks and says what is left', () => {
    const r = checkRewardRoom(500, 200, 400);
    expect(r).toEqual({ ok: false, message: 'المتبقّي لك 300 نقطة، وهذه المكافأة تحتاج 400.' });
  });
  it('says the cart is already over the balance', () => {
    const r = checkRewardRoom(100, 150, 50);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('تجاوزت رصيدك بـ 50 نقطة');
  });
});

describe('reward cart lines', () => {
  const reward = { id: 'r1', points: 300, label: 'قهوة مجانية' };
  const product = { key: 'latte', name: 'لاتيه', fxTemps: ['hot', 'cold'] };

  it('builds a free single line carrying rewardId and temp', () => {
    const l = buildRewardLine(reward, product, 'cold', 1);
    expect(l).toMatchObject({
      productId: 'latte',
      unitPrice: 0,
      qty: 1,
      rewardId: 'r1',
      rewardPoints: 300,
      rewardTemp: 'cold',
      nameAr: 'لاتيه',
    });
  });
  it('gives each redemption its own line id', () => {
    expect(buildRewardLine(reward, product, 'hot', 1).id).not.toBe(buildRewardLine(reward, product, 'hot', 2).id);
  });
  it('sums only reward lines and compares to the balance', () => {
    const a = buildRewardLine(reward, product, 'hot', 1);
    const plain = { ...a, id: 'p', rewardId: undefined, rewardPoints: undefined, unitPrice: 20 };
    expect(rewardCartPoints([a, a, plain])).toBe(600);
    expect(rewardsWithinBalance(600, [a, a, plain])).toEqual({ ok: true });
    expect(rewardsWithinBalance(500, [a, a]).ok).toBe(false);
    expect(rewardsWithinBalance(0, [plain])).toEqual({ ok: true });
  });
});
