import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  EmptyState,
  GiftCardPreview,
  Header,
  ResponsiveGrid,
  ScreenContainer,
  SectionHeader,
  Txt,
} from '@/components';
import { giftDesigns, giftDesignById } from '@/data';
import { CONFIG } from '@/constants/config';
import { strings } from '@/i18n';
import { formatDateAr } from '@/utils/date';
import { useResponsive } from '@/hooks/useResponsive';
import { useGiftStore } from '@/store';

const STATUS_COLOR = { active: colors.success, used: colors.textMuted, expired: colors.danger };

export function GiftListScreen() {
  const cards = useGiftStore((s) => s.cards);
  const { isTablet } = useResponsive();
  const t = strings();

  return (
    <ScreenContainer
      scroll={false}
      padded={false}
      header={
        <View style={{ paddingHorizontal: spacing['2xl'] }}>
          <Header showBack title="بطاقات الإهداء" />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['4xl'] }}>
        <Txt size={13} color={colors.textMuted} style={{ paddingHorizontal: spacing['2xl'], marginBottom: spacing.lg, lineHeight: 20 }}>
          أهدِ رصيدًا لمن تحب 🎁 — يُضاف مبلغ البطاقة إلى محفظة المستلم عند استبدالها.
        </Txt>

        {/* create new — pick an amount/design */}
        <View style={{ paddingHorizontal: spacing['2xl'] }}>
          <SectionHeader title="أنشئ بطاقة جديدة" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.lg }}>
          {giftDesigns.map((d, i) => {
            const amount = CONFIG.GIFT_AMOUNT_PRESETS[i] ?? 100;
            return (
              <View key={d.id} style={{ width: 185 }}>
                <GiftCardPreview design={d} amount={amount} size="sm" footerEnd="أهدِ ←" />
                <Txt
                  size={13}
                  weight="extraBold"
                  color={colors.terracotta}
                  center
                  style={{ marginTop: 8 }}
                  onPress={() => router.push(`/gift/create?designId=${d.id}&amount=${amount}`)}
                >
                  اهدِ هذه البطاقة
                </Txt>
              </View>
            );
          })}
        </ScrollView>

        {/* my cards — full-width preview, details below */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing['2xl'] }}>
          <View style={{ paddingHorizontal: spacing.sm }}>
            <SectionHeader title="بطاقاتي" />
          </View>
          {cards.length === 0 ? (
            <EmptyState emoji="🎁" title={t.empty.gifts} subtitle="أنشئ بطاقتك الأولى وأهدِ لحظة مشرقة" />
          ) : (
            <ResponsiveGrid
              data={cards}
              columns={isTablet ? 2 : 1}
              gap={16}
              keyExtractor={(c) => c.id}
              renderItem={(c) => {
                const design = giftDesignById(c.designId);
                return (
                  <View>
                    <GiftCardPreview
                      design={design}
                      amount={c.amount}
                      footerStart={c.direction === 'sent' ? `إلى ${c.recipientName}` : `من ${c.senderName}`}
                      style={{ width: '100%' }}
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: spacing.md,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Txt size={14} weight="extraBold" color={colors.ink}>
                          {c.direction === 'sent' ? `إلى ${c.recipientName}` : `من ${c.senderName}`}
                        </Txt>
                        <Txt size={12} color={colors.textFaint}>
                          {formatDateAr(c.createdAt)}
                        </Txt>
                      </View>
                      <View style={{ backgroundColor: colors.chip, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Txt size={11} weight="extraBold" color={STATUS_COLOR[c.status]}>
                          {t.giftStatus[c.status]}
                        </Txt>
                      </View>
                    </View>
                    <Txt
                      size={13}
                      weight="extraBold"
                      color={colors.terracotta}
                      style={{ marginTop: spacing.sm }}
                      onPress={() => router.push(`/gift/${c.id}`)}
                    >
                      عرض التفاصيل ←
                    </Txt>
                  </View>
                );
              }}
            />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
