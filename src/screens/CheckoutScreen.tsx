import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
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
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { useCartTotals } from '@/hooks/useCartTotals';
import { useResponsive } from '@/hooks/useResponsive';
import { checkoutDisplayTotal } from '@/utils/money';
import { rewardsWithinBalance } from '@/utils/rewards';
import { createStoreOrder, describeOrderError, type BrewTemp, type CreateOrderResult } from '@/services/storeOrders';
import { auth } from '@/services/firebase';
import { describeSettlement, readOrderStatus, waitForSettlement } from '@/services/storePay';
import { isResumable, resumeDecision } from '@/utils/inflightCheckout';
import { MoyasarCardForm } from '@/components/MoyasarCardForm';
import { PlateField, type PlateValue } from '@/components/PlateField';
import { isCurbside } from '@/constants/orderTypes';
import { validatePlate } from '@/vendor/plate_core';
import {
  useAuthStore,
  useBranchStore,
  useCartStore,
  useOrderStore,
  useLoyaltyStore,
  orderStage,
  toast,
} from '@/store';
import { useStoreSettingsStore } from '@/store/storeSettingsStore';

/** Where the customer is in the checkout. */
type Stage =
  | { step: 'review' }
  /** Order exists on the server; collecting the card. */
  | { step: 'pay'; order: CreateOrderResult }
  /** Card charged here; waiting for the server's webhook to settle it. */
  | { step: 'settling'; order: CreateOrderResult }
  /** A kept order is back on screen; its live status is read before any card form. */
  | { step: 'resuming'; order: CreateOrderResult };

