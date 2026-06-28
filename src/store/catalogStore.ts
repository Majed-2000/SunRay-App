import { create } from 'zustand';
import type { Category, Product } from '@/types';
import { categories as mockCategories, products as mockProducts } from '@/data';
import { request, USE_BACKEND } from '@/services/api';
import { mapMenu, mapProduct, type MenuDTO, type ProductDTO } from '@/services/dto';

/**
 * Catalog = the menu (categories + products). It loads from MOCK data when
 * USE_BACKEND is false (instant, the default), or from the backend `/api/menu`
 * when USE_BACKEND is true. Screens read from this store instead of importing
 * the mock arrays directly, so connecting the backend didn't change the UI.
 */
type Status = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  categories: Category[];
  products: Product[];
  status: Status;
  error: string | null;
  load: () => Promise<void>;
  fetchProduct: (id: string) => Promise<Product | null>;
  productById: (id: string) => Product | undefined;
  featured: () => Product[];
  byCategory: (categoryId: string) => Product[];
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  // In mock mode we start ready with mock data (no loading flash). In backend
  // mode we start empty + loading and fetch on app start.
  categories: USE_BACKEND ? [] : mockCategories,
  products: USE_BACKEND ? [] : mockProducts,
  status: USE_BACKEND ? 'loading' : 'ready',
  error: null,

  load: async () => {
    if (!USE_BACKEND) {
      set({ categories: mockCategories, products: mockProducts, status: 'ready', error: null });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const dto = await request<MenuDTO>('/api/menu');
      const { categories, products } = mapMenu(dto);
      set({ categories, products, status: 'ready', error: null });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر تحميل القائمة' });
    }
  },

  fetchProduct: async (id) => {
    const local = get().productById(id);
    if (local) return local;
    if (!USE_BACKEND) return null;
    try {
      const dto = await request<ProductDTO>(`/api/products/${id}`);
      const emoji = get().categories.find((c) => c.id === dto.categoryId)?.emoji ?? '☕';
      return mapProduct(dto, emoji);
    } catch {
      return null;
    }
  },

  productById: (id) => get().products.find((p) => p.id === id),
  featured: () => get().products.filter((p) => p.isFeatured),
  byCategory: (categoryId) => get().products.filter((p) => p.categoryId === categoryId),
}));
