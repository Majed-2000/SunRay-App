import { describe, expect, it } from 'vitest';
import {
  bookableDates,
  buildCateringRecord,
  buildTicketRecord,
  dayNameFor,
  daysUntil,
  genCode,
  normalizeTicketCode,
  packTotal,
  quote,
  remainderHalalas,
  validateContact,
} from '../requestRules';

/**
 * These pin the app to sunray.sa's figures and record shapes. If one fails,
 * check client-catering.js / tickets.js before "fixing" the test: the staff
 * dashboard reads both channels from the same records.
 */
describe('catering money', () => {
  it('prices the packs as the site does', () => {
    expect(packTotal('50|699', 0)).toBe(699);
    expect(packTotal('200|2650', 0)).toBe(2650);
    expect(packTotal('more', 250)).toBe(2650 + 50 * 15);
    expect(packTotal('more', 200)).toBeNull();
    expect(packTotal(null, 0)).toBeNull();
  });

  it('computes deposit, insurance and remainder like calcPrice()', () => {
    expect(quote(1150)).toEqual({ total: 1150, deposit: 805, insurance: 300, depositDue: 1105, fullDue: 1450, remain: 345 });
    expect(quote(699).deposit).toBe(489); // Math.round(489.3)
  });

  it('infers the remainder from paidHalalas', () => {
    const rec = { finance: { total: 1150, insurance: 300, paidHalalas: 110500 } };
    expect(remainderHalalas(rec)).toBe(34500);
    expect(remainderHalalas({ finance: { total: 1150, paidHalalas: 145000 } })).toBe(0);
  });
});

describe('catering dates', () => {
  const now = new Date(2026, 9, 2, 15, 0); // 2 Oct 2026, afternoon

  it('offers tomorrow to +30 minus blocked dates', () => {
    const d = bookableDates({ '2026-10-05': true, '2026-10-06': false }, now);
    expect(d[0]).toBe('2026-10-03');
    expect(d).toHaveLength(29);
    expect(d).not.toContain('2026-10-05');
    expect(d).toContain('2026-10-06');
    expect(d[d.length - 1]).toBe('2026-11-01');
  });

  it('counts days and names them with the site spelling', () => {
    expect(daysUntil('2026-10-05', now)).toBe(3);
    expect(dayNameFor('2026-10-04')).toBe('الاحد');
    expect(dayNameFor('2026-10-07')).toBe('الاربعاء');
  });
});

describe('codes', () => {
  it('generates CK-/TK- with four digits', () => {
    expect(genCode('CK', () => 0)).toBe('CK-1000');
    expect(genCode('TK', () => 0.99999)).toBe('TK-9999');
  });
  it('normalizes typed ticket codes', () => {
    expect(normalizeTicketCode('tk-1234')).toBe('TK-1234');
    expect(normalizeTicketCode('١٢٣٤')).toBe('TK-1234');
    expect(normalizeTicketCode('12')).toBeNull();
  });
});

describe('record shapes', () => {
  it('writes the catering record the site writes', () => {
    const rec = buildCateringRecord(
      {
        name: ' سارة ',
        phone: '0501234567',
        occasion: 'تخرج',
        date: '2026-10-10',
        time: '16:30',
        location: { lat: 21.27, lng: 40.41, desc: 'قاعة' },
        pack: '100|1150',
        moreCups: 0,
        drinks: ['قهوة مقطرة', 'كركديه'],
        notes: '',
      },
      'CK-1234',
      'TS',
    );
    expect(rec).toEqual({
      code: 'CK-1234',
      client: { name: 'سارة', phone: '0501234567' },
      eventDetails: {
        occasion: 'تخرج',
        date: '2026-10-10',
        time: '16:30',
        day: 'السبت',
        location: { lat: '21.27', lng: '40.41', desc: 'قاعة' },
      },
      order: { pack: '100|1150', moreCups: 0, drinks: ['قهوة مقطرة', 'كركديه'], notes: '' },
      finance: { total: 1150, deposit: 805, insurance: 300, remain: 345, status: 'pending_verify' },
      status: 'new',
      agreedTerms: true,
      agreedTermsAt: 'TS',
      payMethodChosen: 'card',
      createdAt: 'TS',
    });
  });

  it('writes the ticket record tickets.js writes', () => {
    const contact = validateContact('instagram', '@@sun')!;
    expect(contact).toEqual({ contactType: 'instagram', contactValue: 'sun', contactMethod: '@sun' });
    expect(validateContact('phone', '0501')).toBeNull();
    const rec = buildTicketRecord(
      { type: 'suggestion', title: 't', body: 'b', contact, incidentTime: '2026-10-01T10:00' },
      'TK-4321',
      'TS',
    );
    expect(rec).toEqual({
      code: 'TK-4321',
      type: 'suggestion',
      title: 't',
      body: 'b',
      source: 'customer',
      contactType: 'instagram',
      contactValue: 'sun',
      contactMethod: '@sun',
      incidentTime: null, // suggestions carry no incident time, as on the site
      attachments: null,
      status: 'new',
      createdAt: 'TS',
    });
  });
});
