import { View, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { Card, ListRow, ScreenContainer, Txt } from '@/components';
import { CONFIG } from '@/constants/config';
import { toArabicDigits } from '@/utils/numerals';
import { useAuthStore, useLoyaltyStore, toast } from '@/store';

type IoniconName = keyof typeof Ionicons.glyphMap;
interface RowDef {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}

export function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const points = useLoyaltyStore((s) => s.points);

  const rows: RowDef[] = [
    { icon: 'receipt-outline', label: 'طلباتي السابقة', onPress: () => router.push('/(tabs)/orders') },
    { icon: 'wallet-outline', label: 'المحفظة', onPress: () => router.push('/wallet') },
    { icon: 'gift-outline', label: 'بطاقات الإهداء', onPress: () => router.push('/gift') },
    { icon: 'pricetags-outline', label: 'العروض والكوبونات', onPress: () => router.push('/offers') },
    { icon: 'location-outline', label: 'عناويني', onPress: () => router.push('/addresses') },
    { icon: 'person-outline', label: 'تعديل الملف الشخصي', onPress: () => router.push('/edit-profile') },
    { icon: 'settings-outline', label: 'الإعدادات', onPress: () => router.push('/settings') },
    { icon: 'help-circle-outline', label: 'الدعم والمساعدة', onPress: () => router.push('/support') },
    { icon: 'chatbubble-ellipses-outline', label: 'الأسئلة الشائعة', onPress: () => router.push('/faq') },
    // A real share sheet. A button that only says 'soon' is worse than no button.
    {
      icon: 'share-social-outline',
      label: 'ادعُ صديقًا',
      onPress: () =>
        Share.share({ message: 'جرّب تطبيق سن راي ☀ اطلب قهوتك من الحلقة الغربية قبل ما توصل.' }).catch(
          () => undefined,
        ),
    },
  ];

  return (
    <ScreenContainer
      padded={false}
      header={
        <View style={{ paddingHorizontal: spacing['2xl'], paddingTop: spacing.sm }}>
          <Txt size={24} weight="black" color={colors.ink}>
            حسابي
          </Txt>
        </View>
      }
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] }}>
        {/* profile */}
        <Card radiusKey="xl" style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: spacing.lg }}>
          <LinearGradient
            colors={gradients.goldSoft}
            style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt size={26} weight="black" color={colors.inkDeep}>
              {user?.avatarText ?? 'ض'}
            </Txt>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Txt size={18} weight="black" color={colors.ink}>
              {user?.name ?? 'ضيف'}
            </Txt>
            <Txt size={12} color={colors.textFaint} style={{ writingDirection: 'ltr' }}>
              {CONFIG.COUNTRY_DIAL_CODE} {user?.phone ?? '—'}
            </Txt>
          </View>
          <View style={{ backgroundColor: colors.chip, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
            <Txt size={15} weight="black" color={colors.terracotta}>
              {toArabicDigits(points)}
            </Txt>
            <Txt size={9} color={colors.textFaint}>
              نقطة
            </Txt>
          </View>
        </Card>

        {/* list */}
        <View style={{ gap: 10 }}>
          {rows.map((r) => (
            <ListRow key={r.label} icon={r.icon} label={r.label} onPress={r.onPress} />
          ))}
          <ListRow
            icon="log-out-outline"
            label="تسجيل الخروج"
            danger
            showChevron={false}
            onPress={() => {
              logout();
              router.replace('/(auth)/login');
            }}
          />
        </View>

        <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.xl }}>
          Sun Ray · سن راي — الإصدار ١.٠.٠
        </Txt>
      </View>
    </ScreenContainer>
  );
}
