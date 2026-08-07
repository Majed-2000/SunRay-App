import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  Button,
  Card,
  Divider,
  Header,
  PriceRow,
  ScreenContainer,
  Spinner,
  Txt,
} from '@/components';
import type { PaymentMethod } from '@/types';
import { CONFIG } from '@/constants/config';
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { pointsEarned } from '@/utils/money';
import { useCartTotals } from '@/hooks/useCartTotals';
import { useResponsive } from '@/hooks/useResponsive';
import { USE_BACKEND } from '@/services/api';
import { createStoreOrder, describeOrderError, type CreateOrderResult } from '@/services/storeOrders';
import { describeSettlement, waitForSettlement } from '@/services/storePay';
import { MoyasarCardForm } from '@/components/MoyasarCardForm';
import {
  useAuthStore,
  useBranchStore,
  useCartStore,
  useCatalogStore,
  useLoyaltyStore,
  useOrderStore,
  useWalletStore,
  toast,
} from '@/store';

/**
 * Payment methods offered in MOCK mode only.
 *
 * These were the whole of "payment" before: four rows including a card ending
 * «•••• ٤٢٣٧» that was literal text. Nothing was ever charged. Live, the card
 * form is Moyasar's own and the methods it supports are its business, not a
 * list we maintain here.
 */
const MOCK_METHODS: { id: PaymentMethod; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'wallet', label: 'محفظة سن راي', sub: 'الدفع من رصيدك', icon: 'wallet' },
  { id: 'card', label: 'بطاقة', sub: 'وضع التجربة', icon: 'card' },
  { id: 'cash', label: 'الدفع عند الاستلام', sub: 'نقدًا أو بالبطاقة', icon: 'cash' },
];

/** Where the customer is in the checkout. */
type Stage =
  | { step: 'review' }
  /** Order exists on the server; collecting the card. */
  | { step: 'pay'; order: CreateOrderResult }
  /** Card charged here; waiting for the server's webhook to settle it. */
  | { step: 'settling'; order: CreateOrderResult };

