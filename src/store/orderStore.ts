import { create } from 'zustand';
import {
  FoodicsOrderStatus,
  FoodicsDeliveryStatus,
  type CartLine,
  type Order,
  type OrderItemSnapshot,
  type OrderType,
  type OrderStatus,
  type DeliveryStatus,
  type OrderStage,
  type PaymentMethod,
} from '@/types';
import { mockOrders } from '@/data';
import { request, USE_BACKEND } from '@/services/api';
import { mapOrder, APP_TYPE_TO_BACKEND, type OrderDTO, type BackendOrderStatus } from '@/services/dto';
import { toCartItem } from '@/services/orders';

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

/** Friendly order reference for display. Backend ids are long → show SR-XXXXX. */
export function orderRef(id: string): string {
  return id.startsWith('SR-') ? id : `SR-${id.slice(-5).toUpperCase()}`;
}

/** The next backend status for the dev "advance" action, based on the current stage. */
function nextBackendStatus(o: Order): BackendOrderStatus | null {
  switch (orderStage(o)) {
    case 'pending':
      return 'ACCEPTED';
    case 'preparing':
      return 'READY';
    case 'ready':
      return o.type === 'delivery' ? 'EN_ROUTE' : 'COMPLETED';
    case 'enRoute':
      return 'COMPLETED';
    default:
      return null; // completed / cancelled
  }
}

export interface SubmitToBackendInput {
  customerId?: string;
  branchId: string;
  type: OrderType;
  lines: CartLine[];
  customerNotes?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface OrderState {
  orders: Order[];
  status: Status;
  error: string | null;
  // mock (unchanged)
  place: (input: PlaceOrderInput) => Order;
  advance: (id: string) => void;
  getById: (id: string) => Order | undefined;
  // backend (used when USE_BACKEND)
  loadOrders: (customerId?: string) => Promise<void>;
  submitToBackend: (input: SubmitToBackendInput) => Promise<Order | null>;
  fetchOrder: (id: string) => Promise<Order | undefined>;
  advanceBackend: (id: string) => Promise<void>;
}

/** Replace an order in the list, or prepend it if new. */
function upsert(orders: Order[], order: Order): Order[] {
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx < 0) return [order, ...orders];
  const copy = [...orders];
  copy[idx] = order;
  return copy;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  // Mock mode starts with seeded orders; backend mode starts empty + loading.
  orders: USE_BACKEND ? [] : mockOrders,
  status: USE_BACKEND ? 'loading' : 'ready',
  error: null,

  /** Mock submit — starts the order at Pending and prepends it locally. */
  place: (input) => {
    const first = stepsFor(input.type)[0];
    const order: Order = {
      id: `SR-${Math.floor(1000 + Math.random() * 9000)}`,
      foodicsOrderId: null,
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

  // ── Backend actions (only used when USE_BACKEND) ──────────────────────────
  loadOrders: async (customerId) => {
    if (!USE_BACKEND) {
      set({ orders: mockOrders, status: 'ready', error: null });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const dtos = await request<OrderDTO[]>('/api/orders', {
        query: customerId ? { customerId } : undefined,
      });
      set({ orders: dtos.map(mapOrder), status: 'ready', error: null });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر تحميل الطلبات' });
    }
  },

  submitToBackend: async (input) => {
    try {
      const dto = await request<OrderDTO>('/api/orders', {
        method: 'POST',
        body: {
          customerId: input.customerId,
          branchId: input.branchId,
          type: APP_TYPE_TO_BACKEND[input.type],
          items: input.lines.map(toCartItem), // backend ignores the extra unitPrice
          customerNotes: input.customerNotes,
        },
      });
      const order = mapOrder(dto);
      set((s) => ({ orders: upsert(s.orders, order) }));
      return order;
    } catch {
      return null;
    }
  },

  fetchOrder: async (id) => {
    if (!USE_BACKEND) return get().getById(id);
    try {
      const dto = await request<OrderDTO>(`/api/orders/${id}`);
      const order = mapOrder(dto);
      set((s) => ({ orders: upsert(s.orders, order) }));
      return order;
    } catch {
      return get().getById(id);
    }
  },

  advanceBackend: async (id) => {
    const current = get().getById(id);
    if (!current) return;
    const next = nextBackendStatus(current);
    if (!next) return;
    try {
      const dto = await request<OrderDTO>(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: { status: next },
      });
      const order = mapOrder(dto);
      set((s) => ({ orders: upsert(s.orders, order) }));
    } catch {
      /* ignore — UI keeps the previous status */
    }
  },
}));
