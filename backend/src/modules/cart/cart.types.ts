/**
 * Shared cart types. The app sends a list of items (product + chosen modifier
 * options + quantity). The backend looks up real prices from the database and
 * calculates the totals itself — it never trusts prices sent by the client.
 */
export interface CartItemInput {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
  notes?: string;
}

export type OrderType = 'PICKUP' | 'DELIVERY' | 'DINE_IN';

export const ORDER_TYPES: OrderType[] = ['PICKUP', 'DELIVERY', 'DINE_IN'];

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'EN_ROUTE'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'EN_ROUTE',
  'COMPLETED',
  'CANCELLED',
];
