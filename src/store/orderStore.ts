import { create } from 'zustand';
import {
  FoodicsOrderStatus,
  FoodicsDeliveryStatus,
  type CartLine,
  type Order,
  type OrderType,
  type OrderStatus,
  type DeliveryStatus,
  type OrderStage,
} from '@/types';
import { cancelOrder, fetchMyOrders, type CreateOrderResult, type MyOrder } from '@/services/storeOrders';
import { CONFIG } from '@/constants/config';
import { auth } from '@/services/firebase';
import { useAuthStore } from './authStore';
import { clearInflight, loadInflight, saveInflight } from '@/services/inflightCheckout';

/** The VAT already inside a tax-inclusive total — extracted, never added. See utils/money.ts. */
function inclusiveVat(total: number): number {
  return Math.round((total - total / (1 + CONFIG.VAT_RATE)) * 100) / 100;
}

/**
 * A progression step = the Foodics (status, deliveryStatus) snapshot for a given
 * customer-facing stage, mirroring the
 * Pending → Active → Ready → Closed lifecycle that `mapStatus` derives from the
 * store's status and fulfilment strings.
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

/**
 * Arabic name for a feed row that is not a store order, or null for one that
 * is. These used to be rendered as coffee orders — a catering booking with
 * preparation steps and a «إعادة الطلب» button.
 */
export function orderKindLabel(kind: string | undefined): string | null {
  switch (kind ?? 'cart') {
    case 'cart':
      return null;
    case 'catering':
      return 'طلب تموين';
    case 'session':
      return 'حجز جلسة';
    case 'ticket':
      return 'تذكرة دعم';
    case 'gift':
      return 'بطاقة إهداء';
    default:
      return 'طلب';
  }
}

/**
 * Order reference for display: the store's own counter code when it issued
 * one — the code the barista calls out — else a short form of the id.
 */
export function orderRef(order: Pick<Order, 'id' | 'code'>): string {
  if (order.code) return order.code;
  const { id } = order;
  return id.startsWith('SR-') ? id : `SR-${id.slice(-5).toUpperCase()}`;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface OrderState {
  orders: Order[];
  status: Status;
  error: string | null;
  getById: (id: string) => Order | undefined;
  // live
  loadOrders: () => Promise<void>;
  fetchOrder: (id: string) => Promise<Order | undefined>;
  /** The server confirmed settlement — stop showing the order as unpaid before the feed catches up. */
  markPaid: (id: string) => void;
  /** Cancel an unpaid order. Resolves false when the server refused. */
  cancel: (id: string) => Promise<boolean>;
  /**
   * Put an order the server just created into the list, so the success and
   * detail screens can show it before the feed catches up.
   */
  recordPlaced: (result: CreateOrderResult, input: { type: OrderType; branchId: string; lines: CartLine[] }) => Order;
  /**
   * Orders this customer has reported «وصلت» for, this session. The arrival is
   * an event on the server and the feed does not echo it back, so without this
   * a reopened order showed the button again and the customer could not tell
   * whether the branch had been told.
   */
  arrived: Record<string, true>;
  markArrived: (id: string) => void;
  /**
   * The order checkout created and is still collecting a card for. Kept here,
   * not in the screen, so leaving checkout and coming back with the same cart
   * resumes paying for it instead of creating a second order.
   */
  checkout: InFlightCheckout | null;
  setCheckout: (checkout: InFlightCheckout | null) => void;
  /** Forget everything — the signed-in customer changed. */
  reset: () => void;
}

export interface InFlightCheckout {
  order: CreateOrderResult;
  /** Signature of the cart it was created from; a changed cart is a new order. */
  cartKey: string;
  at: number;
  /** Customer it was created for; stamped by `setCheckout`. */
  uid?: string | null;
}

/** How long a just-placed order is kept while the feed has not listed it. */
const RECENT_PLACED_MS = 10 * 60 * 1000;

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

  /**
   * Concluded, per `isConcludedNorm` in the store's own account page — copied,
   * not invented, so the app and the website never disagree about whether a
   * customer still has something coming.
   *
   * ⚠️ `ready` is deliberately NOT concluded. A ready order has not been
   * collected yet; the store notes (2026-08-06) that treating it as finished
   * asks the customer to rate an experience that has not happened. An earlier
   * version here also had the vocabulary wrong — `picked_up` instead of
   * `picked`, and no `done` at all.
   */
  if (f === 'done' || f === 'delivered' || f === 'picked')
    return { status: FoodicsOrderStatus.Closed, deliveryStatus: null };

  /**
   * Auto-closed: the branch never closed it and the sweeper gave up waiting.
   * It leaves the status at `ready` on purpose — auto-close means "we stopped
   * waiting", never "we delivered" — but it does take the order out of the
   * active list, and so must this.
   */
  if (o.autoClosed) return { status: FoodicsOrderStatus.Closed, deliveryStatus: null };

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
    // The server writes `expired` itself once an unpaid order passes
    // ORDER_EXPIRY_MS, so the app reads that rather than re-deriving it from a
    // timestamp — one clock, not two.
    case 'expired':
      return { status: FoodicsOrderStatus.Void, deliveryStatus: null };
    // Under review is normally a charge the server wants a human to look at.
    // Falling through to Pending showed it as unpaid, with a cancel prompt
    // promising «لن يُخصم منك شيء» to someone who may well have been charged.
    case 'review':
      return { status: FoodicsOrderStatus.Active, deliveryStatus: null };
    default:
      return { status: FoodicsOrderStatus.Pending, deliveryStatus: null };
  }
}

