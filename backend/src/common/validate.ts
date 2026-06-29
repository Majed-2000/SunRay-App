/**
 * Reusable request-validation middleware. Pass any of `params`/`query`/`body`
 * Zod schemas; each present part is parsed and (for params/body) replaced with the
 * parsed value. Zod failures are forwarded and become a 422 in the error handler.
 *
 * NOTE: validating input does NOT replace authorization — even perfectly-shaped
 * input must still pass the auth/ownership guards. Prisma also protects us from
 * SQL injection (all access is parameterized), but bad input shapes still must be
 * rejected before they reach the database.
 */
import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';

interface Schemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** A cuid-ish id path param (loose enough for real cuids, strict enough to reject junk). */
export const idParam = z.object({ id: z.string().regex(/^[a-z0-9]{20,32}$/, 'معرّف غير صالح') });
