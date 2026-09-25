import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
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
import type { Order } from '@/types';
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthStore, useBranchStore, useOrderStore, isActiveOrder, orderStage, orderRef, orderKindLabel } from '@/store';

function relativeDay(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  return `قبل ${toArabicDigits(days)} يوم`;
}

/** A row in the «منتهي» tab. */
type DoneRow = { kind: 'app'; at: number; order: Order };

export function OrdersScreen() {
  const orders = useOrderStore((s) => s.orders);
  const status = useOrderStore((s) => s.status);
  const loadOrders = useOrderStore((s) => s.loadOrders);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { contentMaxWidth } = useResponsive();
  const branches = useBranchStore((s) => s.branches);
  const t = strings();

  // On every focus, not once: tab screens stay mounted, so a mount-only load
  // kept showing «قيد التحضير» for an order the counter had long marked ready.
  // The feed is scoped to the signed-in customer; guests (who can't order)
  // show empty.
  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        useOrderStore.setState({ status: 'ready', orders: [] });
      } else {
        loadOrders();
      }
    }, [loadOrders, isGuest]),
  );

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
      await Promise.all([isGuest ? undefined : loadOrders()]);
    } finally {
      setRefreshing(false);
    }
  }, [isGuest, loadOrders, loadOrders]);

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
  const doneRows = useMemo<DoneRow[]>(
    () => past.map((o) => ({ kind: 'app' as const, at: o.createdAt, order: o })).sort((a, b) => b.at - a.at),
    [past],
  );

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
        <OrderCard order={item.order} />
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
            keyExtractor={(it) => ('kind' in it ? it.order.id : it.id)}
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
                tintColor={colors.goldDeep}
                colors={[colors.goldDeep]}
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
              <Ionicons name={order.type === 'delivery' ? 'bicycle' : 'storefront'} size={16} color={colors.goldDeep} />
              <Txt size={15} weight="black" color={colors.ink}>
                {orderRef(order)}
              </Txt>
            </View>
            <Txt size={12} color={colors.textFaint} style={{ marginTop: 3 }}>
              {[orderKindLabel(order.feedType) ?? branch?.nameAr, relativeDay(order.createdAt)].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <OrderStatusBadge stage={orderStage(order)} />
        </View>

        <View style={{ marginTop: spacing.md, gap: 2 }}>
          {order.items.slice(0, 2).map((it, i) => (
            <Txt key={i} size={12} color={colors.textSecondary}>
              {toArabicDigits(it.qty)}× {it.nameAr}{it.optionLabel ? ` · ${it.optionLabel}` : ''}
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
          <Txt size={15} weight="black" color={colors.goldDeep}>
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
