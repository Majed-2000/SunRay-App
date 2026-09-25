import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Card, Header, ListRow, ScreenContainer, Txt } from '@/components';
import { toast } from '@/store';

/**
 * Support — channels that actually reach Sun Ray.
 *
 * This listed WhatsApp, a «٩٢٠ ٠٠٠ ٠٠٠» number and care@sunray.cafe, each of
 * which only toasted «قريبًا»; none of them exists. The channels the café
 * publishes (the store website's footer) are its social accounts, so those are
 * what this opens. Add a phone or WhatsApp here once the business has one.
 */
const CHANNELS = [
  { icon: 'logo-instagram' as const, label: 'راسلنا على إنستقرام', sublabel: '@sunray.sa', url: 'https://ig.me/m/sunray.sa' },
  { icon: 'logo-tiktok' as const, label: 'تيك توك', sublabel: '@sunray.sa', url: 'https://www.tiktok.com/@sunray.sa' },
  { icon: 'logo-snapchat' as const, label: 'سناب شات', sublabel: '@sunray.sa', url: 'https://www.snapchat.com/@sunray.sa' },
  // The contact address the privacy policy publishes.
  { icon: 'mail-outline' as const, label: 'البريد الإلكتروني', sublabel: 'sunray.sa811@gmail.com', url: 'mailto:sunray.sa811@gmail.com' },
];

export function SupportScreen() {
  const open = (url: string) => Linking.openURL(url).catch(() => toast('تعذّر فتح الرابط'));

  return (
    <ScreenContainer header={<Header showBack title="الدعم والمساعدة" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Card radiusKey="xl" backgroundColor={colors.ink} style={{ marginBottom: spacing.xl }}>
          <Txt size={20} weight="black" color={colors.white}>
            كيف نقدر نساعدك؟
          </Txt>
          <Txt size={13} color={colors.textOnDarkMuted} style={{ marginTop: 6, lineHeight: 21 }}>
            راسلنا وسيرد عليك فريق سن راي. عن طلب معيّن؟ اذكر رقم الطلب من «طلباتي».
          </Txt>
        </Card>

        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
          تواصل معنا
        </Txt>
        <View style={{ gap: 10 }}>
          {CHANNELS.map((c) => (
            <ListRow key={c.url} icon={c.icon} label={c.label} sublabel={c.sublabel} onPress={() => open(c.url)} />
          ))}
        </View>

        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          مساعدة ذاتية
        </Txt>
        <ListRow icon="help-circle-outline" label="الأسئلة الشائعة" onPress={() => router.push('/faq')} />
      </View>
    </ScreenContainer>
  );
}
