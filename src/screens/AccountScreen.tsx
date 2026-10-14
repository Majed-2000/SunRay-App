import { View, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { APP_VERSION_AR } from '@/constants/appVersion';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { Card, ListRow, ScreenContainer, Txt } from '@/components';
import { CONFIG } from '@/constants/config';
import { STORE_HAS_DELIVERY, STORE_HAS_GIFTCARDS, STORE_HAS_WALLET } from '@/constants/features';
import { toArabicDigits } from '@/utils/numerals';
import { ltr } from '@/utils/validators';
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
  const points = useLoyaltyStore((s) => s.points());
  // Before the ledger answers, `points()` is 0 — shown as «٠ نقطة», which a
  // customer with a real balance reads as their points being gone.
  const pointsKnown = useLoyaltyStore((s) => s.data !== null);
  const pointsFailed = useLoyaltyStore((s) => s.status === 'error');
  const isGuest = useAuthStore((s) => s.isGuest);

  // A row only for what works. Wallet, gift cards and addresses each opened a
  // mock — a balance that was never charged, codes nobody receives, addresses
  // for a delivery the store does not make. A guest has no account to edit.
  const rows: RowDef[] = [
    { icon: 'receipt-outline', label: 'طلباتي السابقة', onPress: () => router.push('/(tabs)/orders') },
    ...(STORE_HAS_WALLET && !isGuest ? [{ icon: 'wallet-outline' as const, label: 'المحفظة', onPress: () => router.push('/wallet') }] : []),
    ...(STORE_HAS_GIFTCARDS
      ? [
          { icon: 'gift-outline' as const, label: 'باقات الإهداء', onPress: () => router.push('/gift') },
          ...(!isGuest ? [{ icon: 'gift' as const, label: 'هداياي', onPress: () => router.push('/gift/mine') }] : []),
        ]
      : []),
    ...(!isGuest
      ? [
          { icon: 'ticket-outline' as const, label: 'تعويضاتي', onPress: () => router.push('/compensations') },
          { icon: 'calendar-outline' as const, label: 'طلبات الكاترينق', onPress: () => router.push('/catering/mine') },
          { icon: 'chatbox-ellipses-outline' as const, label: 'تذاكري', onPress: () => router.push('/ticket') },
        ]
      : []),
    { icon: 'qr-code-outline', label: 'ماسح الطلب', onPress: () => router.push('/scan') },
    { icon: 'location-outline', label: 'فروعنا', onPress: () => router.push('/branches') },
    { icon: 'pricetags-outline', label: 'العروض والكوبونات', onPress: () => router.push('/offers') },
    ...(STORE_HAS_DELIVERY && !isGuest ? [{ icon: 'location-outline' as const, label: 'عناويني', onPress: () => router.push('/addresses') }] : []),
    ...(!isGuest ? [{ icon: 'person-outline' as const, label: 'تعديل الملف الشخصي', onPress: () => router.push('/edit-profile') }] : []),
    { icon: 'settings-outline', label: 'الإعدادات', onPress: () => router.push('/settings') },
    { icon: 'help-circle-outline', label: 'الدعم والمساعدة', onPress: () => router.push('/support') },
    { icon: 'chatbubble-ellipses-outline', label: 'الأسئلة الشائعة', onPress: () => router.push('/faq') },
    // A real share sheet. A button that only says 'soon' is worse than no button.
    {
      icon: 'share-social-outline',
      label: 'ادعُ صديقًا',
      onPress: () =>
        Share.share({ message: 'جرّب تطبيق سن راي — اطلب قهوتك من الحلقة الغربية قبل ما توصل.' }).catch(
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
            <Txt size={12} color={colors.textFaint} >
              {isGuest || !user?.phone ? 'زائر — سجّل دخولك لتطلب وتجمع النقاط' : ltr(`${CONFIG.COUNTRY_DIAL_CODE} ${user.phone}`)}
            </Txt>
          </View>
          <View style={{ backgroundColor: colors.chip, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
            <Txt size={15} weight="black" color={colors.goldDeep}>
              {pointsKnown || isGuest ? toArabicDigits(points) : pointsFailed ? '—' : '…'}
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
            icon={isGuest ? 'log-in-outline' : 'log-out-outline'}
            label={isGuest ? 'تسجيل الدخول' : 'تسجيل الخروج'}
            danger
            showChevron={false}
            onPress={() => {
              logout();
              router.replace('/(auth)/login');
            }}
          />
        </View>

        <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.xl }}>
          Sun Ray · سن راي — الإصدار {APP_VERSION_AR}
        </Txt>
      </View>
    </ScreenContainer>
  );
}
