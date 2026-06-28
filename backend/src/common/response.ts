/**
 * Standard success responses. Every endpoint returns the SAME shape so the
 * mobile app can rely on it:  { "ok": true, "data": ... }
 * (Errors use { "ok": false, "error": ... } — see errors.ts.)
 */
import type { Response } from 'express';

export function ok<T>(res: Response, data: T) {
  return res.status(200).json({ ok: true, data });
}

export function created<T>(res: Response, data: T) {
  return res.status(201).json({ ok: true, data });
}
