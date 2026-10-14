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
