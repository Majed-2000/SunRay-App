/**
 * A very small logger. We avoid extra libraries to keep things simple: it just
 * prints timestamped messages, and provides an Express middleware that logs each
 * request (method, path, status, and how long it took).
 */
import type { NextFunction, Request, Response } from 'express';

function stamp(level: string, message: string, extra?: unknown) {
  const time = new Date().toISOString();
  const line = `[${time}] ${level} ${message}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

export const logger = {
  info: (msg: string, extra?: unknown) => stamp('INFO ', msg, extra),
  warn: (msg: string, extra?: unknown) => stamp('WARN ', msg, extra),
  error: (msg: string, extra?: unknown) => stamp('ERROR', msg, extra),
};

/** Logs one line per request when it finishes. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
}
