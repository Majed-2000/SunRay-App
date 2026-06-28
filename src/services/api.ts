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

/** Whether a real backend is configured. While false, the app uses mock data. */
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
 * Perform a request against our backend. Not implemented yet — the app runs on
 * mock data. Implement fetch + auth headers + error handling when the backend
 * is ready.
 */
export async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(options.query)}`;
  // TODO(backend): implement with fetch(url, { method, headers, body, signal }).
  throw new ApiError(0, `Backend not wired yet: ${options.method ?? 'GET'} ${url}`);
}
