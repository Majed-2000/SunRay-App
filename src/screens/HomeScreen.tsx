import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  BranchPickerSheet,
  Card,
  FloatingCartBar,
  GiftCardPreview,
  IconTile,
  LoyaltyCard,
  OfferCard,
  ProductCard,
  ResponsiveGrid,
  ScreenContainer,
  SectionHeader,
  Txt,
} from '@/components';
import { featuredProducts, giftDesigns, offers } from '@/data';
import { CONFIG } from '@/constants/config';
import { strings } from '@/i18n';
import { useResponsive } from '@/hooks/useResponsive';
import {
  useAuthStore,
  useBranchStore,
  useCartStore,
  useLoyaltyStore,
  useNotificationStore,
} from '@/store';

export function HomeScreen() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { gridColumns } = useResponsive();
  const user = useAuthStore((s) => s.user);
  const branch = useBranchStore((s) => s.current());
  const branchAuto = useBranchStore((s) => s.auto);
  const points = useLoyaltyStore((s) => s.points);
  const tier = useLoyaltyStore((s) => s.tier());
  const pointsToNext = useLoyaltyStore((s) => s.pointsToNextDrink());
  const setOrderType = useCartStore((s) => s.setOrderType);
  const unreadCount = useNotificationStore((s) => s.unreadCount());

  const featured = featuredProducts();
  const t = strings();

  const startOrder = (type: 'pickup' | 'delivery') => {
    setOrderType(type);
    router.push('/(tabs)/menu');
  };

  return (
    <>
      <ScreenContainer scroll={false} padded={false}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {/* Location bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing['2xl'],
              paddingTop: spacing.sm,
              paddingBottom: spacing.md,
            }}
          >
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={[
                shadows.sm,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Ionicons name="location" size={16} color={colors.terracotta} />
              <View>
                <Txt size={9} weight="bold" color={colors.textFaint}>
                  {branchAuto ? 'فرعك الأقرب 📡' : 'الفرع المحدد'}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Txt size={13} weight="extraBold" color={colors.ink}>
                    {branch.nameAr}
                  </Txt>
                  <Txt size={10} weight="bold" color={branch.isOpen ? colors.success : colors.textFaint}>
                    {branch.isOpen ? '● مفتوح' : '○ مغلق'}
                  </Txt>
                </View>
              </View>
              <Ionicons name="chevron-down" size={14} color={colors.ink} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/notifications')}
              style={[
                shadows.sm,
                {
                  width: 38,
                  height: 38,
                  borderRadius: radius.full,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.ink} />
              {unreadCount > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 9,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.notification,
                    borderWidth: 1.5,
                    borderColor: colors.card,
                  }}
                />
              ) : null}
            </Pressable>
          </View>

          {/* Greeting */}
          <View style={{ paddingHorizontal: spacing['2xl'], marginBottom: spacing.lg }}>
            <Txt size={12} weight="bold" latin tracking={1.5} color={colors.textFaint}>
              GOOD MORNING ☀
            </Txt>
            <Txt size={25} weight="black" color={colors.ink} style={{ marginTop: 2 }}>
              صباح الإشراق، {user?.name ?? 'ضيف'}
            </Txt>
          </View>

          {/* Loyalty card */}
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <LoyaltyCard
              points={points}
              tierLabel={t.tier[tier]}
              pointsToNext={pointsToNext}
              goal={CONFIG.FREE_DRINK_AT}
              onPress={() => router.push('/(tabs)/loyalty')}
            />
          </View>

          {/* Quick actions */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing['2xl'] }}>
            <IconTile emoji="☕" label="طلب مسبق" tint="#fbe9c4" onPress={() => startOrder('pickup')} />
            <IconTile emoji="🛵" label="توصيل" tint="#f3ddc8" onPress={() => startOrder('delivery')} />
            <IconTile emoji="🪑" label="حجز جلسة" tint="#e3ecd9" onPress={() => router.push('/reserve')} />
            <IconTile emoji="⏳" label="انتظار" tint="#e9e0d0" onPress={() => router.push('/waitlist')} />
          </View>

          {/* Offers strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.lg }}
            style={{ marginBottom: spacing['2xl'] }}
          >
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} width={230} onPress={() => router.push('/offers')} />
            ))}
          </ScrollView>

          {/* Featured */}
          <View style={{ paddingHorizontal: spacing['2xl'] }}>
            <SectionHeader title="المختصّة اليوم" actionLabel="عرض الكل" onAction={() => router.push('/(tabs)/menu')} />
          </View>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ResponsiveGrid
              data={featured}
              columns={gridColumns}
              keyExtractor={(p) => p.id}
              renderItem={(p) => (
                <ProductCard
                  product={p}
                  onPress={() => router.push(`/product/${p.id}`)}
                  onAdd={() => useCartStore.getState().quickAdd(p)}
                />
              )}
            />
          </View>

          {/* Gift cards */}
          <View style={{ paddingHorizontal: spacing['2xl'], marginTop: spacing.sm }}>
            <SectionHeader title="بطاقات الإهداء 🎁" subtitle="أهدِ لحظة مشرقة" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.lg }}
          >
            {giftDesigns.map((d, i) => (
              <GiftCardPreview
                key={d.id}
                design={d}
                amount={CONFIG.GIFT_AMOUNT_PRESETS[i] ?? 100}
                size="sm"
                footerEnd="أهدِ ←"
                style={{ width: 170 }}
              />
            ))}
          </ScrollView>

          <Pressable onPress={() => router.push('/gift')} style={{ alignItems: 'center', marginTop: spacing.lg }}>
            <Card padding={14} radiusKey="md" style={{ marginHorizontal: spacing.lg }}>
              <Txt size={14} weight="extraBold" color={colors.terracotta}>
                تصفّح كل بطاقات الإهداء ←
              </Txt>
            </Card>
          </Pressable>
        </ScrollView>
      </ScreenContainer>

      <FloatingCartBar bottom={70} />
      <BranchPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
