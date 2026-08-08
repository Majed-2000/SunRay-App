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
import { request, USE_BACKEND, ApiError } from '@/services/api';
import { mapOrder, APP_TYPE_TO_BACKEND, type OrderDTO, type BackendOrderStatus } from '@/services/dto';
import { fetchMyOrders, type MyOrder } from '@/services/storeOrders';

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
  loadOrders: () => Promise<void>;
  fetchOrder: (id: string) => Promise<Order | undefined>;
  advanceBackend: (id: string) => Promise<void>;
}

// Belt-and-braces guard so a double-tap (or remount) can't submit twice even if
// a screen's local guard is bypassed. Module-scoped: one in-flight submit at a time.
let submitInFlight = false;

/**
 * How long an unpaid order stays payable. Mirrors ORDER_EXPIRY_MS in
 * functions/store_payments.js — if the two drift, the app and the branch
 * disagree about which orders are still open.
 */
const UNPAID_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * The store's status vocabulary → the app's numeric one.
 *
 * The app's tracking UI was built around Foodics' numeric codes, and the store
 * speaks strings. Rather than rewrite every screen, the strings are mapped onto
 * the two numbers the UI already understands.
 *
 * `fulfillment` wins over `status` when present: `status` describes the money
 * (paid, refunded) while `fulfillment` describes the coffee (ready, delivered),
 * and a customer looking at "طلباتي" is asking about the coffee.
 */
function mapStatus(o: MyOrder): { status: OrderStatus; deliveryStatus: DeliveryStatus | null } {
  // Named constants, not literals. Writing the numbers by hand put 3 against
  // "ready" — 3 is Declined — so every order waiting at the counter would have
  // rendered as rejected. And "ready" is not a status of its own here: it is
  // Active plus a delivery status, exactly as PICKUP_FLOW above defines it.
  const READY = {
    status: FoodicsOrderStatus.Active,
    deliveryStatus: FoodicsDeliveryStatus.Ready,
  };
  const f = o.fulfillment ?? '';
  if (f === 'delivered' || f === 'picked_up')
    return { status: FoodicsOrderStatus.Closed, deliveryStatus: null };
  if (f === 'cancelled') return { status: FoodicsOrderStatus.Void, deliveryStatus: null };
  if (f === 'ready') return READY;
  if (f === 'preparing') return { status: FoodicsOrderStatus.Active, deliveryStatus: null };

  switch (o.status) {
    case 'paid':
      return { status: FoodicsOrderStatus.Active, deliveryStatus: null };
    case 'cancelled':
      return { status: FoodicsOrderStatus.Void, deliveryStatus: null };
    case 'refunded':
      return { status: FoodicsOrderStatus.Returned, deliveryStatus: null };
    case 'awaiting_payment':
      /**
       * An order that was never paid is only "active" while it can still be
       * paid. The server draws that line at 24 hours (`ORDER_EXPIRY_MS`) and
       * sweeps them; the app has to draw it in the same place or it disagrees
       * with the business about what is outstanding.
       *
       * Treating every unpaid order as pending is what put **48** in the orders
       * badge, the oldest 23 days old and all of them abandoned — a number that
       * tells the customer they have a pile of live orders when they have none.
       */
      return Date.now() - (o.createdAt || 0) > UNPAID_EXPIRY_MS
        ? { status: FoodicsOrderStatus.Void, deliveryStatus: null }
        : { status: FoodicsOrderStatus.Pending, deliveryStatus: null };
    default:
      return { status: FoodicsOrderStatus.Pending, deliveryStatus: null };
  }
}

/**
 * Map a feed row onto the app's `Order`.
 *
 * Money arrives in halalas and every screen formats riyals, so it is converted
 * once, here. Fields the feed genuinely does not carry (VAT breakdown, payment
 * method, points) are left at zero rather than guessed — a fabricated VAT line
 * on a real receipt is worse than no line.
 */
function mapStoreOrder(o: MyOrder): Order {
  const { status, deliveryStatus } = mapStatus(o);
  const total = (o.totalHalalas || 0) / 100;
  return {
    id: o.id,
    foodicsOrderId: null,
    createdAt: o.createdAt || Date.now(),
    type: 'pickup',
    status,
    deliveryStatus,
    branchId: '',
    items: (o.items ?? []).map((i) => ({
      nameAr: i.name,
      optionLabel: '',
      qty: i.qty || 1,
      lineTotal: 0,
    })),
    subtotal: total,
    vat: 0,
    deliveryFee: 0,
    discount: 0,
    total,
    paymentMethod: 'card',
    pointsEarned: 0,
    etaMinutes: 0,
  };
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
  loadOrders: async () => {
    if (!USE_BACKEND) {
      set({ orders: mockOrders, status: 'ready', error: null });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      /**
       * One feed from the store, scoped to the signed-in customer's phone.
       *
       * This replaces two separate calls — our own `/api/orders` and the
       * Foodics history fetch — that between them showed the same customer two
       * partial histories. The store already merges cart orders, catering,
       * sessions and gift cards into one list, newest first.
       */
      const { phone, orders } = await fetchMyOrders();
      if (phone === null) {
        // NOT an empty list. The server could not tie this account to a number,
        // and rendering that as "no orders yet" is what hid the same fault for a
        // month upstream: the customer sees a plausible screen and nobody looks.
        set({ status: 'error', error: 'تعذّر التعرّف على رقمك' });
        return;
      }
      set({ orders: orders.map(mapStoreOrder), status: 'ready', error: null });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر تحميل الطلبات' });
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
