/**
 * Backend API client (frontend-safe). The app talks ONLY to our own backend at
 * `API_BASE_URL` — never to Foodics, never with a Foodics token. The backend is
 * the source of truth and the only thing that holds Foodics credentials.
 *
 * This client:
 *  - auto-attaches the access token (from session.ts) on every request,
 *  - on a 401, transparently refreshes the token ONCE and retries the request,
 *  - if the refresh fails, ends the session gracefully (→ login) and rejects,
 *  - aborts requests that take longer than REQUEST_TIMEOUT_MS.
 *
 * Put NO secrets here (EXPO_PUBLIC_* values get bundled into the app).
 */
import {
  getAccessToken,
  refreshAccessToken,
  handleSessionExpired,
} from './session';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/**
 * Feature flag. While `false`, the whole app uses mock data and never calls the
 * backend. Flip `EXPO_PUBLIC_USE_BACKEND=true` (with a reachable API_BASE_URL).
 */
export const USE_BACKEND =
  process.env.EXPO_PUBLIC_USE_BACKEND === 'true' && API_BASE_URL.length > 0;

/** Whether a real backend is configured (URL present). */
export const isBackendConfigured = () => API_BASE_URL.length > 0;

/** Abort a request that hangs this long (ms). */
const REQUEST_TIMEOUT_MS = 15_000;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Explicit token override (rarely needed; the access token is attached automatically). */
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Skip the auto-attach + 401-refresh logic (used for the auth endpoints themselves). */
  skipAuth?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildQuery(query?: ApiOptions['query']): string {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Perform a request against OUR backend and return the `data` field of the
 * standard envelope `{ ok, data }` (errors are `{ ok:false, error }`).
 */
export async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!isBackendConfigured()) {
    throw new ApiError(0, 'No backend configured (EXPO_PUBLIC_API_BASE_URL is empty).');
  }
  return doRequest<T>(path, options, false);
}

async function doRequest<T>(path: string, options: ApiOptions, isRetry: boolean): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(options.query)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const token = options.token ?? (options.skipAuth ? undefined : getAccessToken());
  if (token) headers.Authorization = `Bearer ${token}`;

  // Timeout via AbortController; also forward any caller-provided signal.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onExternalAbort);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (networkError) {
    // Distinguish our timeout from a caller-initiated abort vs a real network drop.
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new ApiError(0, 'انتهت مهلة الاتصال، تأكد من الإنترنت وحاول مجددًا', networkError);
    }
    throw new ApiError(0, 'تعذّر الاتصال بالخادم', networkError);
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }

  // Access token expired → refresh once, then retry the original request.
  if (res.status === 401 && !isRetry && !options.skipAuth && USE_BACKEND) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return doRequest<T>(path, options, true);
    handleSessionExpired();
    throw new ApiError(401, 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى');
  }

  // Parse the JSON envelope (tolerate empty/non-JSON bodies).
  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; details?: unknown } }
    | null;

  if (!res.ok || !json || json.ok === false) {
    const err = json && json.ok === false ? json.error : undefined;
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return json.data;
}
