import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  OptionChip,
  ProductImage,
  QtyStepper,
  Spinner,
  TextField,
  Txt,
} from '@/components';
import type { Product } from '@/types';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { selectionUnitPrice, type ProductSelection } from '@/utils/cart';
import { useResponsive } from '@/hooks/useResponsive';
import { useCartStore, useCatalogStore, toast } from '@/store';

/**
 * Wrapper: find the product in the catalog store (loaded from mock or backend).
 * If it isn't there yet (e.g. opened directly in backend mode), fetch the single
 * product. Show a spinner while resolving, then render the detail form.
 */
export function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storeProduct = useCatalogStore((s) => s.productById(id));
  const fetchProduct = useCatalogStore((s) => s.fetchProduct);
  const [fetched, setFetched] = useState<Product | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (storeProduct) return;
    let active = true;
    fetchProduct(id).then((p) => {
      if (active) {
        setFetched(p);
        setTried(true);
      }
    });
    return () => {
      active = false;
    };
  }, [id, storeProduct, fetchProduct]);

  const product = storeProduct ?? fetched ?? undefined;
  if (!product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        {tried ? (
          <Txt size={16} color={colors.textMuted}>
            المنتج غير متوفر
          </Txt>
        ) : (
          <Spinner />
        )}
      </View>
    );
  }
  return <ProductDetail product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const insets = useSafeAreaInsets();
  const { isTablet, select } = useResponsive();
  const productMaxWidth = select({ phone: 640, tablet: 600, largeTablet: 680 });
  const heroHeight = isTablet ? 320 : 240;
  const addProduct = useCartStore((s) => s.addProduct);

  const milks = product.addOns.filter((a) => a.group === 'milk');
  const extras = product.addOns.filter((a) => a.group === 'extra');

  const [sizeId, setSizeId] = useState(product.sizes.find((z) => z.id === 'M')?.id ?? product.sizes[0]?.id);
  const [milkId, setMilkId] = useState(milks[0]?.id);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState(1);

  const selection: ProductSelection = useMemo(
    () => ({
      sizeId,
      addOnIds: [milkId, ...extraIds].filter(Boolean) as string[],
      notes,
      qty,
    }),
    [sizeId, milkId, extraIds, notes, qty],
  );

  const unit = selectionUnitPrice(product, selection);
  const toggleExtra = (eid: string) =>
    setExtraIds((cur) => (cur.includes(eid) ? cur.filter((x) => x !== eid) : [...cur, eid]));

  const onAdd = () => {
    addProduct(product, selection);
    toast('أُضيف إلى السلة ✓');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, alignItems: 'center' }}
      >
        <View style={{ width: '100%', maxWidth: productMaxWidth }}>
        {/* hero */}
        <ProductImage emoji={product.emoji} image={product.image} height={heroHeight} emojiSize={isTablet ? 110 : 80} radiusKey={isTablet ? 'xl' : 'xs'} showTag={false} style={isTablet ? { marginTop: spacing.lg } : undefined}>
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: insets.top + 8,
              right: 18,
              width: 38,
              height: 38,
              borderRadius: radius.full,
              backgroundColor: 'rgba(255,255,255,0.9)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-forward" size={20} color={colors.ink} />
          </Pressable>
        </ProductImage>

        <View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Txt size={24} weight="black" color={colors.ink}>
                {product.nameAr}
              </Txt>
              <Txt size={13} latin color={colors.textFaint}>
                {product.nameEn}
              </Txt>
            </View>
            <Txt size={22} weight="black" color={colors.terracotta}>
              {formatRiyal(product.price)}
            </Txt>
          </View>

          <Txt size={14} color={colors.textMuted} style={{ marginTop: 10, lineHeight: 23 }}>
            {product.descriptionAr}
          </Txt>

          {product.calories ? (
            <Txt size={12} weight="bold" color={colors.textFaint} style={{ marginTop: 8 }}>
              🔥 {toArabicDigits(product.calories)} سعرة · ⏱ {toArabicDigits(product.preparationTime)} دقائق
            </Txt>
          ) : null}

          {/* sizes */}
          {product.sizes.length > 0 ? (
            <>
              <SectionLabel>الحجم</SectionLabel>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {product.sizes.map((z) => (
                  <OptionChip
                    key={z.id}
                    label={z.labelAr}
                    sublabel={z.priceDelta ? `${z.priceDelta > 0 ? '+' : ''}${toArabicDigits(z.priceDelta)} ﷼` : undefined}
                    selected={sizeId === z.id}
                    onPress={() => setSizeId(z.id)}
                    block
                  />
                ))}
              </View>
            </>
          ) : null}

          {/* milk */}
          {milks.length > 0 ? (
            <>
              <SectionLabel>الحليب</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {milks.map((m) => (
                  <OptionChip
                    key={m.id}
                    label={m.priceDelta ? `${m.labelAr} +${toArabicDigits(m.priceDelta)}` : m.labelAr}
                    selected={milkId === m.id}
                    onPress={() => setMilkId(m.id)}
                    variant="gold"
                    radiusKey="pill"
                  />
                ))}
              </View>
            </>
          ) : null}

          {/* extras */}
          {extras.length > 0 ? (
            <>
              <SectionLabel>إضافات</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {extras.map((e) => (
                  <OptionChip
                    key={e.id}
                    label={`${e.labelAr} +${toArabicDigits(e.priceDelta)}`}
                    selected={extraIds.includes(e.id)}
                    onPress={() => toggleExtra(e.id)}
                    variant="gold"
                    radiusKey="pill"
                  />
                ))}
              </View>
            </>
          ) : null}

          {/* notes */}
          <SectionLabel>ملاحظات خاصة</SectionLabel>
          <TextField
            placeholder="مثال: بدون سكر، حرارة عالية…"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          {/* quantity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['2xl'] }}>
            <Txt size={15} weight="extraBold" color={colors.ink}>
              الكمية
            </Txt>
            <QtyStepper value={qty} onInc={() => setQty((q) => q + 1)} onDec={() => setQty((q) => Math.max(1, q - 1))} />
          </View>
        </View>
        </View>
      </ScrollView>

      {/* sticky add */}
      <View
        style={{
          paddingHorizontal: spacing['2xl'],
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        }}
      >
        <View style={{ width: '100%', maxWidth: productMaxWidth, alignSelf: 'center' }}>
        <Button
          label={product.isAvailable ? 'أضف إلى السلة' : 'غير متوفر حاليًا'}
          trailing={product.isAvailable ? formatRiyal(unit * qty) : undefined}
          onPress={onAdd}
          disabled={!product.isAvailable}
        />
        </View>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginTop: spacing['2xl'], marginBottom: spacing.md }}>
      {children}
    </Txt>
  );
}
