/** The server's gap between OTP sends (`storeAuth.ts`), used when it echoes none. */
export const DEFAULT_OTP_COOLDOWN_SEC = 60;
/** How long a sent code stays valid on the server. */
export const DEFAULT_OTP_EXPIRES_SEC = 300;

/** Whole seconds left until `endsAt` (ms epoch); never negative. */
export function cooldownRemaining(endsAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Server-echoed seconds when it is a sane positive number, else the default. */
export function pickCooldownSec(fromServer: unknown): number {
  const n = Number(fromServer);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : DEFAULT_OTP_COOLDOWN_SEC;
}

/**
 * True when a refused send should land the customer on the OTP step instead of
 * showing an error: the server said `cooldown` for the very phone it already
 * sent a code to, and that code has not expired, so it is still good.
 */
export function canResumeOtp(
  prev: { phone: string; at: number } | null,
  phone: string,
  reason: string | undefined,
  now: number = Date.now(),
  expiresSec: number = DEFAULT_OTP_EXPIRES_SEC,
): boolean {
  return reason === 'cooldown' && !!prev && prev.phone === phone && now - prev.at < expiresSec * 1000;
}
