import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, EmptyState, Header, ScreenContainer, Spinner, Txt } from '@/components';
import { lookupAutoCoupon, type AutoCouponLookup } from '@/services/storeOffers';
import { useAuthStore } from '@/store';
import { toArabicDigits } from '@/utils/numerals';

/**
 * Offers — only what the store actually holds for this customer.
 *
 * This screen used to advertise «خصم ٢٠٪ على القهوة المقطّرة», «مشروبك العاشر
 * علينا» and codes (COFFEE20, WELCOME, SUN10) that the server rejects. The real
 * sources are the customer's automatic coupon (`myAutoCoupon`, tied to their
 * phone) and any code they were given, which is typed in the cart and checked
 * by the server there.
 */
export function OffersScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const [loading, setLoading] = useState(!isGuest);
  const [result, setResult] = useState<AutoCouponLookup | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isGuest) return;
    let active = true;
    setLoading(true);
    // Asked without a cart: we only want to know whether one exists. A coupon
    // with a minimum answers `below_min` here and still counts as existing; the
    // server applies it at order time once the cart reaches the minimum.
    lookupAutoCoupon()
      .then((r) => active && setResult(r))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isGuest, attempt]);

  const auto = result?.status === 'found' ? result.coupon : null;
  const belowMin = result?.status === 'found' && result.belowMin;

  const value =
    auto?.kind === 'percent'
      ? `خصم ${toArabicDigits(auto.value ?? 0)}٪`
      : auto?.value
        ? `خصم ${toArabicDigits(auto.value)} ﷼`
        : 'خصم خاص بك';

  return (
    <ScreenContainer header={<Header showBack title="العروض والكوبونات" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg }}>
        {loading ? (
          <Spinner />
        ) : auto ? (
          <Card radiusKey="lg">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.sm,
                  backgroundColor: colors.chipGold,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="pricetag" size={20} color={colors.goldDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="black" color={colors.ink}>
                  {value}
                </Txt>
                <Txt size={12} color={colors.textMuted}>
                  {belowMin
                    ? 'يُطبَّق تلقائيًا عندما يبلغ طلبك الحد الأدنى — لا تحتاج كودًا'
                    : 'يُطبَّق تلقائيًا على طلبك القادم — لا تحتاج كودًا'}
                </Txt>
              </View>
            </View>
          </Card>
        ) : result?.status === 'error' ? (
          // A failed request is not "no offers"; saying so would hide a coupon
          // the customer does have.
          <EmptyState
            icon="alert"
            title="تعذّر تحميل عروضك"
            subtitle="تحقق من اتصالك ثم حاول مرة أخرى"
            actionLabel="إعادة المحاولة"
            onAction={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <EmptyState
            icon="tag"
            title="لا توجد عروض خاصة بك الآن"
            subtitle={isGuest ? 'سجّل دخولك لترى العروض المرتبطة برقمك' : 'تابعنا على إنستقرام @sunray.sa لأحدث العروض'}
          />
        )}

        <Card radiusKey="lg">
          <Txt size={14} weight="extraBold" color={colors.ink}>
            عندك كود خصم؟
          </Txt>
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 19 }}>
            أدخله في السلة قبل الدفع، ونتحقق منه مباشرة.
          </Txt>
          <Button label="الذهاب إلى السلة" variant="outline" size="sm" style={{ marginTop: spacing.md }} onPress={() => router.push('/cart')} />
        </Card>
      </View>
    </ScreenContainer>
  );
}
