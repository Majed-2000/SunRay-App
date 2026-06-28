/**
 * Menu service interface. The backend syncs the menu from Foodics
 * (categories, products, modifiers, branches, taxes) and exposes already-mapped
 * app types here. The app never calls Foodics directly.
 *
 * Today the app reads mock data from `src/data`. Swapping to live data = make
 * these resolve from the backend instead of the mock arrays.
 */
import { request } from './api';
import type { Branch, Category, Product } from '@/types';

export interface MenuResponse {
  categories: Category[];
  products: Product[];
}

/** GET /api/menu — full menu (categories + products with modifiers). */
export async function getMenu(): Promise<MenuResponse> {
  return request<MenuResponse>('/api/menu');
}

/** GET /api/products/:id — a single product with its modifiers. */
export async function getProduct(id: string): Promise<Product> {
  return request<Product>(`/api/products/${id}`);
}

/** GET /api/branches — branches with opening hours, lat/long, capabilities. */
export async function getBranches(): Promise<Branch[]> {
  return request<Branch[]>('/api/branches');
}
