import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  Card,
  EmptyState,
  ErrorState,
  OrderStatusBadge,
  ScreenContainer,
  SegmentedTabs,
  Spinner,
  Txt,
} from '@/components';
import { fetchPastOrders, type PastOrder } from '@/services/orders';
import type { Order } from '@/types';
import { branchById } from '@/data';
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { useResponsive } from '@/hooks/useResponsive';
import { USE_BACKEND } from '@/services/api';
import { useAuthStore, useOrderStore, isActiveOrder, orderStage, orderRef } from '@/store';

function relativeDay(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  return `قبل ${toArabicDigits(days)} يوم`;
}

/** A row in the "منتهي" tab: either an app order or imported Foodics history. */
type DoneRow =
  | { kind: 'app'; at: number; order: Order }
  | { kind: 'foodics'; at: number; past: PastOrder };

export function OrdersScreen() {
  const orders = useOrderStore((s) => s.orders);
  const status = useOrderStore((s) => s.status);
  const loadOrders = useOrderStore((s) => s.loadOrders);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { contentMaxWidth } = useResponsive();
  const t = strings();

  // Only the backend list needs fetching; mock orders live in the store already
  // (and re-loading would wipe a just-placed mock order). The backend scopes the
  // list to the authenticated customer, so guests (who can't order) show empty.
  useEffect(() => {
    if (!USE_BACKEND) return;
    if (isGuest) {
      useOrderStore.setState({ status: 'ready', orders: [] });
    } else {
      loadOrders();
    }
  }, [loadOrders, isGuest]);

  // Orders placed at the counter before the app. Kept separate from the store:
  // they are read-only history, cannot be tracked or reordered, and the backend
  // may decline to serve them at all (it refuses while OTP is still mock).
  const [history, setHistory] = useState<PastOrder[]>([]);
  useEffect(() => {
    if (!USE_BACKEND || isGuest) return;
    let cancelled = false;
    fetchPastOrders()
      .then((r) => {
        if (!cancelled && r.available && r.matched) setHistory(r.orders);
      })
      // A customer with no Foodics history is the normal case, not a failure —
      // never let it surface as an error over their real orders.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const loading = status === 'loading';
  const error = status === 'error';
  const reload = () => {
    if (!isGuest) loadOrders();
  };

  const [tab, setTab] = useState<'active' | 'done'>('active');
  const active = useMemo(() => orders.filter((o) => isActiveOrder(o)), [orders]);
  const past = useMemo(() => orders.filter((o) => !isActiveOrder(o)), [orders]);

  /**
   * The "منتهي" tab is app orders and counter history in one stream, newest
   * first. Splitting them into two sections would make the customer reason
   * about where an order came from, which is our concern, not theirs.
   */
  const doneRows = useMemo<DoneRow[]>(() => {
    const appRows: DoneRow[] = past.map((o) => ({ kind: 'app', at: o.createdAt, order: o }));
    const pastRows: DoneRow[] = history.map((h) => ({
      kind: 'foodics',
      at: h.businessDate ? new Date(h.businessDate).getTime() : 0,
      past: h,
    }));
    return [...appRows, ...pastRows].sort((a, b) => b.at - a.at);
  }, [past, history]);

  const rows = tab === 'active' ? active : doneRows;
  const hasAnything = active.length + doneRows.length > 0;

  const renderRow = useCallback(
    ({ item }: { item: Order | DoneRow }) =>
      'kind' in item ? (
        item.kind === 'app' ? (
          <OrderCard order={item.order} />
        ) : (
          <PastOrderCard past={item.past} />
        )
      ) : (
        <OrderCard order={item} />
      ),
    [],
  );

  return (
    <ScreenContainer scroll={false} padded={false} header={<View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.sm }}><Txt size={24} weight="black" color={colors.ink}>طلباتي</Txt></View>}>
      {loading ? (
        <Spinner label="نجلب طلباتك…" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !hasAnything ? (
        <EmptyState
          emoji="🧾"
          title={t.empty.orders}
          subtitle={t.empty.ordersHint}
          actionLabel="ابدأ الطلب"
          onAction={() => router.replace('/(tabs)/menu')}
        />
      ) : (
        <>
          <SegmentedTabs
            tabs={[
              { key: 'active', label: 'نشط', count: active.length },
              { key: 'done', label: 'منتهي', count: doneRows.length },
            ]}
            value={tab}
            onChange={setTab}
          />

          <FlatList
            // Remounts on tab change so the list starts at the top and the two
            // streams never share scroll position.
            key={tab}
            data={rows as readonly (Order | DoneRow)[]}
            renderItem={renderRow}
            keyExtractor={(it) =>
              'kind' in it ? (it.kind === 'app' ? it.order.id : `f-${it.past.foodicsOrderId}`) : it.id
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: 100,
              gap: 12,
              width: '100%',
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
            }}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            ListEmptyComponent={
              tab === 'active' ? (
                <EmptyState
                  emoji="☕"
                  title="لا توجد طلبات جارية"
                  subtitle="طلباتك المكتملة في تبويب «منتهي»"
                  actionLabel="اطلب الآن"
                  onAction={() => router.replace('/(tabs)/menu')}
                />
              ) : (
                <EmptyState emoji="🧾" title="لا توجد طلبات منتهية" subtitle="طلباتك المكتملة ستظهر هنا" />
              )
            }
          />
        </>
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
                {orderRef(order.id)}
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
  /**
   * A counter order imported from Foodics. Deliberately not pressable: there is
   * no detail screen behind it and nothing to track. Making it look tappable and
   * then doing nothing is worse than leaving it plainly static.
   */
  function PastOrderCard({ past }: { past: PastOrder }) {
    const when = past.businessDate ? relativeDay(new Date(past.businessDate).getTime()) : '';
    return (
      <Card radiusKey="lg">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="storefront" size={16} color={colors.textMuted} />
              <Txt size={15} weight="black" color={colors.ink}>
                #{toArabicDigits(past.reference)}
              </Txt>
            </View>
            <Txt size={12} color={colors.textFaint} style={{ marginTop: 3 }}>
              {when ? `طلب من الفرع · ${when}` : 'طلب من الفرع'}
            </Txt>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.chip,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Ionicons name="checkmark-circle" size={13} color={colors.textMuted} />
            <Txt size={11} weight="extraBold" color={colors.textMuted}>
              تم التسليم
            </Txt>
          </View>
        </View>

        <View style={{ marginTop: spacing.md, gap: 2 }}>
          {past.items.slice(0, 2).map((it, i) => (
            <Txt key={i} size={12} color={colors.textSecondary}>
              {toArabicDigits(it.quantity)}× {it.name}
            </Txt>
          ))}
          {past.items.length > 2 ? (
            <Txt size={12} color={colors.textFaint}>
              +{toArabicDigits(past.items.length - 2)} عناصر أخرى
            </Txt>
          ) : null}
        </View>

        {past.totalPrice > 0 ? (
          <View
            style={{
              marginTop: spacing.md,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.borderSoft,
            }}
          >
            <Txt size={15} weight="black" color={colors.textMuted}>
              {formatRiyal(past.totalPrice)}
            </Txt>
          </View>
        ) : null}
      </Card>
    );
  }
}
