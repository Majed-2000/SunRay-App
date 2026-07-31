/**
 * Foodics API v5 client.
 *
 * Every rule below was proven against the live Sun Ray business (reference
 * 850056) — several of them contradict or extend the official docs. Do not
 * "simplify" them back to what apidocs.foodics.com says.
 */
import { env } from '../../config/env';
import { logger } from '../../common/logger';

/** Foodics wraps single items in `data`, lists in `data` + `meta`. */
export interface FoodicsList<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface FoodicsQuery {
  filter?: Record<string, string | number | boolean>;
  include?: string[];
  sort?: string;
  page?: number;
  /** Hard-capped at 50 by the API for EVERY resource. */
  per_page?: number;
}

export class FoodicsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'FoodicsError';
  }
}

/** Laravel-style query string: ?filter[k]=v&include=a,b&sort=-created_at */
function buildQuery(q: FoodicsQuery = {}): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q.filter ?? {})) {
    parts.push(`filter[${encodeURIComponent(k)}]=${encodeURIComponent(String(v))}`);
  }
  if (q.include?.length) parts.push(`include=${q.include.map(encodeURIComponent).join(',')}`);
  if (q.sort) parts.push(`sort=${encodeURIComponent(q.sort)}`);
  if (q.page) parts.push(`page=${q.page}`);
  if (q.per_page) parts.push(`per_page=${Math.min(q.per_page, 50)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FoodicsClient {
  constructor(
    private readonly token = env.FOODICS_TOKEN,
    private readonly baseUrl = env.FOODICS_BASE_URL,
  ) {}

  get configured(): boolean {
    return Boolean(this.token);
  }

  async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    if (!this.token) throw new FoodicsError('FOODICS_TOKEN is not configured', 500);

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        // `Bearer` is CASE-SENSITIVE — lowercase `bearer` returns an auth error.
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    // Rate limiting is real and it bit us in production: a bulk /orders scan
    // exhausted the quota and delayed a live customer order by 13s. Respect
    // Retry-After, and never run a heavy scan while serving traffic.
    if (res.status === 429 && attempt < 4) {
      const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 2 ** attempt * 1000;
      logger.warn(`Foodics 429 on ${path} — retrying in ${wait}ms (attempt ${attempt + 1})`);
      await sleep(wait);
      return this.request<T>(path, init, attempt + 1);
    }

    const text = await res.text();
    const body = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const msg = (body as { message?: string })?.message ?? res.statusText;
      throw new FoodicsError(`Foodics ${res.status} on ${path}: ${msg}`, res.status, body);
    }
    return body as T;
  }

  get<T>(path: string, query?: FoodicsQuery): Promise<T> {
    return this.request<T>(`${path}${buildQuery(query)}`);
  }

  post<T>(path: string, payload: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
  }

  /**
   * Auto-paginate a resource. per_page is capped at 50 by the API.
   *
   * ⚠️ NOT usable for /orders — that endpoint silently stops after 10 pages
   * (500 orders). Use listOrdersAfter() instead.
   */
  async listAll<T>(path: string, query: FoodicsQuery = {}): Promise<T[]> {
    const out: T[] = [];
    let page = 1;
    for (;;) {
      const res = await this.get<FoodicsList<T>>(path, { ...query, page, per_page: 50 });
      out.push(...(res.data ?? []));
      const last = res.meta?.last_page ?? 1;
      if (page >= last) break;
      page += 1;
    }
    return out;
  }

  /**
   * Orders use reference-cursor pagination, NOT page numbers. Pass 0 to start.
   * Returns up to 50 orders after the given reference.
   */
  listOrdersAfter<T>(referenceAfter: number, include: string[] = []): Promise<FoodicsList<T>> {
    return this.get<FoodicsList<T>>('/orders', {
      sort: 'reference',
      filter: { reference_after: referenceAfter },
      // `include=products` alone omits product_id entirely, making it impossible
      // to attribute a sale to a product. `products.product` is required.
      include: include.length ? include : ['products.product'],
      per_page: 50,
    });
  }

  /** Identity + granted scopes. The cheapest way to validate a token. */
  whoami<T>(): Promise<{ data: T }> {
    return this.get<{ data: T }>('/whoami');
  }
}

export const foodics = new FoodicsClient();
