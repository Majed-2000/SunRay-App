import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, View, type ListRenderItemInfo } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  CategoryPill,
  EmptyState,
  ErrorState,
  FloatingCartBar,
  ProductCard,
  ProductRow,
  ResponsiveGrid,
  ScreenContainer,
  Spinner,
  Txt,
} from '@/components';
import { PRODUCT_ROW_HEIGHT } from '@/components/ProductCard';
import { useResponsive } from '@/hooks/useResponsive';
import { useCartStore, useCatalogStore } from '@/store';
import type { Product } from '@/types';

/** Row height plus the 12px gap between rows — the stride FlatList measures by. */
const ROW_GAP_SIZE = 12;
const ROW_STRIDE = PRODUCT_ROW_HEIGHT + ROW_GAP_SIZE;

/** Separator element — cheaper than a gap style recreated on every render. */
const ROW_GAP = () => <View style={{ height: ROW_GAP_SIZE }} />;

type Filter = string; // 'all' | a category id (mock key or backend id)

export function MenuScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const { isTablet, gridColumns, contentMaxWidth } = useResponsive();
  const categories = useCatalogStore((s) => s.categories);
  const products = useCatalogStore((s) => s.products);
  const status = useCatalogStore((s) => s.status);
  const reload = useCatalogStore((s) => s.load);
  const loading = status === 'loading';
  const error = status === 'error';
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const quickAdd = useCartStore((s) => s.quickAdd);

  // Recomputed only when the catalog or the chosen category changes — not on
  // every cart update, which also re-renders this screen.
  const list = useMemo(
    () => products.filter((p) => filter === 'all' || p.categoryId === filter),
    [products, filter],
  );

  const openProduct = useCallback((id: string) => router.push(`/product/${id}`), []);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <ProductRow product={item} onPress={() => openProduct(item.id)} onAdd={() => quickAdd(item)} />
    ),
    [openProduct, quickAdd],
  );

  const keyExtractor = useCallback((p: Product) => p.id, []);

  // Every row is the same height, so FlatList can compute offsets arithmetically
  // instead of measuring each one. This is what makes jumping into "الكل" with
  // 111 items instant rather than a long layout pass.
  const getItemLayout = useCallback(
    (_data: ArrayLike<Product> | null | undefined, index: number) => ({
      length: ROW_STRIDE,
      offset: ROW_STRIDE * index,
      index,
    }),
    [],
  );

  return (
    <>
      <ScreenContainer scroll={false} padded={false}>
        <View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.sm }}>
          <Txt size={24} weight="black" color={colors.ink}>
            القائمة
          </Txt>
        </View>

        {/* mode toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#e3d6bf',
            borderRadius: radius.md,
            padding: 4,
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          {(['pickup', 'delivery'] as const).map((m) => {
            const active = orderType === m;
            return (
              <View
                key={m}
                style={{
                  flex: 1,
                  backgroundColor: active ? colors.card : 'transparent',
                  borderRadius: radius.sm + 1,
                }}
              >
                <Txt
                  size={13}
                  weight="extraBold"
                  center
                  color={active ? colors.ink : colors.textMuted}
                  onPress={() => setOrderType(m)}
                  style={{ paddingVertical: 10 }}
                >
                  {m === 'pickup' ? '☕ استلام' : '🛵 توصيل'}
                </Txt>
              </View>
            );
          })}
        </View>

        {/* category tabs — fixed-height band so it never overlaps the grid */}
        <View style={{ height: 46, marginBottom: spacing.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg, alignItems: 'center' }}
          >
            <CategoryPill label="الكل" active={filter === 'all'} onPress={() => setFilter('all')} />
            {categories.map((c) => (
              <CategoryPill
                key={c.id}
                label={`${c.emoji} ${c.nameAr}`}
                active={filter === c.id}
                onPress={() => setFilter(c.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* items — flex:1 so it fills the remaining space and scrolls internally,
            keeping a stable layout across loading/loaded states */}
        {/*
          The phone list is virtualised. It used to be a ScrollView mapping over
          every product, which mounted all 111 rows at once — that is what made
          "الكل" hang. FlatList keeps roughly a screenful mounted instead.
          Tablets keep the grid: far fewer, larger cards, and no hang observed.
        */}
        {loading ? (
          <Spinner label="نحضّر القائمة لك…" />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState emoji="🔍" title="لا توجد أصناف" subtitle="جرّب تصنيفًا آخر" />
        ) : isTablet ? (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: 140 }}>
            <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.lg }}>
              <ResponsiveGrid
                data={list}
                columns={gridColumns}
                keyExtractor={(p) => p.id}
                renderItem={(p) => (
                  <ProductCard product={p} onPress={() => openProduct(p.id)} onAdd={() => quickAdd(p)} />
                )}
              />
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={list}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: spacing.xs,
              paddingBottom: 140,
              paddingHorizontal: spacing.lg,
              width: '100%',
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
            }}
            ItemSeparatorComponent={ROW_GAP}
            // Tuned for a ~90px row on a phone: fill the first screen, then
            // extend in small batches so scrolling never blocks the UI thread.
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            windowSize={7}
            removeClippedSubviews
            // Switching category should start at the top, not mid-list.
            key={filter}
          />
        )}
      </ScreenContainer>

      <FloatingCartBar bottom={70} />
    </>
  );
}
