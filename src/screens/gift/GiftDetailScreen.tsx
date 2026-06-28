import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  Divider,
  GiftCardPreview,
  Header,
  ScreenContainer,
  Txt,
} from '@/components';
import { giftDesignById } from '@/data';
import { strings } from '@/i18n';
import { formatMobileDisplay } from '@/utils/validators';
import { formatDateAr } from '@/utils/date';
import { useGiftStore, toast } from '@/store';

export function GiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useGiftStore((s) => s.getById(id));
  const redeem = useGiftStore((s) => s.redeem);
  const t = strings();

  if (!card) {
    return (
      <ScreenContainer header={<Header showBack title="بطاقة الإهداء" />}>
        <Txt size={15} color={colors.textMuted} center style={{ marginTop: spacing['4xl'] }}>
          البطاقة غير موجودة
        </Txt>
      </ScreenContainer>
    );
  }

  const design = giftDesignById(card.designId);

  return (
    <ScreenContainer header={<Header showBack title="بطاقة الإهداء" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <GiftCardPreview
          design={design}
          amount={card.amount}
          footerStart={card.direction === 'sent' ? `إلى ${card.recipientName}` : `من ${card.senderName}`}
          footerEnd={formatMobileDisplay(card.recipientPhone)}
        />

        {/* how it works */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg }}>
          <Txt size={13} color={colors.textMuted} style={{ flex: 1, lineHeight: 20 }}>
            💳 يُضاف مبلغ البطاقة ({card.amount} ﷼) إلى رصيد محفظتك عند الاستبدال، وتستخدمه في طلباتك.
          </Txt>
        </View>

        {/* code */}
        <Card radiusKey="lg" style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Txt size={12} color={colors.textFaint}>
            كود البطاقة
          </Txt>
          <Txt size={22} weight="black" color={colors.ink} latin style={{ marginTop: 4, letterSpacing: 2 }}>
            {card.code}
          </Txt>
          <View style={{ backgroundColor: colors.chip, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 }}>
            <Txt size={12} weight="extraBold" color={card.status === 'active' ? colors.success : colors.textMuted}>
              {t.giftStatus[card.status]}
            </Txt>
          </View>
        </Card>

        {/* details */}
        <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
          <Row label="القيمة" value={`${card.amount} ﷼`} accent />
          <Divider marginV={spacing.sm} />
          <Row label="من" value={card.senderName} />
          <Divider marginV={spacing.sm} />
          <Row label="إلى" value={`${card.recipientName} · ${formatMobileDisplay(card.recipientPhone)}`} />
          <Divider marginV={spacing.sm} />
          <Row label="التاريخ" value={formatDateAr(card.createdAt)} />
          {card.message ? (
            <>
              <Divider marginV={spacing.sm} />
              <Txt size={13} color={colors.textSecondary} style={{ lineHeight: 21 }}>
                💬 {card.message}
              </Txt>
            </>
          ) : null}
        </Card>

        {card.status === 'active' ? (
          <Button
            label="أضف الرصيد إلى محفظتي"
            variant="gold"
            trailing={`${card.amount} ﷼`}
            style={{ marginTop: spacing.lg }}
            onPress={() => {
              if (redeem(card.id)) router.replace('/wallet');
            }}
          />
        ) : (
          <View style={{ marginTop: spacing.lg, backgroundColor: colors.chip, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt size={13} weight="bold" color={colors.textSecondary} style={{ flex: 1 }}>
              ✓ تم استبدال هذه البطاقة وإضافة رصيدها إلى المحفظة.
            </Txt>
          </View>
        )}
        <Button label="مشاركة الكود" variant="outline" style={{ marginTop: 10 }} onPress={() => toast('تمت المشاركة ☀')} />
        <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.md, lineHeight: 17 }}>
          🔒 كود البطاقة سرّي وبمثابة نقد — لا تشاركه إلا مع المستلم.
        </Txt>
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Txt size={14} color={colors.textSecondary}>
        {label}
      </Txt>
      <Txt size={14} weight="extraBold" color={accent ? colors.terracotta : colors.ink}>
        {value}
      </Txt>
    </View>
  );
}
