import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
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
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { useResponsive } from '@/hooks/useResponsive';
import { USE_BACKEND } from '@/services/api';
import { useAuthStore, useBranchStore, useOrderStore, isActiveOrder, orderStage, orderRef } from '@/store';

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
  const branches = useBranchStore((s) => s.branches);
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
  const loadHistory = useCallback(async () => {
    if (!USE_BACKEND || isGuest) return;
    try {
      const r = await fetchPastOrders();
      if (r.available && r.matched) setHistory(r.orders);
    } catch {
      // A customer with no Foodics history is the normal case, not a failure —
      // never let it surface as an error over their real orders.
    }
  }, [isGuest]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const reload = () => {
    if (!isGuest) loadOrders();
  };

  /**
   * Pull to refresh.
   *
   * This screen answers "where is my order?", and the answer changes at the
   * counter, not in the app. Without a pull gesture the only way to get a fresh
   * status was to leave the tab and come back — so that is what people did, and
   * it looked like the screen was stuck.
   *
   * `refreshing` is local rather than derived from the store's `loading`: that
   * flag also drives the full-screen spinner, and reusing it would blank the
   * list out from under the finger mid-pull.
   */
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([isGuest ? undefined : loadOrders(), loadHistory()]);
    } finally {
      setRefreshing(false);
    }
  }, [isGuest, loadOrders, loadHistory]);

  const [tab, setTab] = useState<'active' | 'done'>('active');
  const listRef = useRef<FlatList<Order | DoneRow>>(null);

  /**
   * Switching tabs scrolls back to the top instead of remounting the list.
   *
   * The first version keyed the FlatList on the tab, which tore it down and
   * rebuilt it on every switch — that full remount is what made the screen
   * flash and jump. Changing the data and nudging the offset keeps the same
   * list alive, so the change reads as content swapping rather than the screen
   * being replaced.
   */
  const selectTab = useCallback((next: 'active' | 'done') => {
    setTab(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
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

  /**
   * The full-screen spinner and error state are for the *first* load only.
   *
   * `loadOrders` flips the store to `loading` on every call, including a
   * pull-to-refresh — so keying the spinner off the status alone tore the list
   * out from under the finger mid-gesture and then dropped it back. Once there
   * is something on screen, a refresh shows its progress in the pull spinner and
   * a failed refresh leaves the last known orders visible, which is more useful
   * than an error page where the data used to be.
   */
  const loading = status === 'loading' && !hasAnything;
  const error = status === 'error' && !hasAnything;

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
            onChange={selectTab}
          />

          <FlatList
            ref={listRef}
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
              // Lets the empty state fill the remaining height and centre in it,
              // instead of clinging to the top under the tabs.
              flexGrow: 1,
            }}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.terracotta}
                colors={[colors.terracotta]}
                progressBackgroundColor={colors.card}
              />
            }
            // NOT removeClippedSubviews. On Android it detaches off-screen rows,
            // and with a short list that switches content it leaves blank gaps
            // where cards should be. It buys nothing for a handful of orders.
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center' }}>
                {tab === 'active' ? (
                  <EmptyState
                    emoji="☕"
                    title="لا توجد طلبات جارية"
                    subtitle="طلباتك المكتملة في تبويب «منتهي»"
                    actionLabel="اطلب الآن"
                    onAction={() => router.replace('/(tabs)/menu')}
                  />
                ) : (
                  <EmptyState emoji="🧾" title="لا توجد طلبات منتهية" subtitle="طلباتك المكتملة ستظهر هنا" />
                )}
              </View>
            }
          />
        </>
      )}
    </ScreenContainer>
  );

  function OrderCard({ order }: { order: Order }) {
    // Look the branch up in the live store, not the mock array in @/data. Orders
    // now carry backend branch ids sourced from Foodics, which never match the
    // hardcoded mock ids — the lookup always missed and the card rendered a
    // dangling "· اليوم" with no branch name in front of it.
    const branch = branches.find((b) => b.id === order.branchId);
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
