/**
 * Gift packages («باقات الإهداء»), on the same backend as sunray.sa.
 *
 * This replaces a mock in which the phone invented a code with `Math.random()`
 * and told the customer «تم إرسال الهدية» while nothing was charged and nobody
 * was sent anything. Every step below is the call the website's gift pages
 * make (`store/js/gift-buy.js`, `store/js/gift.js`), with the same payloads,
 * so a gift bought in the app is the same record, the same code and the same
 * recipient page as one bought on the site.
 *
 * ## The flow
 *
 *     store/config/giftPackages   (public read; active && selfServe only)
 *     createSelfGift{packageId}               → { id }
 *     updateGiftCardDetails{id, card}         occasion, message, names, design
 *     createGiftCardPayment{giftId}           → { intentId, amountHalalas, code }
 *     Moyasar, metadata { gift_id, gift_intent }
 *     getGiftCard{id} until status = active   (the server settles, not us)
 *
 * The recipient never touches the app: they open the link on sunray.sa, pick
 * their cups and dessert there and claim it (`saveGiftSelections`,
 * `claimGiftCard`). That side is deliberately not rebuilt here.
 *
 * ## Money never originates here
 *
 * The price shown on a package is for display. The amount charged is
 * `amountHalalas` from `createGiftCardPayment`, priced on the server from the
 * package the gift was created with.
 */
import { onValue, ref, off, type DataSnapshot } from 'firebase/database';
import { toArabicDigits } from '@/utils/numerals';
import { callFn, db } from './firebase';

/** The website, which owns the recipient side of every gift. */
export const GIFT_SITE = 'https://sunray.sa';

/**
 * The link the buyer sends to the recipient.
 *
 * Built exactly as `gift.js` builds it: the gift page's own address plus
 * `?g=<id>`. `gift-buy` sends the buyer to `./gift.html?g=<id>` under
 * `/store/`, so that page's path is `/store/gift.html`. Once the gift is
 * active the same page shows the recipient their card, the package picker and
 * the claim buttons — the id is not a secret the way the code is, because the
 * page reveals nothing until the gift is paid.
 */
export function giftShareUrl(giftId: string): string {
  return `${GIFT_SITE}/store/gift.html?g=${encodeURIComponent(giftId)}`;
}

/** Text for the share sheet. The site's copy, minus its emoji. */
export function giftShareMessage(giftId: string): string {
  return `لك بطاقة إهداء من Sun Ray\n${giftShareUrl(giftId)}`;
}

// ── Packages ────────────────────────────────────────────────────────────────

/** One package the customer can buy themselves. */
export interface SelfGiftPackage {
  id: string;
  name: string;
  priceSar: number;
  /** Classic pour-over cups — the recipient picks the crop. */
  cups: number;
  /** Desserts — the recipient picks which. */
  desserts: number;
  order: number;
}

interface RawPackage {
  name?: string;
  priceSar?: number;
  cups?: number;
  desserts?: number;
  order?: number;
  active?: boolean;
  selfServe?: boolean;
}

/**
 * Keep what `gift-buy.js` keeps: `active !== false && selfServe === true`,
 * ordered by `order`.
 *
 * `selfServe` is strict on purpose. Packages without it are tailored ones the
 * team sells through support, and `createSelfGift` refuses them — listing one
 * would put a button on screen that can only fail.
 */