/**
 * Map a feed row onto the app's `Order`.
 *
 * Money arrives in halalas and every screen formats riyals, so it is converted
 * once, here. Fields the feed genuinely does not carry (payment method, points,
 * per-line prices) are left at zero and flagged so screens hide them rather
 * than print a guess. VAT is the exception: prices are tax-inclusive, so the
 * tax inside the total is arithmetic, not a guess.
 */
function mapStoreOrder(o: MyOrder): Order {
  const { status, deliveryStatus } = mapStatus(o);
  const total = (o.totalHalalas || 0) / 100;
  // A pay link past its expiry is worse than none: it opens onto an error.
  const payUrl = o.payLink && o.payLink.expiresAt > Date.now() ? o.payLink.url : null;
  return {
    id: o.id,
    code: o.code,
    payUrl,
    paymentKnown: false,
    feedType: o.type || 'cart',
    refund: o.refund
      ? { amount: (o.refund.amountHalalas || 0) / 100, at: o.refund.at, cancelled: o.refund.cancelled }
      : null,
    foodicsOrderId: null,
    createdAt: o.createdAt || Date.now(),
    type: o.mode === 'car' ? 'car' : 'pickup',
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
    vat: inclusiveVat(total),
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

const EMPTY = {
  // Empty until the first read of the customer's feed.
  orders: [] as Order[],
  status: 'loading' as Status,
  error: null as string | null,
  arrived: {} as Record<string, true>,
  checkout: null as InFlightCheckout | null,
};

export const useOrderStore = create<OrderState>((set, get) => ({
  ...EMPTY,

  reset: () => set({ ...EMPTY, arrived: {} }),

  markArrived: (id) => set((s) => ({ arrived: { ...s.arrived, [id]: true } })),

  // Mirrored to device storage: memory alone lost the order when the app was
  // closed mid-payment, and the saved cart then created a second one.
  setCheckout: (checkout) => {
    const stamped = checkout ? { ...checkout, uid: auth().currentUser?.uid ?? null } : null;
    if (stamped) void saveInflight(stamped);
    else void clearInflight();
    set({ checkout: stamped });
  },

  getById: (id) => get().orders.find((o) => o.id === id),

  loadOrders: async () => {
    set({ status: 'loading', error: null });
    // A response for a customer who has since signed out must not land in the
    // next customer's list.
    const uid = auth().currentUser?.uid ?? null;
    const stale = () => (auth().currentUser?.uid ?? null) !== uid;
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
      if (stale()) return;
      if (phone === null) {
        // NOT an empty list. The server could not tie this account to a number,
        // and rendering that as "no orders yet" is what hid the same fault for a
        // month upstream: the customer sees a plausible screen and nobody looks.
        set({ status: 'error', error: 'تعذّر التعرّف على رقمك' });
        return;
      }
      const before = get().orders;
      const fromFeed = orders.map((row) => {
        const mapped = mapStoreOrder(row);
        // The feed carries no branch, and may not carry the mode. What checkout
        // recorded is right; losing it turned a curbside order into a pickup
        // and hid the «وصلت» button the moment the feed listed the order.
        const local = before.find((o) => o.id === row.id);
        if (!local) return mapped;
        return {
          ...mapped,
          type: row.mode ? mapped.type : local.type,
          branchId: mapped.branchId || local.branchId,
        };
      });
      // Keep an order placed moments ago that the feed does not list yet —
      // otherwise the success screen's order vanishes on the first refresh.
      const seen = new Set(fromFeed.map((o) => o.id));
      const recent = before.filter(
        (o) => !seen.has(o.id) && Date.now() - o.createdAt < RECENT_PLACED_MS,
      );
      set({ orders: [...recent, ...fromFeed], status: 'ready', error: null });
    } catch (e) {
      if (stale()) return;
      set({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر تحميل الطلبات' });
    }
  },

  /**
   * Refresh one order from the store.
   *
   * There is no single-order callable, so this re-reads the customer's feed.
   * It used to ask the retired Express server for `/api/orders/:id` with a
   * Firebase id — a request that could never succeed, and whose failure was
   * swallowed, so the order on screen simply never updated.
   */
  fetchOrder: async (id) => {
    await get().loadOrders();
    return get().getById(id);
  },

  markPaid: (id) =>
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === id ? { ...o, status: FoodicsOrderStatus.Active, deliveryStatus: null, payUrl: null } : o,
      ),
    })),

  cancel: async (id) => {
    const ok = await cancelOrder(id);
    // Re-read either way: on failure the order may have been paid meanwhile,
    // which is exactly why the server refused.
    await get().loadOrders();
    return ok;
  },

  recordPlaced: (result, input) => {
    const total = result.totalHalalas / 100;
    const order: Order = {
      id: result.orderId,
      code: result.code || null,
      payUrl: result.payUrl ?? null,
      foodicsOrderId: null,
      createdAt: Date.now(),
      type: input.type,
      status: FoodicsOrderStatus.Pending,
      deliveryStatus: null,
      branchId: input.branchId,
      items: input.lines.map((l) => ({
        nameAr: l.nameAr,
        optionLabel: l.optionLabel,
        qty: l.qty,
        lineTotal: l.unitPrice * l.qty,
      })),
      subtotal: total,
      vat: inclusiveVat(total),
      paymentKnown: false,
      deliveryFee: 0,
      discount: 0,
      total,
      paymentMethod: 'card',
      // Unknown until the order settles; the server awards points then.
      pointsEarned: 0,
      etaMinutes: 0,
    };
    set((s) => ({ orders: upsert(s.orders, order) }));
    return order;
  },
}));

/**
 * Follow the signed-in customer.
 *
 * Nothing else clears this store, so after one customer signed out and another
 * signed in, the badge, the list and any order placed in the last ten minutes
 * were the previous customer's. And nothing loaded the feed at launch, so the
 * active-orders badge read zero until the Orders tab was opened.
 */
useAuthStore.subscribe((s, prev) => {
  if (s.user?.id === prev.user?.id && s.isGuest === prev.isGuest) return;
  useOrderStore.getState().reset();
  if (s.user && !s.isGuest) {
    void useOrderStore.getState().loadOrders();
    // `reset` just dropped the in-memory copy, and at launch the session is
    // restored after the store is created. The device copy is only taken back
    // for the customer it was made for.
    void restoreInflight();
  }
});

/** Put the order checkout was paying for back, from device storage. */
async function restoreInflight(): Promise<void> {
  const rec = await loadInflight();
  if (!rec || useOrderStore.getState().checkout) return;
  const uid = auth().currentUser?.uid ?? null;
  if (rec.uid && uid && rec.uid !== uid) return;
  useOrderStore.setState({ checkout: rec });
}
void restoreInflight();
