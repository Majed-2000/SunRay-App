import { View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Card, Header, ListRow, ScreenContainer, Txt } from '@/components';
import { toast } from '@/store';

export function SupportScreen() {
  return (
    <ScreenContainer header={<Header showBack title="الدعم والمساعدة" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Card radiusKey="xl" backgroundColor={colors.ink} style={{ marginBottom: spacing.xl }}>
          <Txt size={20} weight="black" color={colors.white}>
            كيف نقدر نساعدك؟ ☀
          </Txt>
          <Txt size={13} color={colors.textOnDarkMuted} style={{ marginTop: 6, lineHeight: 21 }}>
            فريق سن راي جاهز لخدمتك من ٧ صباحًا حتى منتصف الليل طوال أيام الأسبوع.
          </Txt>
        </Card>

        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
          تواصل معنا
        </Txt>
        <View style={{ gap: 10 }}>
          <ListRow icon="logo-whatsapp" label="واتساب" sublabel="ردّ سريع خلال دقائق" onPress={() => toast('فتح واتساب قريبًا ☀')} />
          <ListRow icon="call-outline" label="اتصال هاتفي" sublabel="٩٢٠ ٠٠٠ ٠٠٠" onPress={() => toast('الاتصال قريبًا ☀')} />
          <ListRow icon="mail-outline" label="البريد الإلكتروني" sublabel="care@sunray.cafe" onPress={() => toast('فتح البريد قريبًا ☀')} />
        </View>

        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          مساعدة ذاتية
        </Txt>
        <ListRow icon="help-circle-outline" label="الأسئلة الشائعة" onPress={() => router.push('/faq')} />
      </View>
    </ScreenContainer>
  );
}
