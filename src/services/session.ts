/**
 * Session/token holder for backend mode.
 *
 * - The ACCESS token lives only in memory (short-lived; re-minted via refresh).
 * - The REFRESH token is stored in the device keychain via expo-SecureStore
 *   (NOT AsyncStorage — it's a long-lived secret).
 *
 * This module is a LEAF: it imports only expo-secure-store and reads the API base
 * URL straight from env. It must NOT import `api.ts` or any store, so there is no
 * require cycle (api.ts imports THIS, not the other way around). Its own refresh
 * call uses a bare `fetch` (not the api client) to avoid recursive refresh.
 */
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const REFRESH_KEY = 'sunray.refreshToken';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let onExpired: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function loadRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}
export async function saveRefreshToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } catch {
    // Keychain write failures are non-fatal; the in-memory access token still works
    // for this session, the user just won't survive a cold restart.
  }
}
export async function clearRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // ignore
  }
}

/** Wire the "session is dead" callback (authStore provides clear-state + navigate). */
export function registerSessionHandlers(handlers: { onExpired: () => void }): void {
  onExpired = handlers.onExpired;
}

/**
 * Refresh the access token using the stored refresh token. SINGLE-FLIGHT: many
 * concurrent 401s share one refresh attempt. Returns true on success. On an HTTP
 * failure (refresh token invalid/expired) it clears the stored token; on a network
 * error it leaves it in place (could be transient).
 */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: true; data: { accessToken: string; refreshToken: string } }
      | { ok: false }
      | null;
    if (!res.ok || !json || json.ok === false) {
      // The refresh token itself is no longer valid → session is over.
      await clearRefreshToken();
      accessToken = null;
      return false;
    }
    accessToken = json.data.accessToken;
    await saveRefreshToken(json.data.refreshToken); // rotation
    return true;
  } catch {
    // Network error — keep the refresh token; the caller will surface a network error.
    return false;
  }
}

/** Called by the API client when a protected request can't be refreshed. */
export function handleSessionExpired(): void {
  accessToken = null;
  onExpired?.();
}

/** Clear everything (used by logout). */
export async function clearSession(): Promise<void> {
  accessToken = null;
  await clearRefreshToken();
}
