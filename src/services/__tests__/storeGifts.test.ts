import { describe, expect, it, vi } from 'vitest';

// The module under test talks to Firebase; these tests cover only its pure
// helpers, so the connection is stubbed out rather than initialised.
vi.mock('../firebase', () => ({ callFn: vi.fn(), db: vi.fn() }));

const {
  selfServePackages,
  packageContents,
  giftShareUrl,
  giftIdFromLink,
  myGiftUrl,
  giftPaymentMetadata,
  sanitizeHex,
} = await import('../storeGifts');

describe('selfServePackages', () => {
  it('keeps what gift-buy.js keeps: active and selfServe, by order', () => {
    const list = selfServePackages({
      b: { name: 'B', priceSar: 99, order: 2, selfServe: true },
      a: { name: 'A', priceSar: 59, order: 1, selfServe: true, cups: 2, desserts: 1 },
      off: { name: 'Off', priceSar: 10, order: 0, selfServe: true, active: false },
      tailored: { name: 'Support only', priceSar: 300, order: 0 },
    });
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
    expect(list[0]).toMatchObject({ name: 'A', priceSar: 59, cups: 2, desserts: 1 });
  });

  it('reads the live row shape (`name`, not `nameAr`)', () => {
    const [p] = selfServePackages({
      pmr7uo0ke: { active: true, cups: 2, desserts: 1, name: 'باقة 59', order: 1, priceSar: 59, selfServe: true },
    });
    expect(p.name).toBe('باقة 59');
  });

  it('survives an empty node', () => {
    expect(selfServePackages(null)).toEqual([]);
  });
});

describe('links', () => {
  it('shares the gift page the site shares', () => {
    expect(giftShareUrl('-Nabc_1')).toBe('https://sunray.sa/store/gift.html?g=-Nabc_1');
  });

  it('finds the gift id in a myGifts link', () => {
    expect(giftIdFromLink('gift.html?g=-Nabc')).toBe('-Nabc');
    expect(giftIdFromLink(undefined)).toBeNull();
  });

  it('resolves myGifts rows to the site', () => {
    expect(myGiftUrl({ token: 'ab12' })).toBe('https://sunray.sa/g/ab12');
    expect(myGiftUrl({ link: './gift.html?g=x' })).toBe('https://sunray.sa/store/gift.html?g=x');
    expect(myGiftUrl({})).toBeNull();
  });
});

describe('payment', () => {
  it('sends the metadata the site sends — never order_id', () => {
    expect(giftPaymentMetadata('g1', 'i1')).toEqual({ gift_id: 'g1', gift_intent: 'i1' });
  });
});

describe('card', () => {
  it('describes a package in the site wording', () => {
    expect(packageContents({ cups: 2, desserts: 1 })).toBe('٢ كوب قهوة مقطّرة كلاسيكية + ١ حلى');
    expect(packageContents({})).toBe('');
  });

  it('accepts only #rrggbb colours', () => {
    expect(sanitizeHex('#ABCDEF', '#000000')).toBe('#abcdef');
    expect(sanitizeHex('red', '#000000')).toBe('#000000');
  });
});
