import { describe, expect, it } from 'vitest';
import { buildGoMenu, cleanName, goGate, priceOf, type GoMenuInput } from '../goMenu';

/** Saturday 2026-10-03 at a Riyadh wall-clock hour. */
const riyadh = (h: number) => Date.UTC(2026, 9, 3, h - 3, 0);

const GO_BRANCH = {
  id: 'go',
  hoursMode: 'auto' as const,
  week: Array.from({ length: 7 }, (_, d) => [{ f: d === 5 ? '13:00' : '06:00', t: '02:00' }]),
  hours: 'السبت–الخميس ٦ص–٢ص · الجمعة ١م–٢ص',
};

function input(over: Partial<GoMenuInput> = {}): GoMenuInput {
  return {
    products: {
      americano_cold: { name: 'أمريكانو بارد', section: 'coldDrinks', priceHalalas: 1100, active: true },
      latte_hot: { name: 'لاتيه', section: 'hotDrinks', priceHalalas: 1400, isNew: true, createdAt: 5 },
      ice_matcha: { name: 'آيس ماتشا', section: 'coldDrinks', priceHalalas: 1800 },
      cod_small: { name: 'قهوة اليوم صغير', section: 'hotDrinks', priceHalalas: 900 },
      pecan_pie: { name: 'بيكان', section: 'desserts', priceHalalas: 2000 },
      cookies_classic: { name: 'كوكيز', section: 'desserts', priceHalalas: 800 },
      gone: { name: 'محذوف', section: 'hotDrinks', priceHalalas: 100, active: false },
      v60_hot: { name: 'قهوة مقطرة (حار)', section: 'pouroverSection', tier: 'base' },
      po_yem: {
        name: 'يمني (فاخر)',
        section: 'pouroverSection',
        tier: 'premium',
        crop: { nameAr: 'يمني' },
        methodPriceHalalas: { hot: 1800, cold: 1900 },
      },
      po_eth: {
        name: 'إثيوبي (فاخر)',
        section: 'pouroverSection',
        tier: 'premium',
        crop: { nameAr: 'إثيوبي' },
        methodPriceHalalas: { hot: 2500 },
      },
    },
    driveThru: {
      americano_cold: { order: 2 },
      latte_hot: { order: 1, priceHalalas: 1300 },
      ice_matcha: { order: 3 },
      cod_small: { order: 4 },
      pecan_pie: { order: 5 },
      cookies_classic: { order: 6, avail: false },
      gone: { order: 7 },
      po_yem: { order: 8 },
      po_eth: { order: 9 },
    },
    config: { closed: false, hours: { from: '16:00', to: '02:00' } },
    branch: GO_BRANCH,
    branchReady: true,
    newOrder: [],
    ...over,
  };
}

describe('buildGoMenu', () => {
  const tabs = buildGoMenu(input());
  const tab = (k: string) => tabs.find((t) => t.key === k);

  it('orders tabs as the website does, new first', () => {
    expect(tabs.map((t) => t.key)).toEqual(['new', 'pourover', 'today', 'drinks', 'matcha']);
  });

  it('hides inactive, unavailable-at-Go and non-approved desserts', () => {
    const all = tabs.flatMap((t) => t.sections.flatMap((s) => s.items.map((i) => i.id)));
    expect(all).not.toContain('gone');
    expect(all).not.toContain('cookies_classic');
    expect(all).not.toContain('pecan_pie');
  });

  it('pulls matcha out of drinks and splits hot from cold', () => {
    expect(tab('matcha')!.sections[0].items.map((i) => i.id)).toEqual(['ice_matcha']);
    expect(tab('drinks')!.sections.map((s) => s.title)).toEqual(['المشروبات الحارة', 'المشروبات الباردة']);
  });

  it('prices: Go branch price, then the Go override, then the product', () => {
    expect(tab('drinks')!.sections[0].items[0].price).toBe('١٣ ﷼');
    expect(tab('today')!.sections[0].items[0].price).toBe('٧ ﷼');
    expect(priceOf('x', { price: 0 }, undefined)).toBe(0);
  });

  it('V60: only allowed beans, and the cup says «من» the lowest', () => {
    const [cups, beans] = tab('pourover')!.sections;
    expect(cups.items[0]).toMatchObject({ id: 'v60_hot', price: 'من ١٨ ﷼' });
    expect(beans.items.map((i) => i.id)).toEqual(['po_yem']);
    expect(beans.items[0]).toMatchObject({ name: 'يمني', price: 'حار ١٨ ﷼ · بارد ١٩ ﷼' });
  });

  it('strips tier suffixes from names', () => {
    expect(cleanName('يمني (فاخر)')).toBe('يمني');
  });
});

describe('goGate', () => {
  it('closed flag beats everything', () => {
    expect(goGate({ ...input(), config: { closed: true } }, riyadh(10)).kind).toBe('updating');
  });

  it('weekly schedule wins over the old daily hours', () => {
    expect(goGate(input(), riyadh(10))).toEqual({ kind: 'open', until: '٢ص' });
    const closed = goGate(input(), riyadh(4));
    expect(closed).toMatchObject({ kind: 'closed', next: 'نفتح اليوم الساعة ٦ص' });
  });

  it('never closes on daily hours before the schedule has answered', () => {
    expect(goGate({ ...input(), branch: null, branchReady: false }, riyadh(10)).kind).toBe('open');
    expect(goGate({ ...input(), branch: null, branchReady: true }, riyadh(10)).kind).toBe('closed');
  });
});
