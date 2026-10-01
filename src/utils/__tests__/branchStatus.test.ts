import { describe, expect, it } from 'vitest';
import {
  branchStatusOf,
  dailyGate,
  inWindow,
  ksaNow,
  nearestBranch,
  sortBranches,
  todayHours,
  weekGate,
  type SiteBranch,
} from '../branchStatus';

/**
 * A UTC timestamp for a Riyadh wall-clock time. 2026-10-03 is a Saturday
 * (day 6), so `riyadh(0, ...)` is Saturday and `riyadh(-1, ...)` Friday.
 */
function riyadh(dayOffset: number, h: number, m = 0): number {
  return Date.UTC(2026, 9, 3 + dayOffset, h - 3, m);
}

/** The live `sunray/siteConfig/branches/go` record, as read on 2026-10-02. */
const GO: SiteBranch = {
  id: 'go',
  name: 'Sun Ray Go',
  lat: 21.2311437,
  lng: 40.3781914,
  hoursMode: 'auto',
  week: [
    [{ f: '06:00', t: '02:00' }],
    [{ f: '06:00', t: '02:00' }],
    [{ f: '06:00', t: '02:00' }],
    [{ f: '06:00', t: '02:00' }],
    [{ f: '06:00', t: '02:00' }],
    [{ f: '13:00', t: '02:00' }],
    [{ f: '06:00', t: '02:00' }],
  ],
};
const MAIN: SiteBranch = { id: 'main', name: 'Sun Ray Halqa', lat: 21.3425149, lng: 40.4401308 };
const SAIL: SiteBranch = { id: 'sail', name: 'Sun Ray Grove', lat: 21.4086, lng: 40.4435, comingSoon: true };

describe('ksaNow', () => {
  it('is Riyadh time regardless of the device zone', () => {
    expect(riyadh(0, 0)).toBe(Date.UTC(2026, 9, 2, 21, 0));
    expect(ksaNow(riyadh(0, 9, 30))).toEqual({ day: 6, min: 570 });
    expect(ksaNow(riyadh(-1, 23, 59))).toEqual({ day: 5, min: 1439 });
  });
});

describe('inWindow', () => {
  it('handles windows that cross midnight', () => {
    expect(inWindow(23 * 60, '22:00', '02:00')).toBe(true);
    expect(inWindow(60, '22:00', '02:00')).toBe(true);
    expect(inWindow(3 * 60, '22:00', '02:00')).toBe(false);
    expect(inWindow(10 * 60, '06:00', '14:00')).toBe(true);
    expect(inWindow(10 * 60, 'bad', '14:00')).toBe(false);
  });
});

describe('branchStatusOf', () => {
  it('coming soon beats everything', () => {
    expect(branchStatusOf({ ...SAIL, hoursMode: 'manual', manualOpen: true })).toEqual({
      open: false,
      soon: true,
      msg: 'لم يُفتَح بعد',
    });
  });

  it('force-close applies until its deadline', () => {
    const at = riyadh(0, 10);
    expect(branchStatusOf({ ...GO, force: { on: true, until: at + 60_000, msg: 'صيانة' } }, at)).toEqual({
      open: false,
      msg: 'صيانة',
    });
    expect(branchStatusOf({ ...GO, force: { on: true, until: at - 1 } }, at).open).toBe(true);
    expect(branchStatusOf({ ...GO, force: { on: true } }, at).msg).toBe('مغلق مؤقتاً');
  });

  it('auto: the week windows, including the tail past midnight', () => {
    expect(branchStatusOf(GO, riyadh(0, 10)).open).toBe(true);
    expect(branchStatusOf(GO, riyadh(0, 1)).open).toBe(true); // Saturday 01:00
    expect(branchStatusOf(GO, riyadh(0, 3))).toEqual({ open: false, msg: 'مغلق الآن' });
    // Friday opens at 13:00.
    expect(branchStatusOf(GO, riyadh(-1, 10)).open).toBe(false);
    expect(branchStatusOf(GO, riyadh(-1, 14)).open).toBe(true);
  });

  it('auto: a break closes an open window', () => {
    const b = { ...GO, breaks: [{ f: '12:00', t: '12:30', label: 'صلاة الظهر' }] };
    const s = branchStatusOf(b, riyadh(0, 12, 10));
    expect(s.open).toBe(false);
    expect(s.msg).toBe('صلاة الظهر (١٢م–١٢:٣٠م)');
  });

  it('manual follows the switch', () => {
    expect(branchStatusOf({ ...MAIN, hoursMode: 'manual', manualOpen: false }).msg).toBe('مغلق حالياً');
    expect(branchStatusOf({ ...MAIN, hoursMode: 'manual', manualOpen: false, closedMsg: 'x' }).msg).toBe('x');
    expect(branchStatusOf({ ...MAIN, hoursMode: 'manual' }).open).toBe(true);
  });

  it('no hoursMode = the legacy shared schedule', () => {
    expect(branchStatusOf(MAIN, riyadh(0, 2, 50)).open).toBe(false); // maintenance
    expect(branchStatusOf(MAIN, riyadh(-1, 12)).open).toBe(false); // Friday prayer
    expect(branchStatusOf(MAIN, riyadh(-1, 14)).open).toBe(true);
    expect(branchStatusOf(MAIN, riyadh(0, 4)).open).toBe(true);
  });
});

describe('todayHours', () => {
  it('reads today from the week, and is null without a schedule', () => {
    expect(todayHours(GO, riyadh(-1, 9))).toBe('اليوم ١م–٢ص');
    expect(todayHours(GO, riyadh(0, 9))).toBe('اليوم ٦ص–٢ص');
    expect(todayHours(MAIN)).toBeNull();
    expect(todayHours(SAIL)).toBeNull();
  });
});

describe('sortBranches / nearestBranch', () => {
  it('main first, coming soon last, regardless of key order', () => {
    expect(sortBranches([GO, MAIN, SAIL]).map((b) => b.id)).toEqual(['main', 'go', 'sail']);
    expect(sortBranches([SAIL, GO, MAIN]).map((b) => b.id)).toEqual(['main', 'go', 'sail']);
  });

  it('never picks a branch that has not opened', () => {
    // Standing on the Grove site itself.
    const r = nearestBranch([MAIN, GO, SAIL], 21.4086, 40.4435);
    expect(r?.branch.id).toBe('main');
    expect(r!.km).toBeGreaterThan(5);
    expect(nearestBranch([SAIL], 21.4, 40.4)).toBeNull();
  });
});

describe('weekGate (Go menu)', () => {
  it('counts yesterday tail and finds the next opening', () => {
    expect(weekGate(GO, riyadh(0, 1))).toMatchObject({ open: true, until: '02:00' });
    const closed = weekGate(GO, riyadh(-1, 10)); // Friday 10:00
    expect(closed.open).toBe(false);
    expect(closed.next).toEqual({ k: 0, day: 5, f: '13:00' });
    expect(weekGate(GO, riyadh(0, 3)).next).toEqual({ k: 0, day: 6, f: '06:00' });
  });

  it('daily fallback crosses midnight', () => {
    expect(dailyGate({ from: '16:00', to: '02:00' }, riyadh(0, 1))?.open).toBe(true);
    expect(dailyGate({ from: '16:00', to: '02:00' }, riyadh(0, 10))?.open).toBe(false);
    expect(dailyGate(null)).toBeNull();
  });
});
