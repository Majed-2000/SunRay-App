import { useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { useResponsive } from '@/hooks/useResponsive';
import { useCartStore, useCatalogStore } from '@/store';

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

  const list = products.filter((p) => filter === 'all' || p.categoryId === filter);

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
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: 140 }}>
          <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
            {loading ? (
              <Spinner label="نحضّر القائمة لك…" />
            ) : error ? (
              <ErrorState onRetry={reload} />
            ) : list.length === 0 ? (
              <EmptyState emoji="🔍" title="لا توجد أصناف" subtitle="جرّب تصنيفًا آخر" />
            ) : isTablet ? (
              <View style={{ paddingHorizontal: spacing.lg }}>
                <ResponsiveGrid
                  data={list}
                  columns={gridColumns}
                  keyExtractor={(p) => p.id}
                  renderItem={(p) => (
                    <ProductCard
                      product={p}
                      onPress={() => router.push(`/product/${p.id}`)}
                      onAdd={() => quickAdd(p)}
                    />
                  )}
                />
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.lg, gap: 12 }}>
                {list.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onPress={() => router.push(`/product/${p.id}`)}
                    onAdd={() => quickAdd(p)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>

      <FloatingCartBar bottom={70} />
    </>
  );
}
