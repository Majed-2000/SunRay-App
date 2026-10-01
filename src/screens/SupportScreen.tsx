import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Card, Header, ListRow, ScreenContainer, Txt } from '@/components';
import { toast } from '@/store';

/**
 * Support — channels that actually reach Sun Ray.
 *
 * This once listed a «٩٢٠ ٠٠٠ ٠٠٠» number and care@sunray.cafe, each of which
 * only toasted «قريبًا»; neither exists. Every channel here is one the café
 * publishes itself: WhatsApp 966549177174 is on the sunray.sa footer and is the
 * number the website's catering page and its WhatsApp bot use; the social
 * accounts are the footer's too.
 *
 * Tickets come first: a complaint sent as a ticket lands on the staff
 * dashboard with a tracking number and a reply the customer can read in the
 * app, where a DM depends on someone noticing it.
 */
const CHANNELS = [
  { icon: 'logo-whatsapp' as const, label: 'واتساب', sublabel: '+966 54 917 7174', url: 'https://wa.me/966549177174' },
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
          الدعم الفني
        </Txt>
        <View style={{ gap: 10, marginBottom: spacing.xl }}>
          <ListRow
            brandIcon="ticket"
            label="افتح تذكرة"
            sublabel="شكوى أو اقتراح — نرد عليك برقم متابعة"
            onPress={() => router.push('/ticket/new')}
          />
          <ListRow brandIcon="chat" label="تذاكري" sublabel="حالة تذاكرك وردود فريقنا" onPress={() => router.push('/ticket')} />
        </View>

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