export function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const orderType = useCartStore((s) => s.orderType);
  const addressId = useCartStore((s) => s.addressId);
  const useWallet = useCartStore((s) => s.useWallet);
  const setUseWallet = useCartStore((s) => s.setUseWallet);
  const clear = useCartStore((s) => s.clear);

  const walletBalance = useWalletStore((s) => s.balance);
  const branch = useBranchStore((s) => s.current());
  const isGuest = useAuthStore((s) => s.isGuest);
  const totals = useCartTotals();
  const { contentMaxWidth } = useResponsive();
  const t = strings();

  const [method, setMethod] = useState<PaymentMethod>(walletBalance > 0 ? 'wallet' : 'card');
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: 'review' });

  /**
   * The card form finished on this device — now find out what actually
   * happened.
   *
   * `outcome` is only what this phone saw. The order is settled by Moyasar's
   * webhook calling the server, which is what survives the app being
   * backgrounded or losing signal in the second after the charge. So we watch
   * the order until the SERVER writes a terminal status.
   *
   * A timeout is deliberately not treated as failure: the charge may well have
   * gone through and the webhook simply be a few seconds behind. Telling the
   * customer their payment failed, and inviting them to pay again, is the one
   * outcome that could take their money twice.
   */
  const onPaymentResult = async (outcome: 'paid' | 'failed') => {
    if (stage.step !== 'pay') return;
    const { order } = stage;

    if (outcome === 'failed') {
      toast('لم تكتمل عملية الدفع، تحقّق من بيانات البطاقة');
      return;
    }

    setStage({ step: 'settling', order });
    const result = await waitForSettlement(order.orderId);

    if (result.status === 'paid' || result.status === 'timeout') {
      clear();
      router.replace(`/order-success?id=${order.orderId}`);
      if (result.status === 'timeout') toast(describeSettlement('timeout'));
      return;
    }

    toast(describeSettlement(result.status));
    setStage({ step: 'pay', order });
  };

  // In backend mode the server ignores coupon/points/wallet (discount is forced to
  // 0 this phase), so we show the server-aligned total and hide those perks — the
  // checkout must never display a discount it won't actually apply.
  // VAT is inclusive, so the total is simply the lines plus delivery — see
  // utils/money.ts. Adding totals.vat here would double-charge the tax.
  const displayTotal = USE_BACKEND ? totals.subtotal + totals.deliveryFee : totals.total;

  const place = async () => {
    // Backend mode: send the cart to the server (it computes the totals), then
    // go to success. Wallet/loyalty stay mock and are not touched here.
    if (USE_BACKEND) {
      // Ordering requires a signed-in customer (no anonymous orders). Send guests
      // to login first; the cart is preserved so they can come back and check out.
      if (isGuest) {
        toast('سجّل دخولك لإتمام الطلب');
        router.push('/(auth)/login');
        return;
      }
      if (submitting) return;
      setSubmitting(true);
      try {
        /**
         * The server prices the order. Everything the screen has shown so far
         * is an estimate — `createStoreOrder` recomputes each line from
         * `menu/products`, ignores any price we send, and signs the total.
         * That returned figure is the only one Moyasar is ever asked for.
         */
        const order = await createStoreOrder({
          items: lines.map((l) => ({ serviceId: l.productId, qty: l.qty, notes: l.notes })),
          // Two modes exist. `orderType` may still say delivery or dine-in in
          // mock data, and the server would silently record either as a pickup.
          mode: orderType === 'car' ? 'car' : 'pickup',
        });

        /**
         * A fully covered order — gift card, loyalty reward, coupon — is
         * already done. Opening a card form for zero riyals fails at the
         * gateway, and asking for a card on a free order is alarming.
         */
        if (order.free || order.totalHalalas <= 0) {
          clear();
          router.replace(`/order-success?id=${order.orderId}`);
          return;
        }

        setStage({ step: 'pay', order });
      } catch (e) {
        // The cart is kept in every failure case so nothing is lost.
        toast(describeOrderError(e));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Mock mode (unchanged): compute locally + update mock wallet/loyalty.
    const order = useOrderStore.getState().place({
      type: orderType,
      branchId: branch.id,
      addressId: addressId ?? undefined,
      items: lines.map((l) => ({
        nameAr: l.nameAr,
        optionLabel: l.optionLabel,
        qty: l.qty,
        lineTotal: l.unitPrice * l.qty,
      })),
      subtotal: totals.subtotal,
      vat: totals.vat,
      deliveryFee: totals.deliveryFee,
      discount: totals.discount + totals.pointsDiscount,
      total: totals.total,
      paymentMethod: method,
      // Estimate only, at the rate the ledger reports. The real award is made
      // server-side when the order settles.
      pointsEarned: pointsEarned(totals.subtotal, useLoyaltyStore.getState().data?.pointsPerSar ?? 1),
      etaMinutes: orderType === 'delivery' ? 25 : 12,
    });

    if (useWallet && totals.walletApplied > 0) {
      useWalletStore.getState().debit(totals.walletApplied, `طلب ${order.id}`);
    }
    if (method === 'wallet') {
      useWalletStore.getState().debit(totals.total, `طلب ${order.id}`);
    }
    /**
     * Points are NOT adjusted here.
     *
     * This used to spend and earn against a local counter, and separately count
     * "eligible coffee cups" for a 6-cup card that does not exist. The ledger is
     * the server's: points are awarded when the order settles, and a reward is
     * deducted inside `createStoreOrder`. Moving the number on this device
     * produced a balance the ledger never agreed to, which the next refresh
     * silently reverted — the customer watched points appear and then vanish.
     */
    clear();
    router.replace(`/order-success?id=${order.id}`);
  };

  return (
    <>
      <ScreenContainer
        scroll={false}
        padded={false}
        header={
          <View style={{ paddingHorizontal: spacing['2xl'] }}>
            <Header showBack title="الدفع" />
          </View>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}>
          <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          {/* summary */}
          <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={orderType === 'delivery' ? 'bicycle' : 'storefront'} size={20} color={colors.goldDeep} />
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="extraBold" color={colors.ink}>
                  {t.orderType[orderType]}
                </Txt>
                <Txt size={12} color={colors.textFaint}>
                  {branch.nameAr} · {toArabicDigits(totals.count)} عناصر
                </Txt>
              </View>
            </View>
          </Card>

          {/* Live: Moyasar's own card form, once the server has priced the order. */}
          {USE_BACKEND && stage.step !== 'review' ? (
            <>
              <Txt size={15} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
                بيانات البطاقة
              </Txt>
              {stage.step === 'settling' ? (
                <Card radiusKey="lg" style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
                  <Spinner label="نؤكّد دفعتك…" fill={false} />
                  {/* The wait is the SERVER confirming, not this screen being
                      slow — say so, or a customer who sees a spinner after
                      their card was charged will try to pay again. */}
                  <Txt size={12} color={colors.textMuted} center style={{ marginTop: spacing.sm, lineHeight: 19 }}>
                    لا تغلق التطبيق — نتأكّد من اكتمال العملية لدى البنك
                  </Txt>
                </Card>
              ) : (
                <MoyasarCardForm
                  orderId={stage.order.orderId}
                  code={stage.order.code}
                  totalHalalas={stage.order.totalHalalas}
                  onResult={onPaymentResult}
                />
              )}
            </>
          ) : null}

          {/* payment methods — mock mode only */}
          {USE_BACKEND ? null : (
          <>
          <Txt size={15} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
            طريقة الدفع
          </Txt>
          <View style={{ gap: 10 }}>
            {MOCK_METHODS.map((m) => {
              const active = method === m.id;
              const disabled = m.id === 'wallet' && walletBalance <= 0;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => !disabled && setMethod(m.id)}
                  style={[
                    shadows.xs,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: colors.card,
                      borderRadius: radius.md,
                      padding: spacing.lg,
                      borderWidth: 1.5,
                      borderColor: active ? colors.gold : 'transparent',
                      opacity: disabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.sm,
                      backgroundColor: colors.chip,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={m.icon} size={18} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="extraBold" color={colors.ink}>
                      {m.label}
                    </Txt>
                    <Txt size={12} color={colors.textFaint}>
                      {m.id === 'wallet' ? formatRiyal(walletBalance) : m.sub}
                    </Txt>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.gold : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>
          </>
          )}

          {/* perks — hidden in backend mode (the server doesn't apply them yet) */}
          {!USE_BACKEND ? (
            <>
              <Txt size={15} weight="black" color={colors.ink} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
                خصومات ومكافآت
              </Txt>
              <Card radiusKey="lg" padding={0} style={{ overflow: 'hidden' }}>
                <PerkToggle
                  icon="wallet-outline"
                  label="استخدام رصيد المحفظة"
                  sub={formatRiyal(walletBalance)}
                  value={useWallet}
                  disabled={walletBalance <= 0 || method === 'wallet'}
                  onToggle={() => setUseWallet(!useWallet)}
                />
                {/* No "redeem my points" toggle: the programme has no
                    points-to-riyals conversion. A reward is claimed by adding
                    the rewarded product to the cart at price zero from the
                    loyalty screen, and the deduction happens server-side as the
                    order is written. */}
              </Card>
            </>
          ) : null}

          {/* totals */}
          <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
            <PriceRow label="المجموع الفرعي" amount={totals.subtotal} />
            <PriceRow label="شامل ضريبة القيمة المضافة (١٥٪)" amount={totals.vat} />
            {orderType === 'delivery' ? (
              <PriceRow label="رسوم التوصيل" amount={totals.deliveryFee === 0 ? 'مجانًا' : totals.deliveryFee} />
            ) : null}
            {!USE_BACKEND && totals.discount > 0 ? <PriceRow label="خصم الكوبون" amount={totals.discount} positive /> : null}
            {!USE_BACKEND && totals.walletApplied > 0 ? <PriceRow label="رصيد المحفظة" amount={totals.walletApplied} positive /> : null}
            <Divider dashed />
            <PriceRow label="الإجمالي المستحق" amount={displayTotal} emphasize />
          </Card>

          <View style={{ marginTop: spacing.lg, gap: 6 }}>
            <Txt size={11} color={colors.textFaint} center style={{ lineHeight: 18 }}>
              ℹ️ بعد الإرسال يظهر طلبك «قيد الانتظار» حتى يقبله الفرع، ثم يتحوّل إلى
              قيد التحضير فجاهز/في الطريق.
            </Txt>
            <Txt size={11} color={colors.textFaint} center style={{ lineHeight: 18 }}>
              🔒 تجربة تجريبية — لا يتم تنفيذ أي دفع حقيقي أو إرسال طلب فعلي
            </Txt>
          </View>
          </View>
        </ScrollView>
      </ScreenContainer>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        }}
      >
        <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          {/* Once the order exists on the server the card form owns the screen:
              a second "confirm" button here would create a duplicate order for
              a customer who tapped it again while typing their card. */}
          {USE_BACKEND && stage.step !== 'review' ? (
            <Txt size={12} color={colors.textMuted} center>
              {stage.step === 'settling'
                ? 'جارٍ التأكيد…'
                : `طلبك رقم ${stage.order.code} · ${formatRiyal(stage.order.totalHalalas / 100)}`}
            </Txt>
          ) : (
            <Button
              label={USE_BACKEND ? 'تأكيد الطلب' : 'أكمل الطلب'}
              trailing={formatRiyal(displayTotal)}
              onPress={place}
              loading={submitting}
            />
          )}
        </View>
      </View>
    </>
  );
}

function PerkToggle({
  icon,
  label,
  sub,
  value,
  disabled,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  value: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}
    >
      <Ionicons name={icon} size={20} color={colors.goldDeep} />
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="extraBold" color={colors.ink}>
          {label}
        </Txt>
        <Txt size={12} color={colors.textFaint}>
          {sub}
        </Txt>
      </View>
      <View
        style={{
          width: 46,
          height: 28,
          borderRadius: 14,
          backgroundColor: value ? colors.gold : colors.border,
          padding: 3,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white }} />
      </View>
    </Pressable>
  );
}
