/**
 * SMS delivery via Yamamah (اليمامة) — called directly, per their HTTP API spec.
 *
 * Endpoint (from the official integration document):
 *   POST http://api.yamamah.com/SendSMS
 *   Content-Type: application/json
 *   { Username, Password, Tagname, RecepientNumber, VariableList,
 *     ReplacementList, Message, SendDateTime, EnableDR }
 *
 * ⚠️ IP WHITELIST: Yamamah authorises senders by source IP. Our outbound address
 * is **130.94.120.78** (verified from the server, not assumed). Until that is on
 * their list every request simply times out — the host resolves to 95.129.8.184
 * but never answers. A timeout here almost always means "not whitelisted yet",
 * not "wrong credentials".
 *
 * We previously routed through a relay at cloud.shubra.net to dodge the
 * whitelist; it began returning 503 and is no longer used. Calling Yamamah
 * directly also removes a third party from the path that OTP codes travel.
 *
 * ⚠️ `RecepientNumber` is misspelled in Yamamah's own API. Correcting it breaks
 * delivery silently.
 */
import { env } from '../../config/env';
import { logger } from '../../common/logger';

export interface SmsResult {
  ok: boolean;
  status: number;
  body?: string;
}

/**
 * Saudi national number (`5XXXXXXXX`) → the international form Yamamah expects
 * (`9665XXXXXXXX`). Anything already carrying the country code is left alone.
 */
export function toInternational(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, '');
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  return `966${digits}`;
}

export function smsConfigured(): boolean {
  return Boolean(env.SMS_URL && env.SMS_USERNAME && env.SMS_PASSWORD);
}

export async function sendSms(toLocalPhone: string, message: string): Promise<SmsResult> {
  if (!smsConfigured()) return { ok: false, status: 0, body: 'SMS is not configured' };

  const payload = {
    Username: env.SMS_USERNAME,
    Password: env.SMS_PASSWORD,
    Tagname: env.SMS_SENDER,
    RecepientNumber: toInternational(toLocalPhone),
    VariableList: '',
    // Present in the official spec but absent from the relay example we were
    // given first. Yamamah uses it for template substitution; we send plain
    // text, so it stays empty — but omitting a documented field risks a reject.
    ReplacementList: '',
    Message: message,
    SendDateTime: 0,
    EnableDR: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(env.SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.text();

    // Never log the message body — it contains the OTP — nor the credentials.
    // The recipient is logged in masked form so delivery can still be traced.
    const masked = toInternational(toLocalPhone).replace(/^(\d{5})\d+(\d{2})$/, '$1****$2');
    if (!res.ok) logger.warn(`SMS send failed for ${masked}: HTTP ${res.status}`);
    else logger.info(`SMS sent to ${masked}`);

    return { ok: res.ok, status: res.status, body: body.slice(0, 300) };
  } catch (err) {
    logger.warn(`SMS transport error: ${(err as Error).message}`);
    return { ok: false, status: 0, body: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Account balance — the cheapest way to prove connectivity, credentials and the
 * IP whitelist all work, without spending an SMS or messaging a real person.
 *
 * Run this first after Yamamah adds 130.94.120.78. A timeout means the whitelist
 * has not taken effect; an HTTP error means the credentials are wrong.
 */
export async function getCredit(): Promise<SmsResult> {
  if (!smsConfigured()) return { ok: false, status: 0, body: 'SMS is not configured' };

  const url = env.SMS_URL.replace(/\/SendSMS\/?$/i, '/GetCredit');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Username: env.SMS_USERNAME, Password: env.SMS_PASSWORD }),
      signal: controller.signal,
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 300) };
  } catch (err) {
    return { ok: false, status: 0, body: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
