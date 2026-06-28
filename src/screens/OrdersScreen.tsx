import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  Card,
  EmptyState,
  ErrorState,
  OrderStatusBadge,
  ScreenContainer,
  Spinner,
  Txt,
} from '@/components';
import type { Order } from '@/types';
import { branchById } from '@/data';
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { useResponsive } from '@/hooks/useResponsive';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { useOrderStore, isActiveOrder, orderStage } from '@/store';

function relativeDay(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  return `قبل ${toArabicDigits(days)} يوم`;
}

export function OrdersScreen() {
  const orders = useOrderStore((s) => s.orders);
  const { loading, error, reload } = useSimulatedLoad();
  const { contentMaxWidth } = useResponsive();
  const t = strings();
  const active = orders.filter((o) => isActiveOrder(o));
  const past = orders.filter((o) => !isActiveOrder(o));

  return (
    <ScreenContainer scroll={false} padded={false} header={<View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.sm }}><Txt size={24} weight="black" color={colors.ink}>طلباتي</Txt></View>}>
      {loading ? (
        <Spinner label="نجلب طلباتك…" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : orders.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title={t.empty.orders}
          subtitle={t.empty.ordersHint}
          actionLabel="ابدأ الطلب"
          onAction={() => router.replace('/(tabs)/menu')}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          {active.length > 0 ? (
            <>
              <Txt size={14} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                الطلبات الجارية
              </Txt>
              <View style={{ gap: 12, marginBottom: spacing.xl }}>
                {active.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </View>
            </>
          ) : null}

          {past.length > 0 ? (
            <>
              <Txt size={14} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                الطلبات السابقة
              </Txt>
              <View style={{ gap: 12 }}>
                {past.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </View>
            </>
          ) : null}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );

  function OrderCard({ order }: { order: Order }) {
    const branch = branchById(order.branchId);
    const isActive = isActiveOrder(order);
    return (
      <Card
        radiusKey="lg"
        onPress={() =>
          router.push(isActive && order.type === 'delivery' ? `/track/${order.id}` : `/orders/${order.id}`)
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={order.type === 'delivery' ? 'bicycle' : 'storefront'} size={16} color={colors.terracotta} />
              <Txt size={15} weight="black" color={colors.ink}>
                {order.id}
              </Txt>
            </View>
            <Txt size={12} color={colors.textFaint} style={{ marginTop: 3 }}>
              {branch?.nameAr} · {relativeDay(order.createdAt)}
            </Txt>
          </View>
          <OrderStatusBadge stage={orderStage(order)} />
        </View>

        <View style={{ marginTop: spacing.md, gap: 2 }}>
          {order.items.slice(0, 2).map((it, i) => (
            <Txt key={i} size={12} color={colors.textSecondary}>
              {toArabicDigits(it.qty)}× {it.nameAr} · {it.optionLabel}
            </Txt>
          ))}
          {order.items.length > 2 ? (
            <Txt size={12} color={colors.textFaint}>
              +{toArabicDigits(order.items.length - 2)} عناصر أخرى
            </Txt>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSoft,
          }}
        >
          <Txt size={15} weight="black" color={colors.terracotta}>
            {formatRiyal(order.total)}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.chip, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Txt size={12} weight="extraBold" color={colors.ink}>
              {isActive && order.type === 'delivery' ? 'تتبع' : 'التفاصيل'}
            </Txt>
            <Ionicons name="chevron-back" size={14} color={colors.ink} />
          </View>
        </View>
      </Card>
    );
  }
}
