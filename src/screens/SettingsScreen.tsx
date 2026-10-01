import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Header, ListRow, ScreenContainer, Txt } from '@/components';
import { toast, useAuthStore } from '@/store';
import { APP_VERSION_AR } from '@/constants/appVersion';

/**
 * Settings — only switches that switch something.
 *
 * There were three toggles here (order notifications, offers, location
 * sharing) held in local `useState`: they changed nothing, and forgot their
 * position on leaving the screen. The app has no push notifications yet, and
 * location is asked for by the system only when «وصلت» is pressed. Until those
 * are real, the honest control is the system's own settings page. A language
 * row that answered «الإنجليزية قريبًا» is gone too — no promise without a date.
 */
export function SettingsScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);

  return (
    <ScreenContainer header={<Header showBack title="الإعدادات" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
          عام
        </Txt>
        <View style={{ gap: 10 }}>
          <ListRow
            icon="options-outline"
            label="أذونات التطبيق"
            sublabel="الموقع لخدمة السيارة — من إعدادات الجهاز"
            onPress={() => Linking.openSettings().catch(() => toast('تعذّر فتح إعدادات الجهاز'))}
          />
          <ListRow
            icon="shield-checkmark-outline"
            label="سياسة الخصوصية"
            onPress={() => router.push('/legal/privacy')}
          />
          <ListRow
            icon="document-text-outline"
            label="الشروط والأحكام"
            onPress={() => router.push('/legal/terms')}
          />
          <ListRow
            icon="receipt-outline"
            label="الإلغاء والاسترداد"
            onPress={() => router.push('/legal/refunds')}
          />
          <ListRow icon="information-circle-outline" label="عن التطبيق" value={APP_VERSION_AR} onPress={() => toast('Sun Ray · سن راي')} />
        </View>

        {/*
          Account deletion. Apple 5.1.1(v) and Google Play require this to be
          reachable in-app, and reviewers look for it — burying it would fail
          review as surely as omitting it.

          It sits in its own group at the bottom, away from the ordinary rows, so
          it reads as a different weight of action and is hard to hit by accident
          while scrolling. A guest has no account to delete.
        */}
        {!isGuest ? (
          <>
            <Txt size={13} weight="black" color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              الحساب
            </Txt>
            <ListRow
              icon="trash-outline"
              label="حذف الحساب"
              onPress={() => router.push('/delete-account')}
            />
          </>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
