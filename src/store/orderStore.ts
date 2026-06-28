import { create } from 'zustand';
import {
  FoodicsOrderStatus,
  FoodicsDeliveryStatus,
  type Order,
  type OrderItemSnapshot,
  type OrderType,
  type OrderStatus,
  type DeliveryStatus,
  type OrderStage,
  type PaymentMethod,
} from '@/types';
import { mockOrders } from '@/data';

/**
 * A progression step = the Foodics (status, deliveryStatus) snapshot for a given
 * customer-facing stage. The mock advances through these to emulate the real
 * Pending → Active → Ready / En Route → Closed lifecycle the backend would push
 * via `application.order.updated` webhooks.
 */
interface FlowStep {
  stage: OrderStage;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus | null;
}

const PICKUP_FLOW: FlowStep[] = [
  { stage: 'pending', status: FoodicsOrderStatus.Pending, deliveryStatus: null },
  { stage: 'preparing', status: FoodicsOrderStatus.Active, deliveryStatus: null },
  { stage: 'ready', status: FoodicsOrderStatus.Active, deliveryStatus: FoodicsDeliveryStatus.Ready },
  { stage: 'completed', status: FoodicsOrderStatus.Closed, deliveryStatus: null },
];

const DELIVERY_FLOW: FlowStep[] = [
  { stage: 'pending', status: FoodicsOrderStatus.Pending, deliveryStatus: null },
  { stage: 'preparing', status: FoodicsOrderStatus.Active, deliveryStatus: FoodicsDeliveryStatus.SentToKitchen },
  { stage: 'ready', status: FoodicsOrderStatus.Active, deliveryStatus: FoodicsDeliveryStatus.Ready },
  { stage: 'enRoute', status: FoodicsOrderStatus.Active, deliveryStatus: FoodicsDeliveryStatus.EnRoute },
  { stage: 'completed', status: FoodicsOrderStatus.Closed, deliveryStatus: FoodicsDeliveryStatus.Delivered },
];

function stepsFor(type: OrderType): FlowStep[] {
  return type === 'delivery' ? DELIVERY_FLOW : PICKUP_FLOW;
}

const sameStep = (a: FlowStep, o: Order) =>
  a.status === o.status && (a.deliveryStatus ?? null) === (o.deliveryStatus ?? null);

/** Ordered customer-facing stages for an order type (drives the tracking UI). */
export function flowStages(type: OrderType): OrderStage[] {
  return stepsFor(type).map((s) => s.stage);
}

/** Index of the order's current step within its flow (for the tracking stepper). */
export function currentStepIndex(o: Order): number {
  const idx = stepsFor(o.type).findIndex((s) => sameStep(s, o));
  return idx < 0 ? 0 : idx;
}

/** Customer-facing stage derived from the Foodics (status, deliveryStatus). */
export function orderStage(o: Order): OrderStage {
  if (
    o.status === FoodicsOrderStatus.Declined ||
    o.status === FoodicsOrderStatus.Returned ||
    o.status === FoodicsOrderStatus.Void
  ) {
    return 'cancelled';
  }
  const step = stepsFor(o.type).find((s) => sameStep(s, o));
  if (step) return step.stage;
  return o.status === FoodicsOrderStatus.Closed ? 'completed' : 'pending';
}

export function isActiveOrder(o: Order): boolean {
  const stage = orderStage(o);
  return stage !== 'completed' && stage !== 'cancelled';
}

export interface PlaceOrderInput {
  type: OrderType;
  branchId: string;
  addressId?: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  vat: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  pointsEarned: number;
  etaMinutes: number;
}

interface OrderState {
  orders: Order[];
  place: (input: PlaceOrderInput) => Order;
  advance: (id: string) => void;
  getById: (id: string) => Order | undefined;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: mockOrders,

  /**
   * Mock submit. The real flow POSTs a CheckoutPayload to our backend
   * (services/orders.ts → submitOrder), which injects the order into Foodics;
   * Foodics returns it as Pending (source=API). Here we just start at Pending.
   */
  place: (input) => {
    const first = stepsFor(input.type)[0];
    const order: Order = {
      id: `SR-${Math.floor(1000 + Math.random() * 9000)}`,
      foodicsOrderId: null, // assigned by the backend once injected into Foodics
      createdAt: Date.now(),
      status: first.status,
      deliveryStatus: first.deliveryStatus,
      ...input,
    };
    set((s) => ({ orders: [order, ...s.orders] }));
    return order;
  },

  advance: (id) =>
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== id) return o;
        const steps = stepsFor(o.type);
        const idx = steps.findIndex((step) => sameStep(step, o));
        if (idx < 0 || idx >= steps.length - 1) return o;
        const next = steps[idx + 1];
        return { ...o, status: next.status, deliveryStatus: next.deliveryStatus };
      }),
    })),

  getById: (id) => get().orders.find((o) => o.id === id),
}));
