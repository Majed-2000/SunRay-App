/**
 * Error handling helpers.
 *
 * - `AppError` is a controlled error we throw on purpose (e.g. "not found").
 * - `asyncHandler` wraps an async route so any thrown error is forwarded to the
 *   error handler instead of crashing the server (no try/catch in every route).
 * - `errorHandler` is the single place that converts ANY error into our standard
 *   JSON error shape: { ok:false, error:{ code, message, details? } }.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Convenience constructors for the errors we use most.
export const NotFound = (message = 'غير موجود') => new AppError(404, 'NOT_FOUND', message);
export const BadRequest = (message = 'طلب غير صالح', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const Conflict = (message = 'تعارض في البيانات') => new AppError(409, 'CONFLICT', message);

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async route handler so rejected promises reach the error handler. */
export const asyncHandler =
  (fn: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** 404 for unknown routes. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: `المسار غير موجود: ${req.method} ${req.originalUrl}` },
  });
}

/** The final error handler (must have 4 args so Express recognizes it). */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors → 422 with field details.
  if (err instanceof ZodError) {
    res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صالحة', details: err.flatten() },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Anything else is unexpected — log it and return a generic 500.
  logger.error('Unhandled error', err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع' },
  });
}
