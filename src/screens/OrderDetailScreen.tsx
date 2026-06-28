import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  Button,
  Card,
  Divider,
  Header,
  OrderStatusBadge,
  PriceRow,
  ScreenContainer,
  TrackSteps,
  Txt,
} from '@/components';
import { branchById } from '@/data';
import { strings } from '@/i18n';
import { toArabicDigits, formatRiyal } from '@/utils/numerals';
import { flowStages, currentStepIndex, isActiveOrder, orderStage, useOrderStore } from '@/store';

const PAYMENT_LABEL: Record<string, string> = {
  wallet: 'محفظة سن راي',
  card: 'بطاقة مدى / فيزا',
  applePay: 'Apple Pay',
  cash: 'الدفع عند الاستلام',
};

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((s) => s.getById(id));
  const t = strings();

  if (!order) {
    return (
      <ScreenContainer header={<Header showBack title="تفاصيل الطلب" />}>
        <Txt size={15} color={colors.textMuted} center style={{ marginTop: spacing['4xl'] }}>
          الطلب غير موجود
        </Txt>
      </ScreenContainer>
    );
  }

  const branch = branchById(order.branchId);
  const currentIndex = currentStepIndex(order);
  const isActive = isActiveOrder(order);
  const steps = flowStages(order.type).map((s) => ({ label: t.orderStage[s], en: t.orderStageEn[s] }));

  return (
    <ScreenContainer header={<Header showBack title={`الطلب ${order.id}`} />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg }}>
          <Ionicons name={order.type === 'delivery' ? 'bicycle' : 'storefront'} size={20} color={colors.terracotta} />
          <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
            {t.orderType[order.type]} · {branch?.nameAr}
          </Txt>
          <OrderStatusBadge stage={orderStage(order)} />
        </View>

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
                <Txt size={11} color={colors.textFaint}>
                  {it.optionLabel}
                </Txt>
              </View>
              <Txt size={14} weight="bold" color={colors.ink}>
                {formatRiyal(it.lineTotal)}
              </Txt>
            </View>
          ))}
          <Divider dashed />
          <PriceRow label="المجموع الفرعي" amount={order.subtotal} />
          <PriceRow label="ضريبة القيمة المضافة" amount={order.vat} />
          {order.deliveryFee > 0 ? <PriceRow label="رسوم التوصيل" amount={order.deliveryFee} /> : null}
          {order.discount > 0 ? <PriceRow label="الخصم" amount={order.discount} positive /> : null}
          <Divider dashed />
          <PriceRow label="الإجمالي" amount={order.total} emphasize />
        </Card>

        {/* meta */}
        <Card radiusKey="lg">
          <MetaRow label="طريقة الدفع" value={PAYMENT_LABEL[order.paymentMethod]} />
          <Divider marginV={spacing.sm} />
          <MetaRow label="النقاط المكتسبة" value={`+${toArabicDigits(order.pointsEarned)} نقطة`} accent />
        </Card>

        <Button label="إعادة الطلب" variant="gold" style={{ marginTop: spacing.lg }} onPress={() => router.replace('/(tabs)/menu')} />
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
      <Txt size={14} weight="extraBold" color={accent ? colors.terracotta : colors.ink}>
        {value}
      </Txt>
    </View>
  );
}
