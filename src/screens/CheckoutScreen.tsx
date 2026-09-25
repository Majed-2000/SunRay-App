import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { createStoreOrder, describeOrderError, type CreateOrderResult } from '@/services/storeOrders';
import { auth } from '@/services/firebase';
import { describeSettlement, waitForSettlement } from '@/services/storePay';
import { MoyasarCardForm } from '@/components/MoyasarCardForm';
import { PlateField, type PlateValue } from '@/components/PlateField';
import { isCurbside } from '@/constants/orderTypes';
import { validatePlate } from '@/vendor/plate_core';
import {
  useAuthStore,
  useBranchStore,
  useCartStore,
  useOrderStore,
  toast,
} from '@/store';
import { useStoreSettingsStore } from '@/store/storeSettingsStore';

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
  const [stage, setStage] = useState<Stage>({ step: 'review' });
  const [plate, setPlate] = useState<PlateValue>({ lettersAr: '', numbers: '' });

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
      // Only a confirmed settlement flips it; a timeout stays pending, since
      // the charge may or may not have gone through.
      if (result.status === 'paid') useOrderStore.getState().markPaid(order.orderId);
      clear();
      router.replace(`/order-success?id=${order.orderId}`);
      if (result.status === 'timeout') toast(describeSettlement('timeout'));
      return;
    }

    toast(describeSettlement(result.status));
    setStage({ step: 'pay', order });
  };

  // An estimate before the coupon: the server applies the coupon and returns
  // the figure that is charged, shown once the order exists. VAT is inclusive,
  // so the total is simply the lines — see utils/money.ts.
  const displayTotal = totals.subtotal + totals.deliveryFee;

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
        items: lines.map((l) => ({ serviceId: l.productId, qty: l.qty, temp: l.method, notes: l.notes })),
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

          {/* totals */}
          <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
            <PriceRow label="المجموع الفرعي" amount={totals.subtotal} />
            <PriceRow label="شامل ضريبة القيمة المضافة (١٥٪)" amount={totals.vat} />
            {orderType === 'delivery' ? (
              <PriceRow label="رسوم التوصيل" amount={totals.deliveryFee === 0 ? 'مجانًا' : totals.deliveryFee} />
            ) : null}
            {coupon ? (
              <Txt size={12} color={colors.textMuted} style={{ marginVertical: 4 }}>
                كوبون {coupon.code} · يُخصم من الإجمالي عند تأكيد الطلب
              </Txt>
            ) : null}
            <Divider dashed />
            <PriceRow label="الإجمالي المستحق" amount={displayTotal} emphasize />
          </Card>

          <View style={{ marginTop: spacing.lg, gap: 6 }}>
            <Txt size={11} color={colors.textFaint} center style={{ lineHeight: 18 }}>
              ℹ️ بعد تأكيد الطلب والدفع يبدأ الفرع التحضير، وتتابع حالته من «طلباتي».
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
              {stage.step === 'settling'
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
