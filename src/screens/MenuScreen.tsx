import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, View, type ListRenderItemInfo } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  CategoryPill,
  EmptyState,
  ErrorState,
  FloatingCartBar,
  MenuSkeleton,
  ProductCard,
  ProductRow,
  ResponsiveGrid,
  ScreenContainer,
  SegmentedTabs,
  Txt,
} from '@/components';
import { PRODUCT_ROW_HEIGHT } from '@/components/ProductCard';
import { useResponsive } from '@/hooks/useResponsive';
import { useCartStore, useCatalogStore } from '@/store';
import { ORDER_TYPES, ORDER_TYPE_SHORT } from '@/constants/orderTypes';
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

  const listRef = useRef<FlatList<Product>>(null);
  const pillsRef = useRef<ScrollView>(null);

  /**
   * Change category, then jump the list back to the top.
   *
   * This used to be `key={filter}` on the FlatList, which is the expensive way
   * to get the same scroll reset: React tears the whole list down and builds a
   * new one, discarding every mounted row and its layout. On "الكل" — 111
   * products — that remount is a visible stall on every single tap of the
   * category strip, which is exactly where it is least affordable.
   *
   * Keeping the list mounted and moving the offset costs nothing: `data` is a
   * different array, the rows re-render, and the scroll position is set without
   * a layout pass. The pill strip resets alongside it so the selected category
   * is not left scrolled off the edge.
   */
  const selectFilter = useCallback((next: Filter) => {
    setFilter(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    pillsRef.current?.scrollTo({ x: 0, animated: true });
  }, []);

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

        {/* Fulfilment. Built from ORDER_TYPES so this control, the cart and
            checkout cannot disagree about what the store offers — they each
            used to hardcode their own list, and all three sold delivery.

            Was also a hand-rolled copy of SegmentedTabs with `onPress` on the
            text, so only the glyphs responded to a tap. */}
        <SegmentedTabs
          tabs={ORDER_TYPES.map((k) => ({ key: k, label: ORDER_TYPE_SHORT[k] }))}
          value={orderType}
          onChange={setOrderType}
        />

        {/* category tabs — fixed-height band so it never overlaps the grid */}
        <View style={{ height: 46, marginBottom: spacing.md }}>
          <ScrollView
            ref={pillsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg, alignItems: 'center' }}
          >
            <CategoryPill label="الكل" active={filter === 'all'} onPress={() => selectFilter('all')} />
            {categories.map((c) => (
              <CategoryPill
                key={c.id}
                label={`${c.emoji} ${c.nameAr}`}
                active={filter === c.id}
                onPress={() => selectFilter(c.id)}
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
          // Rows in the shape they will take, not a spinner over a blank
          // screen. The catalog comes from Foodics over the network, and the
          // wait is long enough that "empty plus spinner" reads as broken.
          <View style={{ paddingHorizontal: spacing.lg }}>
            <MenuSkeleton />
          </View>
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
            ref={listRef}
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
          />
        )}
      </ScreenContainer>

      <FloatingCartBar bottom={70} />
    </>
  );
}
