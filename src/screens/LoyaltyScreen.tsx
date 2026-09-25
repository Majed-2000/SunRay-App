import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';
import { Card, EmptyState, ErrorState, Icon, ScreenContainer, Spinner, Txt } from '@/components';
import { toArabicDigits } from '@/utils/numerals';
import { useAuthStore, useLoyaltyStore } from '@/store';
import type { LoyaltyEvent } from '@/services/storeLoyalty';

/**
 * The customer's points, as the ledger actually holds them.
 *
 * This screen used to show a "buy 6 coffees, get the 7th free" stamp card, a
 * progress ring against a 200-point goal, bronze/silver/gold tiers and a list
 * of rewards from `src/data/rewards.ts`. None of that existed. The programme is
 * one point per riyal, carried over 1:1 from Boonus, and a customer holding
 * 2,546 real points was shown four filled cups.
 *
 * Three things follow from using the real ledger, and each removes something
 * this screen used to invent:
 *
 * 1. **No goal unless the server states one.** `threshold` is null until an
 *    admin confirms it, and the server will not guess. Neither will this
 *    screen — a ring drawn against an estimate is a promise the customer reads
 *    as a commitment.
 * 2. **No redeem buttons.** A reward is claimed by adding the rewarded product
 *    to the cart at price zero; the deduction happens inside `createStoreOrder`
 *    as the order is written. A coupon flow was built for this and deliberately
 *    scrapped.
 * 3. **A real history.** The ledger is event-sourced, so the customer can see
 *    where every point came from instead of a single opaque number.
 */
