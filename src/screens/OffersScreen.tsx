import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Card, EmptyState, Header, OfferCard, ScreenContainer, SectionHeader, Txt } from '@/components';
import { coupons, offers } from '@/data';
import { toast } from '@/store';

export function OffersScreen() {
  return (
    <ScreenContainer header={<Header showBack title="العروض والكوبونات" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <View style={{ gap: 12, marginBottom: spacing.xl }}>
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} style={{ width: '100%' }} />
          ))}
        </View>

        <SectionHeader title="أكواد الخصم" />
        {coupons.length === 0 ? (
          <EmptyState emoji="🏷️" title="لا توجد كوبونات حاليًا" subtitle="تابعنا — عروض مشرقة قادمة قريبًا ☀" />
        ) : null}
        <View style={{ gap: 10 }}>
          {coupons.map((c) => (
            <Card key={c.code} radiusKey="lg" onPress={() => toast(`انسخ الكود ${c.code} واستخدمه في السلة`)}>
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
                  <Ionicons name="pricetag" size={20} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={15} weight="black" color={colors.ink} latin>
                    {c.code}
                  </Txt>
                  <Txt size={12} color={colors.textMuted}>
                    {c.descriptionAr}
                  </Txt>
                </View>
                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Txt size={12} weight="extraBold" color={colors.terracotta}>
                    نسخ
                  </Txt>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}
