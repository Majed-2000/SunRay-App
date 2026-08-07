import type { OrderType } from '@/types';
import { STORE_HAS_DELIVERY } from './features';

/**
 * The fulfilment options to offer, in one place.
 *
 * Three screens used to hardcode their own list, and all three offered delivery
 * and dine-in — services the store does not provide. Keeping the list here means
 * turning `STORE_HAS_DELIVERY` on or off changes every surface at once, instead
 * of leaving one screen quietly still selling delivery.
 *
 * `pickup` and `car` are what `createStoreOrder` accepts. Curbside is not a
 * lesser variant of pickup: the customer stays in the car and the branch walks
 * the order out to a plate number, which is why it needs the plate and the
 * arrival button that plain pickup does not.
 */
export const ORDER_TYPES: readonly OrderType[] = STORE_HAS_DELIVERY
  ? (['pickup', 'car', 'delivery', 'dineIn'] as const)
  : (['pickup', 'car'] as const);

/** Short labels for tight controls (tabs, chips). */
export const ORDER_TYPE_SHORT: Record<OrderType, string> = {
  pickup: '☕ استلام',
  car: '🚗 سيارتي',
  delivery: '🛵 توصيل',
  dineIn: '🍽️ داخلي',
};

/** True for the modes that need a plate and an "I've arrived" button. */
export function isCurbside(type: OrderType): boolean {
  return type === 'car';
}
