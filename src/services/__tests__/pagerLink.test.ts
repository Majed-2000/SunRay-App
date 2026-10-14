import { describe, expect, it } from 'vitest';
import { classifyScan, normalizeFollowCode, receiptFromPos } from '../pagerLink';

const T = 'a'.repeat(64);
const S = 'b'.repeat(48);

describe('classifyScan', () => {
  it('opens the cashier pager link in the app', () => {
    expect(classifyScan(`https://sunray.sa/store/pager.html?t=${T}`)).toEqual({ kind: 'pager', token: T, session: undefined });
    expect(classifyScan(`https://www.sunray.sa/store/pager?t=${T}`)).toMatchObject({ kind: 'pager', token: T });
    expect(classifyScan(`  HTTPS://SUNRAY.SA/store/pager.html?x=1&t=${T}  `)).toMatchObject({ kind: 'pager', token: T });
    expect(classifyScan(`https://sunray.sa/store/pager.html#s=${S}`)).toMatchObject({ kind: 'pager', session: S });
  });

  it('sends other Sun Ray pages to the browser, over https', () => {
    expect(classifyScan('http://sunray.sa/menu')).toEqual({ kind: 'site', url: 'https://sunray.sa/menu' });
    expect(classifyScan('https://sunray.sa')).toEqual({ kind: 'site', url: 'https://sunray.sa' });
    // A malformed token is not a pager.
    expect(classifyScan('https://sunray.sa/store/pager.html?t=xyz')).toMatchObject({ kind: 'site' });
  });

  it('refuses everything that is not sunray.sa', () => {
    for (const raw of [
      'https://sunray.sa.evil.example/store/pager.html',
      'https://sunray.sa@evil.example/',
      'https://evil.example/?u=https://sunray.sa',
      'https://notsunray.sa/',
      'javascript:alert(1)',
      'ftp://sunray.sa/',
      'sunray.sa/store/pager.html',
      'WIFI:S:cafe;;',
      '',
    ]) {
      expect(classifyScan(raw)).toEqual({ kind: 'foreign' });
    }
  });
});

describe('normalizeFollowCode', () => {
  it('keeps six characters from the alphabet', () => {
    expect(normalizeFollowCode('ab-c d2 3x9')).toBe('ABCD23');
    expect(normalizeFollowCode('O0I1L')).toBe('');
    expect(normalizeFollowCode('k٢٣m')).toBe('K23M');
  });
});

describe('receiptFromPos', () => {
  it('uses the POS totals and balances VAT to the halala', () => {
    const r = receiptFromPos('42', {
      checkNumber: 'C-1',
      subtotal: 26.09,
      total: 30,
      rounding: 0,
      discount: 0,
      lines: [
        { name: 'Latte', qty: 2, unit: 15, total: 30, mods: [{ name: 'Oat' }] },
        { name: 'Returned', qty: 1, returned: 1, unit: 5 },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.lines).toEqual([{ name: 'Latte', qty: 2, mods: 'Oat', lineHalalas: 3000 }]);
    expect(r!.totalHalalas).toBe(3000);
    expect(r!.subExclHalalas + r!.vatHalalas).toBe(3000);
  });

  it('returns null rather than a partial invoice', () => {
    expect(receiptFromPos('1', { checkNumber: 'C', total: 1, lines: [] })).toBeNull();
    expect(receiptFromPos('1', null)).toBeNull();
  });
});
