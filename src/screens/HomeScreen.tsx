import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  BranchPickerSheet,
  FloatingCartBar,
  IconTile,
  LoyaltyCard,
  PhotoStrip,
  ProductCard,
  ResponsiveGrid,
  ScreenContainer,
  SectionHeader,
  Txt,
} from '@/components';
import { CONFIG } from '@/constants/config';
import { STORE_HAS_DELIVERY, STORE_HAS_GIFTCARDS, STORE_HAS_RESERVATION, STORE_HAS_WAITLIST } from '@/constants/features';
import type { IconName } from '@/components/icons/Icon';
import type { OrderType } from '@/types';
import { strings } from '@/i18n';
import { useResponsive } from '@/hooks/useResponsive';
import { greetingFor } from '@/utils/greeting';
import {
  useAuthStore,
  useBranchStore,
  useCartStore,
  useCatalogStore,
  useLoyaltyStore,
  useNotificationStore,
} from '@/store';

export function HomeScreen() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { gridColumns } = useResponsive();
  const user = useAuthStore((s) => s.user);
  const branch = useBranchStore((s) => s.current());
  const branchAuto = useBranchStore((s) => s.auto);
  const isGuest = useAuthStore((s) => s.isGuest);
  const hasLoyalty = useLoyaltyStore((s) => s.data != null);
  const loyaltyStatus = useLoyaltyStore((s) => s.status);
  const unlinked = useLoyaltyStore((s) => s.unlinked);
  const points = useLoyaltyStore((s) => s.points());
  const tierLabel = useLoyaltyStore((s) => s.tierLabel());
  const pointsToNext = useLoyaltyStore((s) => s.pointsToNextReward());
  const loyaltyThreshold = useLoyaltyStore((s) => s.data?.threshold ?? null);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const catalogProducts = useCatalogStore((s) => s.products);
  // Nothing on the live menu is flagged featured, so the section falls back to
  // coffee of the day — real, on the menu, and different every day.
  const flagged = useMemo(() => catalogProducts.filter((p) => p.isFeatured), [catalogProducts]);
  const coffeeOfDay = useMemo(() => catalogProducts.filter((p) => p.categoryId === 'قهوة اليوم'), [catalogProducts]);
  const featured = flagged.length > 0 ? flagged : coffeeOfDay;
  const featuredTitle = flagged.length > 0 ? 'المختصّة اليوم' : 'قهوة اليوم';
  const t = strings();


  // Recomputed per mount rather than per render: the band it lands in changes
  // maybe four times a day, and a customer who has the app open across the
  // boundary does not need the headline shifting under them mid-scroll.
  const greeting = useMemo(() => greetingFor(), []);

  /**
   * `points()` is `balance ?? 0`, so on its own it reads "٠ نقطة" while the
   * first load is in flight, after it failed, for a phone the ledger does not
   * know and for a guest — four different truths, none of them "zero". The
   * Loyalty tab already tells them apart; the card on Home has to as well.
   */
  const loyaltyCard = isGuest
    ? { points: null, note: 'سجّل دخولك لعرض نقاطك', onPress: () => router.push('/(tabs)/loyalty') }
    : unlinked
      ? { points: null, note: 'لم نجد نقاطًا لرقمك بعد', onPress: () => router.push('/(tabs)/loyalty') }
      : !hasLoyalty && loyaltyStatus === 'error'
        ? {
            points: null,
            note: 'تعذّر جلب نقاطك · اضغط لإعادة المحاولة',
            onPress: () => void useLoyaltyStore.getState().load(),
          }
        : !hasLoyalty
          ? { points: null, note: 'نجلب نقاطك…', onPress: () => router.push('/(tabs)/loyalty') }
          : { points, note: undefined, onPress: () => router.push('/(tabs)/loyalty') };

  const startOrder = (type: OrderType) => {
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
              accessibilityRole="button"
              accessibilityLabel={`الفرع: ${branch.nameAr}، ${branch.isOpen ? 'مفتوح' : 'مغلق'}. اضغط للتغيير`}
              style={({ pressed }) => [
                shadows.sm,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  backgroundColor: pressed ? colors.chip : colors.card,
                  borderRadius: radius.md,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Ionicons name="location" size={16} color={colors.goldDeep} />
              <View>
                <Txt size={9} weight="bold" color={colors.textFaint}>
                  {branchAuto ? 'فرعك الأقرب' : 'الفرع المحدد'}
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
              accessibilityRole="button"
              // The dot is decorative; the count is the thing worth announcing.
              accessibilityLabel={
                unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'
              }
              // Drawn at 38 to sit level with the branch pill; slop takes the
              // actual target past 44.
              hitSlop={6}
              style={({ pressed }) => [
                shadows.sm,
                {
                  width: 38,
                  height: 38,
                  borderRadius: radius.full,
                  backgroundColor: pressed ? colors.chip : colors.card,
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
              {greeting.eyebrow}
            </Txt>
            <Txt size={25} weight="black" color={colors.ink} style={{ marginTop: 2 }}>
              {greeting.ar}، {user?.name ?? 'ضيف'}
            </Txt>
          </View>

          {/* Loyalty card */}
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <LoyaltyCard
              points={loyaltyCard.points}
              note={loyaltyCard.note}
              tierLabel={tierLabel}
              pointsToNext={pointsToNext}
              goal={loyaltyThreshold}
              onPress={loyaltyCard.onPress}
            />
          </View>

          {/* Quick actions */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing['2xl'] }}>
            {/* Only what the store fulfils. Delivery, reservation and the
                waitlist each sat here while nothing behind them was real —
                see `constants/features.ts`. */}
            <IconTile icon="cup-hot" label="طلب مسبق" onPress={() => startOrder('pickup')} />
            <IconTile icon="car" label="سيارتي" onPress={() => startOrder('car')} />
            {STORE_HAS_DELIVERY ? (
              <IconTile icon="scooter" label="توصيل" onPress={() => startOrder('delivery')} />
            ) : null}
            {STORE_HAS_RESERVATION ? (
              <IconTile icon="seat" label="حجز جلسة" onPress={() => router.push('/reserve')} />
            ) : null}
            {STORE_HAS_WAITLIST ? (
              <IconTile icon="hourglass" label="انتظار" onPress={() => router.push('/waitlist')} />
            ) : null}
            <IconTile icon="sun" label="نقاطي" onPress={() => router.push('/(tabs)/loyalty')} />
            <IconTile icon="receipt" label="طلباتي" onPress={() => router.push('/(tabs)/orders')} />
          </View>

          {/* The offers strip advertised three promotions the store does not
              run (20% off, 10th drink free, WELCOME). Removed until offers
              come from the store. */}

          {/* Featured — hidden entirely while nothing is flagged `isFeatured`,
              rather than a heading and a «عرض الكل» sitting above blank space. */}
          {featured.length > 0 && (
            <>
              <View style={{ paddingHorizontal: spacing['2xl'] }}>
                <SectionHeader title={featuredTitle} actionLabel="عرض الكل" onAction={() => router.push('/(tabs)/menu')} />
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
            </>
          )}

          {/* Services — what sunray.sa offers, in the order its home page lists
              them. Rows of four so the tiles keep the quick-action width. */}
          <View style={{ paddingHorizontal: spacing['2xl'], marginTop: spacing.sm }}>
            <SectionHeader title="خدماتنا" />
          </View>
          <View style={{ gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing['2xl'] }}>
            {chunk(SERVICES, 4).map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                {row.map((sv) => (
                  <IconTile key={sv.label} icon={sv.icon} label={sv.label} onPress={() => router.push(sv.href)} />
                ))}
                {/* Pad a short last row so its tiles stay the same width. */}
                {Array.from({ length: 4 - row.length }, (_, k) => (
                  <View key={`pad${k}`} style={{ flex: 1 }} />
                ))}
              </View>
            ))}
          </View>

          <PhotoStrip />
        </ScrollView>
      </ScreenContainer>

      <FloatingCartBar bottom={70} />
      <BranchPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}

type Service = { icon: IconName; label: string; href: Parameters<typeof router.push>[0] };

const SERVICES: Service[] = [
  { icon: 'search', label: 'ماسح الطلب', href: '/scan' },
  { icon: 'car', label: 'منيو Go', href: '/go-menu' },
  { icon: 'pin', label: 'فروعنا', href: '/branches' },
  ...(STORE_HAS_GIFTCARDS ? [{ icon: 'gift' as const, label: 'باقات الإهداء', href: '/gift' as const }] : []),
  { icon: 'jug', label: 'كاترينق', href: '/catering' },
  { icon: 'ticket', label: 'تعويضاتي', href: '/compensations' },
  { icon: 'chat', label: 'الدعم الفني', href: '/support' },
  { icon: 'sparkle', label: 'تحدي ساني', href: '/sany' },
];

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
