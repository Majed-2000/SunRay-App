import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/types';
import { colors, radius, shadows, spacing } from '@/theme';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { Txt } from './Txt';
import { Card } from './Card';
import { ProductImage } from './ProductImage';

export interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  onAdd?: () => void;
}

/** Grid card used in featured / tablet menu grids. */
export function ProductCard({ product, onPress, onAdd }: ProductCardProps) {
  const badge = product.tags[0];
  return (
    <Card onPress={onPress} padding={12} radiusKey="xl" shadow="card" style={{ flex: 1 }}>
      <ProductImage emoji={product.emoji} image={product.image} height={120} emojiSize={46}>
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: colors.gold,
              borderRadius: radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Txt size={9} weight="extraBold" color={colors.inkDeep}>
              {badge}
            </Txt>
          </View>
        ) : null}
      </ProductImage>

      <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginTop: 10 }} numberOfLines={1}>
        {product.nameAr}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <Txt size={11} latin color={colors.textFaint} numberOfLines={1} style={{ flexShrink: 1 }}>
          {product.nameEn}
        </Txt>
        {product.rating ? (
          <>
            <Txt size={11} color={colors.gold}>
              ★
            </Txt>
            <Txt size={11} weight="bold" color={colors.textSecondary}>
              {toArabicDigits(product.rating.toFixed(1))}
            </Txt>
          </>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 10,
        }}
      >
        <Txt size={15} weight="black" color={colors.ink}>
          {formatRiyal(product.price)}
        </Txt>
        <AddButton onPress={onAdd} disabled={!product.isAvailable} />
      </View>
    </Card>
  );
}

/** Horizontal list row used in the menu list. */
function ProductRowBase({ product, onPress, onAdd }: ProductCardProps) {
  const sold = !product.isAvailable;
  return (
    <Pressable
      onPress={sold ? undefined : onPress}
      style={({ pressed }) => [
        shadows.sm,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: 12,
          opacity: sold ? 0.62 : pressed ? 0.94 : 1,
        },
      ]}
    >
      <ProductImage
        emoji={product.emoji}
        image={product.image}
        height={66}
        emojiSize={24}
        radiusKey="md"
        showTag={false}
        style={{ width: 66 }}
      >
        {sold ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(240,234,224,0.82)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={22} color="#c8a878" />
          </View>
        ) : null}
      </ProductImage>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Txt size={15} weight="extraBold" color={colors.ink} numberOfLines={1}>
            {product.nameAr}
          </Txt>
          {sold ? (
            <View
              style={{
                backgroundColor: colors.terracotta,
                borderRadius: radius.pill,
                paddingHorizontal: 7,
                paddingVertical: 3,
              }}
            >
              <Txt size={9} weight="extraBold" color={colors.white}>
                نفذت الكمية
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt size={11} latin color={colors.textFaint}>
          {product.nameEn}
        </Txt>
        <Txt size={11} color={colors.textMuted} numberOfLines={2} style={{ marginTop: 3, lineHeight: 16 }}>
          {product.descriptionAr}
        </Txt>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Txt size={14} weight="black" color={colors.ink}>
          {formatRiyal(product.price)}
        </Txt>
        {sold ? (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.full,
              backgroundColor: '#e8e0d4',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </View>
        ) : (
          <AddButton onPress={onAdd} gold />
        )}
      </View>
    </Pressable>
  );
}

function AddButton({
  onPress,
  disabled,
  gold,
}: {
  onPress?: () => void;
  disabled?: boolean;
  gold?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      style={({ pressed }) => [
        shadows.sm,
        {
          width: 30,
          height: 30,
          borderRadius: radius.full,
          backgroundColor: disabled ? colors.borderSoft : gold ? colors.gold : colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name="add" size={18} color={gold ? colors.inkDeep : colors.white} />
    </Pressable>
  );
}

/**
 * Fixed row height, exported so FlatList can use getItemLayout and skip
 * measuring 111 rows: 66px image + 12px padding top and bottom.
 */
export const PRODUCT_ROW_HEIGHT = 90;

/**
 * Memoised: without this every parent re-render (a category tap, a cart change)
 * re-renders every mounted row. Product objects are replaced wholesale by the
 * catalog store, so identity comparison is enough.
 */
export const ProductRow = memo(ProductRowBase);