export function LoyaltyScreen() {
  const data = useLoyaltyStore((s) => s.data);
  const status = useLoyaltyStore((s) => s.status);
  const unlinked = useLoyaltyStore((s) => s.unlinked);
  const load = useLoyaltyStore((s) => s.load);
  const points = useLoyaltyStore((s) => s.points());
  const pointsToNext = useLoyaltyStore((s) => s.pointsToNextReward());
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && !isGuest) void load();
  }, [load, isAuthenticated, isGuest]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const header = (
    <View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.sm }}>
      <Txt size={24} weight="black" color={colors.ink}>
        نقاطي
      </Txt>
    </View>
  );

  // Points belong to a phone number, so there is nothing to show a guest.
  if (isGuest || !isAuthenticated) {
    return (
      <ScreenContainer padded={false} header={header}>
        <EmptyState
          icon="sun"
          title="سجّل دخولك لعرض نقاطك"
          subtitle="نقاطك مرتبطة برقم جوالك، وتنتقل معك بين الفرع والتطبيق"
        />
      </ScreenContainer>
    );
  }

  if (status === 'loading' && !data) {
    return (
      <ScreenContainer padded={false} header={header}>
        <Spinner label="نجلب نقاطك…" />
      </ScreenContainer>
    );
  }

  if (status === 'error' && !data) {
    return (
      <ScreenContainer padded={false} header={header}>
        <ErrorState onRetry={() => void load()} />
      </ScreenContainer>
    );
  }

  /**
   * `linked: false` is a real state, not a failure: this phone is not in the
   * ledger yet. Showing a zero balance would tell a customer who has been
   * buying coffee for a year that they have never earned anything.
   */
  if (unlinked) {
    return (
      <ScreenContainer padded={false} header={header}>
        <EmptyState
          icon="cup-hot"
          title="لم نجد نقاطًا لرقمك بعد"
          subtitle="اطلب من التطبيق أو أدخل رقمك عند الكاشير، وتبدأ نقاطك بالتجمّع"
        />
      </ScreenContainer>
    );
  }

  const hasGoal = data?.thresholdConfirmed && data.threshold != null && pointsToNext != null;
  const pct = hasGoal && data.threshold ? Math.min(100, Math.round((points / data.threshold) * 100)) : 0;

  return (
    <ScreenContainer padded={false} scroll={false} header={header}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.goldDeep}
            colors={[colors.goldDeep]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {/* balance */}
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
              نقطة
            </Txt>
          </View>

          {/* The bar appears only when the server has stated a target. */}
          {hasGoal ? (
            <>
              <View
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  marginTop: spacing.xl,
                  overflow: 'hidden',
                }}
              >
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.gold, borderRadius: 4 }} />
              </View>
              <Txt size={14} weight="extraBold" color={colors.gold} style={{ marginTop: spacing.md }}>
                {pointsToNext > 0
                  ? `باقي ${toArabicDigits(pointsToNext)} نقطة لـ${data?.rewardLabel ?? 'مكافأتك'}`
                  : `${data?.rewardLabel ?? 'مكافأتك'} جاهزة`}
              </Txt>
            </>
          ) : (
            <Txt size={13} color={colors.textGoldSoft} center style={{ marginTop: spacing.lg, lineHeight: 20 }}>
              تكسب {toArabicDigits(data?.pointsPerSar ?? 1)} نقطة عن كل ﷼ تنفقه
            </Txt>
          )}
        </View>

        {/* facts — every one of these comes from the ledger */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.lg }}>
          <StatCard value={toArabicDigits(data?.visits ?? 0)} label="زيارة" />
          <StatCard value={toArabicDigits(data?.lifetimeEarned ?? 0)} label="نقطة مكتسبة" accent />
          <StatCard value={toArabicDigits(data?.lifetimeRedeemed ?? 0)} label="نقطة مستبدلة" />
        </View>

        {/* Points lapse through INACTIVITY, not on a calendar date — an active
            customer never loses anything, so this only appears when it is
            actually close. */}
        {data?.expiryWarn && data.expiresAt ? (
          <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
            <Txt size={13} weight="extraBold" color={colors.danger}>
              نقاطك قد تنتهي قريبًا
            </Txt>
            <Txt size={12} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 19 }}>
              اطلب أي شيء لتبقى نقاطك سارية — تُحتسب المدة من آخر نشاط لك.
            </Txt>
          </Card>
        ) : null}

        {/* reward ladder, with the real products behind it */}
        {data?.rewards?.length ? (
          <>
            <Txt size={16} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
              مكافآتك
            </Txt>
            <View style={{ gap: 10, marginBottom: spacing.lg }}>
              {data.rewards.map((r, i) => (
                <View
                  key={`${r.points}-${i}`}
                  style={[
                    shadows.xs,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 13,
                      backgroundColor: colors.card,
                      borderRadius: radius.md,
                      padding: 13,
                      opacity: r.affordable ? 1 : 0.55,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.sm,
                      backgroundColor: colors.chipGold,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={r.affordable ? 'gift' : 'lock'} size={26} accent={r.affordable ? undefined : null} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={15} weight="extraBold" color={colors.ink}>
                      {r.label ?? data.rewardLabel}
                    </Txt>
                    <Txt size={12} color={colors.textFaint} style={{ marginTop: 2 }}>
                      {r.affordable
                        ? 'أضفها لسلّتك من القائمة'
                        : `باقي ${toArabicDigits(Math.max(0, r.points - points))} نقطة`}
                    </Txt>
                  </View>
                  <Txt size={14} weight="black" color={colors.goldDeep}>
                    {toArabicDigits(r.points)}
                  </Txt>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* history */}
        {data?.timeline?.length ? (
          <>
            <Txt size={16} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
              سجلّ النقاط
            </Txt>
            <Card radiusKey="lg" padding={0} style={{ overflow: 'hidden' }}>
              {data.timeline.map((e, i) => (
                <EventRow key={i} event={e} last={i === data.timeline.length - 1} />
              ))}
            </Card>
            {data.timelineTruncated ? (
              <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.sm }}>
                يُعرض أحدث ٦٠ حركة
              </Txt>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

/** One ledger movement. Sign comes from the event type, not from the number. */
function EventRow({ event, last }: { event: LoyaltyEvent; last: boolean }) {
  const credit = event.type === 'earn' || event.type === 'import' || event.type === 'adjust';
  const when = event.at ? new Date(event.at) : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderSoft,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt size={13} weight="extraBold" color={colors.ink}>
          {event.channelAr ?? labelFor(event.type)}
        </Txt>
        {when ? (
          <Txt size={11} color={colors.textFaint} style={{ marginTop: 2 }}>
            {toArabicDigits(when.toLocaleDateString('ar-SA'))}
          </Txt>
        ) : null}
      </View>
      <Txt size={14} weight="black" color={credit ? colors.success : colors.textMuted}>
        {credit ? '+' : '−'}
        {toArabicDigits(Math.abs(event.points))}
      </Txt>
    </View>
  );
}

function labelFor(type: LoyaltyEvent['type']): string {
  switch (type) {
    case 'earn':
      return 'نقاط من طلب';
    case 'import':
      return 'رصيد منقول';
    case 'adjust':
      return 'تعديل';
    case 'redeem':
      return 'استبدال';
    case 'expire':
      return 'انتهاء صلاحية';
    case 'reverse':
      return 'عكس حركة';
    default:
      return 'حركة';
  }
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card radiusKey="md" style={{ flex: 1, alignItems: 'center' }}>
      <Txt size={17} weight="black" color={accent ? colors.goldDeep : colors.ink}>
        {value}
      </Txt>
      <Txt size={10} color={colors.textFaint} center style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </Card>
  );
}
