import { View } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Card, ScreenContainer, Txt } from '@/components';
import { rewards } from '@/data';
import { CONFIG } from '@/constants/config';
import { strings } from '@/i18n';
import { toArabicDigits } from '@/utils/numerals';
import { useLoyaltyStore, toast } from '@/store';

export function LoyaltyScreen() {
  const points = useLoyaltyStore((s) => s.points);
  const visits = useLoyaltyStore((s) => s.visits);
  const tier = useLoyaltyStore((s) => s.tier());
  const pointsToNext = useLoyaltyStore((s) => s.pointsToNextDrink());
  const redeem = useLoyaltyStore((s) => s.redeem);
  const cupCount = useLoyaltyStore((s) => s.cupCount);
  const cupsToFree = useLoyaltyStore((s) => s.cupsToFreeCoffee());
  const freeReady = useLoyaltyStore((s) => s.freeCoffeeReady());
  const redeemFreeCoffee = useLoyaltyStore((s) => s.redeemFreeCoffee);
  const t = strings();
  const cupGoal = CONFIG.LOYALTY_CUP_GOAL;
  const cupsShown = Math.min(cupCount, cupGoal);

  const pct = Math.min(100, Math.round((points / CONFIG.FREE_DRINK_AT) * 100));

  return (
    <ScreenContainer
      padded={false}
      header={
        <View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.sm }}>
          <Txt size={24} weight="black" color={colors.ink}>
            نظام الولاء
          </Txt>
        </View>
      }
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] }}>
        {/* points hero */}
        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: radius['2xl'],
            padding: spacing['2xl'],
            alignItems: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              width: 160,
              height: 160,
              borderRadius: 80,
              borderWidth: 10,
              borderColor: colors.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt size={44} weight="black" color={colors.white} style={{ lineHeight: 48 }}>
              {toArabicDigits(points)}
            </Txt>
            <Txt size={12} color={colors.textGoldSoft}>
              نقطة مشرقة
            </Txt>
          </View>
          <View style={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: '#4a3d2c', marginTop: spacing.xl, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.gold, borderRadius: 4 }} />
          </View>
          <Txt size={14} weight="extraBold" color={colors.gold} style={{ marginTop: spacing.md }}>
            {pointsToNext > 0 ? `باقي ${toArabicDigits(pointsToNext)} نقطة لمشروبك المجاني` : 'لديك مشروب مجاني جاهز 🎉'}
          </Txt>
        </View>

        {/* tier + visits */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.lg }}>
          <StatCard value={t.tier[tier]} label="مستواك الحالي" accent />
          <StatCard value={toArabicDigits(visits)} label="زيارة هذا الشهر" />
        </View>

        {/* coffee stamp card — Path A "buy 6, get the 7th free" */}
        <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Txt size={15} weight="black" color={colors.ink}>
              بطاقة القهوة ☕
            </Txt>
            <Txt size={12} color={colors.textFaint}>
              {toArabicDigits(cupsShown)}/{toArabicDigits(cupGoal)}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {Array.from({ length: cupGoal }).map((_, i) => {
              const filled = i < cupsShown;
              return (
                <View
                  key={i}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: filled ? colors.gold : colors.chip,
                    borderWidth: filled ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Txt size={18} style={{ opacity: filled ? 1 : 0.4 }}>
                    {i === cupGoal - 1 ? '🎁' : '☕'}
                  </Txt>
                </View>
              );
            })}
          </View>
          <Txt size={12} color={colors.textMuted} style={{ marginTop: spacing.md, lineHeight: 19 }}>
            {freeReady
              ? 'جمعت أكوابك — استبدلها بقهوة مجانية على الفرع 🎉'
              : `اشترِ ${toArabicDigits(cupsToFree)} أكواب قهوة إضافية واحصل على الكوب التالي مجانًا.`}
          </Txt>
          <Button
            label={freeReady ? 'استبدل قهوتك المجانية' : 'كيف تعمل؟'}
            variant={freeReady ? 'gold' : 'outline'}
            size="sm"
            style={{ marginTop: spacing.md }}
            onPress={() => {
              if (freeReady) redeemFreeCoffee();
              else toast('اكسب كوبًا عن كل قهوة تطلبها — عند ٦ أكواب يصبح الكوب التالي مجانيًا.');
            }}
          />
        </Card>

        {/* tiers explainer */}
        <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
          <Txt size={14} weight="black" color={colors.ink} style={{ marginBottom: spacing.sm }}>
            كيف تكسب النقاط؟
          </Txt>
          <Txt size={13} color={colors.textMuted} style={{ lineHeight: 21 }}>
            اكسب نقطة واحدة عن كل ﷼ تنفقه. كلما زادت نقاطك ارتقى مستواك:
            برونزي ← فضي ← ذهبي، مع مزايا ومكافآت أكبر في كل مستوى.
          </Txt>
        </Card>

        {/* rewards */}
        <Txt size={16} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
          استبدل نقاطك
        </Txt>
        <View style={{ gap: 10 }}>
          {rewards.map((r) => {
            const affordable = points >= r.cost;
            return (
              <View
                key={r.id}
                style={[
                  shadows.xs,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 13,
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                    padding: 13,
                  },
                ]}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.sm,
                    backgroundColor: colors.chipGold,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={22}>{r.emoji}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={15} weight="extraBold" color={colors.ink}>
                    {r.nameAr}
                  </Txt>
                  <Txt size={11} latin color={colors.textFaint}>
                    {r.nameEn}
                  </Txt>
                </View>
                <Button
                  label={`${toArabicDigits(r.cost)} نقطة`}
                  size="sm"
                  fullWidth={false}
                  variant={affordable ? 'gold' : 'ghost'}
                  onPress={() => redeem(r)}
                  style={!affordable ? { backgroundColor: colors.chip } : undefined}
                />
              </View>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card radiusKey="md" style={{ flex: 1, alignItems: 'center' }}>
      <Txt size={19} weight="black" color={accent ? colors.terracotta : colors.ink}>
        {value}
      </Txt>
      <Txt size={11} color={colors.textFaint} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </Card>
  );
}
