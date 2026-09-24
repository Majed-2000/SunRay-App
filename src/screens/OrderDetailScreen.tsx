import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  ArriveButton,
  Button,
  Card,
  Divider,
  Header,
  OrderStatusBadge,
  PriceRow,
  ScreenContainer,
  Spinner,
  TrackSteps,
  Txt,
} from '@/components';
import { strings } from '@/i18n';
import { toArabicDigits, formatRiyal } from '@/utils/numerals';
import { isCurbside } from '@/constants/orderTypes';
import {
  flowStages,
  currentStepIndex,
  isActiveOrder,
  orderStage,
  orderRef,
  useBranchStore,
  useCartStore,
  toast,
  useOrderStore,
} from '@/store';

const PAYMENT_LABEL: Record<string, string> = {
  wallet: 'محفظة سن راي',
  card: 'بطاقة مدى / فيزا',
  applePay: 'Apple Pay',
  cash: 'الدفع عند الاستلام',
};

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((s) => s.getById(id));
  const fetchOrder = useOrderStore((s) => s.fetchOrder);
  const branches = useBranchStore((s) => s.branches);
  const t = strings();
  const [loading, setLoading] = useState(!order);
  const [cancelling, setCancelling] = useState(false);
  const cancel = useOrderStore((s) => s.cancel);
  const reorder = useCartStore((s) => s.reorder);

  // Fetch the latest order (also fills it in if opened directly).
  useEffect(() => {
    let active = true;
    fetchOrder(id).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, fetchOrder]);

  if (!order) {
    return (
      <ScreenContainer scroll={false} header={<Header showBack title="تفاصيل الطلب" />}>
        {loading ? (
          <Spinner />
        ) : (
          <Txt size={15} color={colors.textMuted} center style={{ marginTop: spacing['4xl'] }}>
            الطلب غير موجود
          </Txt>
        )}
      </ScreenContainer>
    );
  }

  const branch = branches.find((b) => b.id === order.branchId);
  const currentIndex = currentStepIndex(order);
  const isActive = isActiveOrder(order);
  const steps = flowStages(order.type).map((s) => ({ label: t.orderStage[s], en: t.orderStageEn[s] }));
  const showPayment = order.paymentKnown !== false;
  // Live, «pending» means not yet paid: a paid order moves straight to Active.
  // That is the only state the store lets a customer cancel from.
  const unpaid = orderStage(order) === 'pending';

  const confirmCancel = () => {
    Alert.alert('إلغاء الطلب', 'سيُلغى طلبك ولن يُحضَّر. الطلب غير مدفوع، فلن يُخصم منك شيء.', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'إلغاء الطلب',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          const ok = await cancel(order.id);
          setCancelling(false);
          toast(ok ? 'تم إلغاء الطلب' : 'تعذّر الإلغاء — ربما تم الدفع للتو. حدّث الصفحة');
        },
      },
    ]);
  };

  const onReorder = () => {
    const { added, missing, needChoice } = reorder(order.items);
    const notes = [
      needChoice.length ? `اختر حار أو بارد لـ: ${needChoice.join('، ')}` : '',
      missing.length ? `غير متوفر: ${missing.join('، ')}` : '',
    ].filter(Boolean);
    if (added === 0) {
      // Nothing could go in as-is; send them to the menu with the reason.
      toast(notes.join(' — ') || 'أصناف هذا الطلب لم تعد في القائمة');
      router.push('/(tabs)/menu');
      return;
    }
    toast(notes.length ? `أُضيفت بقية الأصناف — ${notes.join(' — ')}` : 'أُضيفت أصناف الطلب إلى السلة ✓');
    router.push('/cart');
  };

  return (
    <ScreenContainer header={<Header showBack title={`الطلب ${orderRef(order)}`} />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg }}>
          <Ionicons
            name={isCurbside(order.type) ? 'car' : order.type === 'delivery' ? 'bicycle' : 'storefront'}
            size={20}
            color={colors.goldDeep}
          />
          <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
            {t.orderType[order.type]} · {branch?.nameAr ?? ''}
          </Txt>
          <OrderStatusBadge stage={orderStage(order)} />
        </View>

        {/* Curbside: the whole point of the mode is this button. It sits above
            the timeline because a customer who has just parked is not reading
            step labels — they want to say they are here. */}
        {isActive && isCurbside(order.type) ? (
          <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
            <ArriveButton orderId={order.id} code={order.code ?? null} />
          </Card>
        ) : null}

        {isActive ? (
          <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
            <TrackSteps steps={steps} currentIndex={currentIndex < 0 ? 0 : currentIndex} />
            {order.type === 'delivery' ? (
              <Button label="فتح التتبع المباشر" variant="outline" style={{ marginTop: spacing.md }} onPress={() => router.push(`/track/${order.id}`)} />
            ) : null}
          </Card>
        ) : null}

        {/* items */}
        <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
          <Txt size={14} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
            العناصر
          </Txt>
          {order.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Txt size={14} weight="bold" color={colors.ink}>
                  {toArabicDigits(it.qty)}× {it.nameAr}
                </Txt>
                {it.optionLabel ? (
                  <Txt size={11} color={colors.textFaint}>
                    {it.optionLabel}
                  </Txt>
                ) : null}
              </View>
              {/* The live feed carries no per-line price; «٠ ﷼» on every
                  line read as a free order. Show a price only when known. */}
              {it.lineTotal > 0 ? (
                <Txt size={14} weight="bold" color={colors.ink}>
                  {formatRiyal(it.lineTotal)}
                </Txt>
              ) : null}
            </View>
          ))}
          <Divider dashed />
          {order.subtotal !== order.total ? <PriceRow label="المجموع الفرعي" amount={order.subtotal} /> : null}
          <PriceRow label="منها ضريبة القيمة المضافة" amount={order.vat} />
          {order.deliveryFee > 0 ? <PriceRow label="رسوم التوصيل" amount={order.deliveryFee} /> : null}
          {order.discount > 0 ? <PriceRow label="الخصم" amount={order.discount} positive /> : null}
          <Divider dashed />
          <PriceRow label="الإجمالي" amount={order.total} emphasize />
        </Card>

        {/* meta — only what is actually known. Live orders do not report
            the payment method, and points arrive only once the order settles. */}
        {showPayment || order.pointsEarned > 0 ? (
          <Card radiusKey="lg">
            {showPayment ? <MetaRow label="طريقة الدفع" value={PAYMENT_LABEL[order.paymentMethod]} /> : null}
            {showPayment && order.pointsEarned > 0 ? <Divider marginV={spacing.sm} /> : null}
            {order.pointsEarned > 0 ? (
              <MetaRow label="النقاط المكتسبة" value={`+${toArabicDigits(order.pointsEarned)} نقطة`} accent />
            ) : null}
          </Card>
        ) : null}

        {/* Unpaid: without these an unpaid order was a dead end — the customer
            could see what they owed and had no way to pay it or drop it. */}
        {unpaid && order.payUrl ? (
          <Button label="ادفع الآن" variant="gold" style={{ marginTop: spacing.lg }} onPress={() => Linking.openURL(order.payUrl!)} />
        ) : null}
        {unpaid ? (
          <Button
            label="إلغاء الطلب"
            variant="outline"
            style={{ marginTop: spacing.md }}
            loading={cancelling}
            onPress={confirmCancel}
          />
        ) : null}

        <Button label="إعادة الطلب" variant={unpaid ? 'ghost' : 'gold'} style={{ marginTop: spacing.lg }} onPress={onReorder} />
      </View>
    </ScreenContainer>
  );
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Txt size={14} color={colors.textSecondary}>
        {label}
      </Txt>
      <Txt size={14} weight="extraBold" color={accent ? colors.goldDeep : colors.ink}>
        {value}
      </Txt>
    </View>
  );
}
