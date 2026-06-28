/**
 * Backend API client (frontend-safe). The app talks ONLY to our own backend at
 * `API_BASE_URL` — never to Foodics, never with a Foodics token. The backend is
 * the source of truth (customers, loyalty counters, gift cards, order mirror)
 * and the only thing that holds Foodics credentials.
 *
 * Everything here is a typed INTERFACE to that future backend. Until it exists,
 * `request` throws — the app keeps running on mock data (src/data, src/store).
 * Put NO secrets here (EXPO_PUBLIC_* values get bundled into the app).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/**
 * Feature flag. While `false` (the default), the whole app uses mock data and
 * never calls the backend. Flip `EXPO_PUBLIC_USE_BACKEND=true` (with a reachable
 * API_BASE_URL) in a LATER phase to start using the real backend.
 */
export const USE_BACKEND =
  process.env.EXPO_PUBLIC_USE_BACKEND === 'true' && API_BASE_URL.length > 0;

/** Whether a real backend is configured (URL present). */
export const isBackendConfigured = () => API_BASE_URL.length > 0;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
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
 *
 * NOTE: while the app is in mock mode (USE_BACKEND=false) the stores read from
 * src/data and NEVER call this, so implementing real fetch here is safe and just
 * makes the service files ready for the wiring phase. If a service is called
 * without a configured backend, we throw a clear error instead of hanging.
 */
export async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!isBackendConfigured()) {
    throw new ApiError(0, 'No backend configured (EXPO_PUBLIC_API_BASE_URL is empty).');
  }

  const url = `${API_BASE_URL}${path}${buildQuery(options.query)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (networkError) {
    throw new ApiError(0, 'تعذّر الاتصال بالخادم', networkError);
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