export function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const orderType = useCartStore((s) => s.orderType);
  const clear = useCartStore((s) => s.clear);
  const coupon = useCartStore((s) => s.coupon);
  // Live from `store/config/open`. The server refuses orders while closed; this
  // says so before the customer fills in anything, and says why.
  const storeOpen = useStoreSettingsStore((s) => s.open);
  const closedReason = useStoreSettingsStore((s) => s.closedReason);

  const branch = useBranchStore((s) => s.current());
  const isGuest = useAuthStore((s) => s.isGuest);
  const totals = useCartTotals();
  const { contentMaxWidth } = useResponsive();
  const t = strings();

  const [submitting, setSubmitting] = useState(false);

  /**
   * What the order was built from. The same cart coming back to checkout is
   * the same order: leaving during «بيانات البطاقة» used to drop the order
   * from the screen, and «تأكيد الطلب» then created a second one, each listed
   * in «طلباتي» as its own unpaid order.
   */
  const cartKey = useMemo(
    () =>
      JSON.stringify({
        lines: lines.map((l) => [l.id, l.productId, l.qty, l.method ?? null, l.notes ?? null]),
        coupon: coupon?.code ?? null,
        orderType,
      }),
    [lines, coupon, orderType],
  );
  const [stage, setStage] = useState<Stage>(() => {
    const inflight = useOrderStore.getState().checkout;
    if (!isResumable(inflight, cartKey, auth().currentUser?.uid ?? null)) return { step: 'review' };
    // Not if the feed already shows it past unpaid (expired, cancelled, paid).
    const known = useOrderStore.getState().getById(inflight.order.orderId);
    if (known && orderStage(known) !== 'pending') return { step: 'review' };
    // The cached feed can be stale; the order's live status decides, below.
    return { step: 'resuming', order: inflight.order };
  });
  // Bumped after a failed attempt: the Moyasar form keeps showing its finished
  // 3-D Secure page forever, so a fresh one has to be mounted to try again.
  const [attempt, setAttempt] = useState(0);

  /**
   * While the server confirms a charge the customer must stay here. Leaving
   * used to let the wait run on in the background and, up to 90 seconds later,
   * clear the cart and jump to the success screen from wherever they were.
   */
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const leavingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leavingRef.current || stageRef.current.step !== 'settling') return;
        e.preventDefault();
        toast('انتظر لحظة — نؤكّد دفعتك');
      }),
    [navigation],
  );

  /** Leave checkout on our own terms — past the settling guard above. */
  const leaveTo = (href: Parameters<typeof router.replace>[0]) => {
    leavingRef.current = true;
    router.replace(href);
  };
  const [plate, setPlate] = useState<PlateValue>({ lettersAr: '', numbers: '' });

  /**
   * Before a resumed order gets its card form back, ask the server where it
   * stands. The stored feed is a snapshot: an order paid in the last minute —
   * by the webhook, or by the attempt that was open when the app was closed —
   * still looked unpaid there, and the form invited a second charge.
   */
  useEffect(() => {
    if (stage.step !== 'resuming') return;
    const { order } = stage;
    let cancelled = false;
    void (async () => {
      const res = await readOrderStatus(order.orderId);
      if (cancelled || !mountedRef.current) return;
      const orders = useOrderStore.getState();
      if (!res.ok) {
        // Not knowing is not "unpaid". Show the order, never the card form.
        toast('تعذّر التحقق من حالة الدفع، تابع طلبك من «طلباتي»');
        leaveTo(`/orders/${order.orderId}`);
        return;
      }
      const decision = resumeDecision(res.status);
      if (decision === 'pay') {
        setStage({ step: 'pay', order });
      } else if (decision === 'dead') {
        orders.setCheckout(null);
        setStage({ step: 'review' });
      } else {
        if (res.status === 'paid') orders.markPaid(order.orderId);
        orders.setCheckout(null);
        clear();
        void orders.loadOrders();
        leaveTo(res.status === 'paid' ? `/order-success?id=${order.orderId}` : `/orders/${order.orderId}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

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
      setAttempt((n) => n + 1);
      return;
    }

    setStage({ step: 'settling', order });
    const result = await waitForSettlement(order.orderId);
    const orders = useOrderStore.getState();

    if (result.status === 'paid' || result.status === 'timeout' || result.status === 'error') {
      // Only a confirmed settlement flips it; a timeout (or a listener that
      // failed) stays pending, since the charge may or may not have gone through.
      // Showing the card form again here is what invited a second payment.
      if (result.status === 'paid') orders.markPaid(order.orderId);
      orders.setCheckout(null);
      clear();
      if (mountedRef.current) leaveTo(`/order-success?id=${order.orderId}`);
      if (result.status !== 'paid') toast(describeSettlement(result.status));
      return;
    }

    toast(describeSettlement(result.status));
    if (result.status === 'failed') {
      if (mountedRef.current) {
        setAttempt((n) => n + 1);
        setStage({ step: 'pay', order });
      }
      return;
    }

    /**
     * Review, cancelled, refunded: this order is charged or dead, and the card
     * form must not come back for it — that invited a second payment. Review
     * is normally a charge being checked, so the cart is done with too.
     */
    orders.setCheckout(null);
    if (result.status === 'review') clear();
    void orders.loadOrders();
    if (mountedRef.current) leaveTo(`/orders/${order.orderId}`);
  };

  // Same figure as the cart (coupon already off) until the order exists, then
  // the server's signed total — the one that is charged. VAT is inclusive, so
  // the total is simply the lines — see utils/money.ts.
  const displayTotal = checkoutDisplayTotal(
    totals,
    stage.step === 'review' ? null : stage.order.totalHalalas,
  );

  const place = async () => {
    // Ordering requires a signed-in customer (no anonymous orders). Send guests
    // to login first; the cart is preserved so they can come back and check out.
    if (isGuest) {
      toast('سجّل دخولك لإتمام الطلب');
      router.push('/(auth)/login');
      return;
    }
    if (!storeOpen) {
      toast(closedReason ?? 'المتجر مغلق حاليًا');
      return;
    }
    if (submitting) return;
    // Rewards were checked when added, but the balance can have moved since
    // (an order elsewhere). Say it here rather than as a server refusal.
    const rewardRoom = rewardsWithinBalance(useLoyaltyStore.getState().data?.balance ?? 0, lines);
    if (!rewardRoom.ok) {
      toast(rewardRoom.message);
      return;
    }
    setSubmitting(true);
    try {
      /**
       * The server prices the order. Everything the screen has shown so far
       * is an estimate — `createStoreOrder` recomputes each line from
       * `menu/products`, ignores any price we send, and signs the total.
       * That returned figure is the only one Moyasar is ever asked for.
       */
      const curbside = isCurbside(orderType);
      if (curbside && !validatePlate(plate.lettersAr, plate.numbers).ok) {
        toast('أدخل رقم لوحة سيارتك');
        setSubmitting(false);
        return;
      }

      const order = await createStoreOrder({
        // `temp` carries the brewing method. Without it the server priced
        // and the barista prepared the product's default, whatever the
        // customer had picked.
        items: lines.map((l) =>
          l.rewardId
            ? // A reward: its own item, quantity one, priced by the server (zero,
              // plus any special-milk surcharge). The server takes the points.
              { serviceId: l.productId, qty: 1, temp: l.rewardTemp as BrewTemp | undefined, rewardId: l.rewardId, notes: l.notes }
            : { serviceId: l.productId, qty: l.qty, temp: l.method, notes: l.notes },
        ),
        // The server resolves the coupon again against the real cart and
        // may still refuse it; the total it returns is what gets charged.
        ...(coupon ? { couponCode: coupon.code } : {}),
        // The name the customer set in their profile, so the counter can call
        // it. Not the «عميل ١٢٣٤» placeholder the app shows when there is none.
        ...(auth().currentUser?.displayName?.trim()
          ? { customer: { name: auth().currentUser!.displayName!.trim() } }
          : {}),
        // Two modes exist. `orderType` may still say delivery or dine-in from
        // mock data, and the server would silently record either as a pickup.
        mode: curbside ? 'car' : 'pickup',
        // The plate is how the branch finds the car. Sent only for curbside:
        // on a counter pickup it is data we have no reason to hold.
        ...(curbside
          ? {
              plateLettersAr: plate.lettersAr,
              plateNumbers: plate.numbers,
              plateRaw: `${plate.lettersAr} ${plate.numbers}`,
            }
          : {}),
      });

      // Into the list now, while the cart still holds the lines — the
      // success screen reads it from there, and the feed lags behind.
      useOrderStore.getState().recordPlaced(order, { type: orderType, branchId: branch.id, lines });

      /**
       * A fully covered order — gift card, loyalty reward, coupon — is
       * already done. Opening a card form for zero riyals fails at the
       * gateway, and asking for a card on a free order is alarming.
       */
      if (order.free || order.totalHalalas <= 0) {
        clear();
        leaveTo(`/order-success?id=${order.orderId}`);
        return;
      }

      useOrderStore.getState().setCheckout({ order, cartKey, at: Date.now() });
      setStage({ step: 'pay', order });
    } catch (e) {
      // The cart is kept in every failure case so nothing is lost.
      toast(describeOrderError(e));
    } finally {
      setSubmitting(false);
    }

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

          {/* Curbside needs the car before the order exists — the plate is part
              of the order, not something added afterwards. */}
          {isCurbside(orderType) && stage.step === 'review' ? (
            <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
              <Txt size={15} weight="black" color={colors.ink} style={{ marginBottom: 4 }}>
                سيارتك
              </Txt>
              <Txt size={12} color={colors.textMuted} style={{ marginBottom: spacing.md, lineHeight: 19 }}>
                نحتاج اللوحة ليعرف الباريستا أي سيارة يخرج إليها
              </Txt>
              <PlateField value={plate} onChange={setPlate} />
            </Card>
          ) : null}

          {/* Live: Moyasar's own card form, once the server has priced the order. */}
          {stage.step !== 'review' ? (
            <>
              <Txt size={15} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
                بيانات البطاقة
              </Txt>
              {stage.step === 'settling' || stage.step === 'resuming' ? (
                <Card radiusKey="lg" style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
                  <Spinner label={stage.step === 'resuming' ? 'نتحقّق من حالة طلبك…' : 'نؤكّد دفعتك…'} fill={false} />
                  {/* The wait is the SERVER confirming, not this screen being
                      slow — say so, or a customer who sees a spinner after
                      their card was charged will try to pay again. */}
                  <Txt size={12} color={colors.textMuted} center style={{ marginTop: spacing.sm, lineHeight: 19 }}>
                    لا تغلق التطبيق — نتأكّد من اكتمال العملية لدى البنك
                  </Txt>
                </Card>
              ) : (
                <MoyasarCardForm
                  key={`${stage.order.orderId}-${attempt}`}
                  orderId={stage.order.orderId}
                  code={stage.order.code}
                  totalHalalas={stage.order.totalHalalas}
                  onResult={onPaymentResult}
                />
              )}
            </>
          ) : null}

          {/* totals */}
          <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
            <PriceRow label="المجموع الفرعي" amount={totals.subtotal} />
            <PriceRow label="شامل ضريبة القيمة المضافة (١٥٪)" amount={totals.vat} />
            {orderType === 'delivery' ? (
              <PriceRow label="رسوم التوصيل" amount={totals.deliveryFee === 0 ? 'مجانًا' : totals.deliveryFee} />
            ) : null}
            {totals.discount > 0 ? <PriceRow label="الخصم" amount={totals.discount} positive /> : null}
            {coupon ? (
              <Txt size={12} color={colors.textMuted} style={{ marginVertical: 4 }}>
                كوبون {coupon.code} · التقدير قبل تأكيد الخادم، والمبلغ النهائي يظهر بعد إنشاء الطلب
              </Txt>
            ) : null}
            <Divider dashed />
            <PriceRow label="الإجمالي المستحق" amount={displayTotal} emphasize />
          </Card>

          <View style={{ marginTop: spacing.lg, gap: 6 }}>
            <Txt size={11} color={colors.textFaint} center style={{ lineHeight: 18 }}>
              بعد تأكيد الطلب والدفع يبدأ الفرع التحضير، وتتابع حالته من «طلباتي».
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
          {stage.step !== 'review' ? (
            <Txt size={12} color={colors.textMuted} center>
              {stage.step === 'settling' || stage.step === 'resuming'
                ? 'جارٍ التأكيد…'
                : `طلبك رقم ${stage.order.code} · ${formatRiyal(stage.order.totalHalalas / 100)}`}
            </Txt>
          ) : (
            <>
              {!storeOpen ? (
                <Txt size={12} weight="bold" color={colors.danger} center style={{ marginBottom: spacing.sm }}>
                  {closedReason ?? 'المتجر مغلق حاليًا، ولا يمكن استقبال الطلبات'}
                </Txt>
              ) : null}
              <Button
                label={!storeOpen ? 'المتجر مغلق' : 'تأكيد الطلب'}
                trailing={!storeOpen ? undefined : formatRiyal(displayTotal)}
                onPress={place}
                loading={submitting}
                disabled={!storeOpen}
              />
            </>
          )}
        </View>
      </View>
    </>
  );
}