export function selfServePackages(raw: Record<string, RawPackage> | null | undefined): SelfGiftPackage[] {
  return Object.entries(raw ?? {})
    .filter(([, p]) => p && p.active !== false && p.selfServe === true)
    .map(([id, p]) => ({
      id,
      name: String(p.name ?? '').trim() || 'باقة إهداء',
      priceSar: Number(p.priceSar) || 0,
      cups: Number(p.cups) || 0,
      desserts: Number(p.desserts) || 0,
      order: Number(p.order) || 0,
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * «٢ كوب قهوة مقطّرة كلاسيكية + ١ حلى» — the site's wording for what a
 * package holds. Empty for a package with neither (a plain card).
 */
export function packageContents(p: { cups?: number; desserts?: number }): string {
  const bits: string[] = [];
  if (p.cups) bits.push(`${toArabicDigits(p.cups)} كوب قهوة مقطّرة كلاسيكية`);
  if (p.desserts) bits.push(`${toArabicDigits(p.desserts)} حلى`);
  return bits.join(' + ');
}

/**
 * Subscribe to the self-serve packages.
 *
 * Read here rather than from `storeSettingsStore`, which maps a `nameAr`
 * field the node does not have (the live rows carry `name`) and drops
 * `selfServe`, `cups` and `desserts` — the three things this screen is about.
 */
export function subscribeGiftPackages(
  cb: (packages: SelfGiftPackage[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const r = ref(db(), 'store/config/giftPackages');
  const handler = (snap: DataSnapshot) => cb(selfServePackages(snap.val()));
  onValue(r, handler, (e) => onError?.(e));
  return () => off(r, 'value', handler);
}

// ── Card details ────────────────────────────────────────────────────────────

/** The three faces the site offers. */
export type GiftDesignId = 'sunray' | 'graduation' | 'custom';

/**
 * Colours of the «على كيفك» face: the site's two swatch rows.
 *
 * `RM` is the pattern, `BG` the background. The defaults are the two colours
 * the source SVG is drawn in — the face is recoloured by swapping exactly
 * those strings, so they must stay byte-identical to the file.
 */
export const RM_DEFAULT = '#f9db5b';
export const BG_DEFAULT = '#fff3be';
export const RM_PALETTE = ['#f9db5b', '#ff6f61', '#ec6a9c', '#9b5de5', '#4d96ff', '#2ec4b6', '#57cc99', '#ff9f1c'] as const;
export const BG_PALETTE = ['#fff3be', '#ffe0e6', '#e0f5ec', '#e2f0ff', '#efe6ff', '#ffe9d6', '#fbf8cc', '#f0f0f3'] as const;

/** `#rrggbb`, lower-case, or the fallback — the server validates the same way. */
export function sanitizeHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : fallback;
}

/** What `updateGiftCardDetails` takes as `card`. Field for field the site's payload. */
export interface GiftCardDetails {
  occasion: string;
  message: string;
  senderName: string;
  receiverName: string;
  /**
   * Optional. When present the server texts the recipient the gift link once
   * payment settles (`smsSent` on the gift). Sent in the `05XXXXXXXX` form
   * the site's field asks for.
   */
  recipientPhone: string;
  /** Show the recipient what the package contains (never the price). */
  showDetails: boolean;
  design: GiftDesignId;
  /** Only for `custom`; null otherwise, as the site sends it. */
  rmColor: string | null;
  bgColor: string | null;
}

/** Field limits from the site's inputs (`maxlength`). */
export const GIFT_LIMITS = { occasion: 60, message: 220, senderName: 40, receiverName: 40 } as const;

/** The gift as `getGiftCard` returns it — public fields only, no cashier notes. */
export interface GiftCardView {
  status?: string;
  code?: string;
  amountSar?: number;
  kind?: string;
  package?: { name?: string; cups?: number; desserts?: number; kind?: string } | null;
  card?: Partial<GiftCardDetails> | null;
  /** Set when the server texted the recipient. */
  smsSent?: boolean;
}

/** Paid and live, or already used: either way the payment is done. */
export function isGiftPaid(g: GiftCardView | null | undefined): boolean {
  return g?.status === 'active' || g?.status === 'used';
}

// ── Callables ───────────────────────────────────────────────────────────────

/**
 * Unwrap a callable's payload, treating `{ ok: false }` as the failure it is.
 * These functions refuse in both shapes (see `callFn`).
 */
function unwrap<T>(data: unknown): T {
  const d = data as { ok?: boolean; reason?: string; error?: string } | null;
  if (d && d.ok === false) throw new Error(d.reason || d.error || 'refused');
  return data as T;
}

/** Start a gift for a self-serve package. Returns the gift id. */
export async function createSelfGift(packageId: string): Promise<string> {
  const d = unwrap<{ id?: string }>(await callFn('createSelfGift', { packageId }));
  if (!d?.id) throw new Error('no_id');
  return d.id;
}

export async function getGiftCard(id: string): Promise<GiftCardView | null> {
  return (await callFn<GiftCardView | null>('getGiftCard', { id })) ?? null;
}

export async function updateGiftCardDetails(id: string, card: GiftCardDetails): Promise<void> {
  unwrap(await callFn('updateGiftCardDetails', { id, card }));
}

export interface GiftPaymentIntent {
  intentId: string;
  /** Priced by the server. The only figure Moyasar is ever asked for. */
  amountHalalas: number;
  code: string;
}

export async function createGiftCardPayment(giftId: string): Promise<GiftPaymentIntent> {
  const d = unwrap<Partial<GiftPaymentIntent>>(await callFn('createGiftCardPayment', { giftId }));
  if (!d?.intentId || !d.amountHalalas) throw new Error('bad_response');
  return { intentId: d.intentId, amountHalalas: Number(d.amountHalalas), code: String(d.code ?? '') };
}

/**
 * What ties the charge to the gift — the site's metadata, verbatim.
 *
 * `order_id` (what an order sends) would point settlement at an order that
 * does not exist. The gift path reads `gift_id`, and `gift_intent` is the
 * intent `createGiftCardPayment` just recorded, so a payment against a stale
 * intent can be told apart from this one.
 */
export function giftPaymentMetadata(giftId: string, intentId: string): Record<string, string> {
  return { gift_id: giftId, gift_intent: intentId };
}

/** Statement description — the site's wording, with the gift code for tracing. */
export function giftPaymentDescription(code: string): string {
  return `Sun Ray — بطاقة إهداء ${code}`.trim();
}

/** How long to wait for the server to activate a paid gift. */
const ACTIVATE_TIMEOUT_MS = 90_000;
const POLL_MS = 3_000;

/**
 * Wait until the server marks the gift paid.
 *
 * Polled through `getGiftCard`, which is what the site's return page does
 * (`waitActiveThenRender`). There is no public RTDB path for a gift to watch,
 * and the card form's own "paid" is only what this phone saw — the reasons are
 * in `storePay.ts`. A `timeout` is not a failure: the webhook can lag, and
 * telling a charged customer it failed invites a second charge.
 */
export async function waitForGiftActive(
  id: string,
  opts: { timeoutMs?: number; isCancelled?: () => boolean } = {},
): Promise<{ status: 'active' | 'timeout' | 'cancelled'; gift: GiftCardView | null }> {
  const deadline = Date.now() + (opts.timeoutMs ?? ACTIVATE_TIMEOUT_MS);
  let gift: GiftCardView | null = null;
  while (Date.now() < deadline) {
    if (opts.isCancelled?.()) return { status: 'cancelled', gift };
    try {
      gift = await getGiftCard(id);
    } catch {
      // A failed read is not a verdict on the payment. Try again.
    }
    if (isGiftPaid(gift)) return { status: 'active', gift };
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { status: 'timeout', gift };
}

/** Arabic for a refusal from any of the calls above. The site's messages. */
export function describeGiftError(e: unknown): string {
  const m = String((e as { message?: string; code?: string })?.message ?? e ?? '');
  if (/already_paid/.test(m)) return 'هذه البطاقة مدفوعة مسبقاً.';
  if (/below_min/.test(m)) return 'المبلغ أقل من الحدّ الأدنى.';
  if (/unauthenticated|login_required/.test(m)) return 'سجّل دخولك أولاً';
  if (/not.?found|gift_missing/.test(m)) return 'لم نعثر على هذه البطاقة';
  if (/phone/.test(m)) return 'رقم جوال المستلم غير صحيح';
  return 'تعذّر إتمام العملية — حاول مجدداً';
}

// ── My gifts ────────────────────────────────────────────────────────────────

/** One row of `myGifts`, as the account page reads it. */
export interface MyGift {
  /** The other person's name as they wrote it. */
  who?: string;
  /** `claimed` · `ended` · `unpaid` · anything else = still waiting. */
  state?: string;
  message?: string;
  items?: string[];
  endedReason?: string;
  code?: string;
  /** Recipient-only open token for a gifted order: `sunray.sa/g/<token>`. */
  token?: string;
  /** Page under `/store/` for a gift card, e.g. `gift.html?g=<id>`. */
  link?: string;
}

export interface MyGifts {
  received: MyGift[];
  sent: MyGift[];
  fromSunray: MyGift[];
  cards: MyGift[];
}

export async function fetchMyGifts(): Promise<MyGifts> {
  const d = (await callFn<Partial<MyGifts> | null>('myGifts', {})) ?? {};
  return {
    received: d.received ?? [],
    sent: d.sent ?? [],
    fromSunray: d.fromSunray ?? [],
    cards: d.cards ?? [],
  };
}

/** A gift card this customer bought — the `gift` rows of `myOrders`. */
export interface BoughtGift {
  id: string;
  code: string | null;
  status: string | null;
  recipientName: string | null;
  createdAt: number;
}

/**
 * Gift cards the customer bought, from `myOrders`.
 *
 * `myGifts.sent` lists gifted orders; gift cards bought from a package show
 * in the order feed as `type: 'gift'` rows keyed by gift id — the site's
 * account links each one to `gift.html?g=<id>`. That id is what the share
 * link needs, so this is the list «share again» is built from.
 */
export async function fetchBoughtGifts(): Promise<BoughtGift[]> {
  const d = await callFn<{ orders?: Record<string, unknown>[] } | null>('myOrders', {});
  return (d?.orders ?? [])
    .filter((o) => o && o.type === 'gift' && typeof o.id === 'string')
    .map((o) => ({
      id: o.id as string,
      code: typeof o.code === 'string' ? o.code : null,
      status: typeof o.status === 'string' ? o.status : null,
      recipientName: typeof o.recipientName === 'string' && o.recipientName ? o.recipientName : null,
      createdAt: Number(o.createdAt) || 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** The gift id inside a `myGifts` link, so the app can open it itself. */
export function giftIdFromLink(link: string | undefined): string | null {
  const m = /[?&]g=([^&#]+)/.exec(link ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}

/** A `myGifts` row's page on the site, or null when it has none for this viewer. */
export function myGiftUrl(g: MyGift): string | null {
  if (g.token) return `${GIFT_SITE}/g/${encodeURIComponent(g.token)}`;
  if (!g.link) return null;
  if (/^https?:\/\//.test(g.link)) return g.link;
  return `${GIFT_SITE}/store/${g.link.replace(/^\.?\//, '')}`;
}

/**
 * The state in words — said differently to each side, as the site does: the
 * recipient is told it is waiting for them, the sender whether it was
 * collected, because that is what each of them is asking.
 */
export function myGiftStateLabel(state: string | undefined, side: 'sent' | 'received'): string {
  if (state === 'claimed') return 'استُلمت';
  if (state === 'ended') return 'انتهت صلاحيتها';
  if (state === 'unpaid') return 'بانتظار الدفع';
  return side === 'sent' ? 'لم يتم الاستلام بعد' : 'بانتظارك';
}

/** A bought gift card's status in words (`GF_AR` on the site, plus the unpaid case). */
export function boughtGiftStatusLabel(status: string | null): string {
  if (status === 'active') return 'نشطة · جاهزة';
  if (status === 'used') return 'تم الاستخدام';
  if (status === 'cancelled') return 'ملغاة';
  return 'بانتظار الدفع';
}
