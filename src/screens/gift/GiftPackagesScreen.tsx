import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  GiftCardPreview,
  Header,
  Icon,
  ScreenContainer,
  Spinner,
  Txt,
} from '@/components';
import { giftDesigns } from '@/data';
import { formatRiyal } from '@/utils/numerals';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthStore, toast } from '@/store';
import {
  createSelfGift,
  describeGiftError,
  getGiftCard,
  packageContents,
  subscribeGiftPackages,
  type SelfGiftPackage,
} from '@/services/storeGifts';

/**
 * Gifts started on this phone and not yet paid, by package.
 *
 * `createSelfGift` writes a new gift every time it is called. A customer who
 * opens a package, backs out to look at the others and comes back would leave
 * an unpaid gift behind on every pass — each one listed on their account as
 * «بانتظار الدفع». Coming back to the same package within the window resumes
 * the same gift instead, after the server confirms it is still unpaid.
 * In memory only: a gift abandoned across an app restart is the server's to
 * expire, and resuming it from a stale copy here could reopen a paid one.
 */
const startedGifts = new Map<string, { id: string; at: number }>();
const RESUME_MS = 30 * 60 * 1000;

/**
 * «باقات الإهداء» — the packages a customer can buy as a gift.
 *
 * What is listed is what the website's gift page lists, from the same node,
 * with the same filter. The recipient chooses the actual cups and dessert when
 * they open the gift, so a package is sold by what it contains, not by items.
 */
export function GiftPackagesScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signedIn = isAuthenticated && !isGuest;
  const { contentMaxWidth } = useResponsive();

  const [packages, setPackages] = useState<SelfGiftPackage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setFailed(false);
    return subscribeGiftPackages(
      (list) => {
        setPackages(list);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [attempt]);

  const buy = async (p: SelfGiftPackage) => {
    // Same rule as checkout: no anonymous purchases. The site signs visitors
    // in anonymously; the app ties the gift to the customer's account so it
    // shows in «هداياي» and can be shared again later.
    if (!signedIn) {
      toast('سجّل دخولك لتُهدي');
      router.push('/(auth)/login');
      return;
    }
    if (busy) return;
    setBusy(p.id);
    try {
      const prior = startedGifts.get(p.id);
      if (prior && Date.now() - prior.at < RESUME_MS) {
        const g = await getGiftCard(prior.id).catch(() => null);
        const unpaid = g && g.status !== 'active' && g.status !== 'used' && g.status !== 'cancelled';
        if (unpaid) {
          router.push(`/gift/${prior.id}`);
          return;
        }
        startedGifts.delete(p.id);
      }
      const id = await createSelfGift(p.id);
      startedGifts.set(p.id, { id, at: Date.now() });
      router.push(`/gift/${id}`);
    } catch (e) {
      toast(/unauthenticated/.test(String(e)) ? describeGiftError(e) : 'تعذّر بدء الطلب — حاول مجدداً');
    } finally {
      setBusy(null);
    }
  };

  const mineLink = (
    <Pressable
      onPress={() => router.push('/gift/mine')}
      accessibilityRole="button"
      hitSlop={10}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.55 : 1 })}
    >
      <Icon name="gift" size={20} />
      <Txt size={13} weight="extraBold" color={colors.goldDeep}>
        هداياي
      </Txt>
    </Pressable>
  );

  return (
    <ScreenContainer
      scroll={false}
      padded={false}
      header={
        <View style={{ paddingHorizontal: spacing['2xl'] }}>
          <Header showBack title="باقات الإهداء" right={mineLink} />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['5xl'] }}>
        <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          {/* The three faces the sender will choose from — the real art. */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: spacing.lg }}>
            {giftDesigns.map((d) => (
              <GiftCardPreview key={d.id} design={d} size="sm" style={{ width: 92 }} />
            ))}
          </View>

          <Txt size={13} color={colors.textMuted} center style={{ lineHeight: 21, marginBottom: spacing.xl }}>
            اختر باقة، اكتب إهداءك واختر تصميم البطاقة، ثم أرسل الرابط لمن تحب.{'\n'}
            المستلِم يختار قهوته وحلاه ويستلمها من الفرع.
          </Txt>

          {failed && !packages ? (
            <ErrorState message="تعذّر تحميل الباقات" onRetry={() => setAttempt((n) => n + 1)} />
          ) : packages === null ? (
            <Spinner label="جارٍ تحميل الباقات…" fill={false} />
          ) : packages.length === 0 ? (
            <EmptyState
              icon="gift"
              title="لا توجد باقات متاحة حالياً"
              subtitle="تواصل مع الدعم الفني وسنجهّز لك باقتك."
              actionLabel="تواصل معنا"
              onAction={() => router.push('/support')}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {packages.map((p) => {
                const contents = packageContents(p);
                return (
                  <Card key={p.id} radiusKey="lg">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: radius.md,
                          backgroundColor: colors.chipGold,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="gift" size={26} />
                      </View>
                      <Txt size={16} weight="black" color={colors.ink} style={{ flex: 1 }} numberOfLines={2}>
                        {p.name}
                      </Txt>
                      <Txt size={16} weight="black" color={colors.goldDeep}>
                        {formatRiyal(p.priceSar)}
                      </Txt>
                    </View>
                    <Txt size={13} color={colors.textSecondary} style={{ marginTop: spacing.md, lineHeight: 21 }}>
                      {contents || 'بطاقة إهداء'}
                    </Txt>
                    {contents ? (
                      <Txt size={12} color={colors.textFaint} style={{ marginTop: 2 }}>
                        يختارها المستلِم عند فتح الهديّة
                      </Txt>
                    ) : null}
                    <Button
                      label="أهدِ الآن"
                      variant="gold"
                      onPress={() => void buy(p)}
                      loading={busy === p.id}
                      disabled={busy !== null && busy !== p.id}
                      style={{ marginTop: spacing.lg }}
                    />
                  </Card>
                );
              })}
            </View>
          )}

          <Pressable onPress={() => router.push('/support')} accessibilityRole="link" hitSlop={8} style={{ marginTop: spacing.xl }}>
            <Txt size={12} color={colors.textMuted} center style={{ lineHeight: 19 }}>
              تبي باقة مخصّصة لمناسبة أو عدد أكبر؟{' '}
              <Txt size={12} weight="extraBold" color={colors.goldDeep}>
                تواصل مع الدعم الفني
              </Txt>
            </Txt>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
