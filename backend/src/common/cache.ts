/**
 * Tiny in-memory TTL cache for hot, NON-sensitive reads (menu, branches, product
 * detail). Bounded in size and swept periodically so it can never grow without
 * limit.
 *
 * NEVER cache customer-scoped data here (orders, wallet, loyalty, gift cards,
 * notifications, profile) — entries are global and not keyed by user, so caching
 * per-user data would leak it across customers.
 *
 * PRODUCTION NOTE: a single-process Map is fine for one instance. For multiple
 * instances use a shared cache (e.g. Redis) so invalidation is global.
 */
const MAX_ENTRIES = 200;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  // Evict the oldest entry when full (Map preserves insertion order).
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function deleteCached(key: string): void {
  store.delete(key);
}

/** Return the cached value or compute it, cache it, and return it. */
export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== undefined) return hit;
  const value = await compute();
  setCached(key, value, ttlMs);
  return value;
}

/** Drop all catalog entries (menu, branches, every product:*). Call after any
 * future catalog mutation so stale data isn't served. */
export function invalidateCatalog(): void {
  store.delete('menu');
  store.delete('branches');
  for (const key of store.keys()) {
    if (key.startsWith('product:')) store.delete(key);
  }
}

// Periodically remove expired entries. `unref()` so this timer never keeps the
// process alive on its own (matters for graceful shutdown and the test runner).
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, 60_000);
sweeper.unref?.();

/** Stop the sweeper and clear the cache (called on graceful shutdown). */
export function stopCache(): void {
  clearInterval(sweeper);
  store.clear();
}
