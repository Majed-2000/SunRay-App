import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Card, Header, ListRow, ScreenContainer, Txt } from '@/components';
import { toast } from '@/store';
import { API_BASE_URL } from '@/services/api';

export function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [offers, setOffers] = useState(true);
  const [location, setLocation] = useState(false);

  return (
    <ScreenContainer header={<Header showBack title="الإعدادات" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
          الإشعارات
        </Txt>
        <Card radiusKey="lg" padding={0} style={{ overflow: 'hidden' }}>
          <ToggleRow icon="notifications-outline" label="إشعارات الطلبات" value={notifications} onToggle={() => setNotifications((v) => !v)} />
          <Sep />
          <ToggleRow icon="pricetags-outline" label="العروض والمكافآت" value={offers} onToggle={() => setOffers((v) => !v)} />
          <Sep />
          <ToggleRow icon="location-outline" label="مشاركة الموقع" value={location} onToggle={() => setLocation((v) => !v)} />
        </Card>

        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          عام
        </Txt>
        <View style={{ gap: 10 }}>
          <ListRow icon="language-outline" label="اللغة" value="العربية" onPress={() => toast('الإنجليزية قريبًا ☀')} />
          <ListRow
            icon="shield-checkmark-outline"
            label="سياسة الخصوصية"
            onPress={() => Linking.openURL(`${API_BASE_URL}/privacy`)}
          />
          <ListRow
            icon="document-text-outline"
            label="الشروط والأحكام"
            onPress={() => Linking.openURL(`${API_BASE_URL}/terms`)}
          />
          <ListRow icon="information-circle-outline" label="عن التطبيق" value="١.٠.٠" onPress={() => toast('Sun Ray · سن راي')} />
        </View>

        {/*
          Account deletion. Apple 5.1.1(v) and Google Play require this to be
          reachable in-app, and reviewers look for it — burying it would fail
          review as surely as omitting it.

          It sits in its own group at the bottom, away from the ordinary rows, so
          it reads as a different weight of action and is hard to hit by accident
          while scrolling.
        */}
        <Txt size={13} weight="black" color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          الحساب
        </Txt>
        <ListRow
          icon="trash-outline"
          label="حذف الحساب"
          onPress={() => router.push('/delete-account')}
        />
      </View>
    </ScreenContainer>
  );
}

function Sep() {
  return <View style={{ height: 1, backgroundColor: colors.borderSoft, marginHorizontal: spacing.lg }} />;
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg }}>
      <Ionicons name={icon} size={20} color={colors.terracotta} />
      <Txt size={15} weight="bold" color={colors.ink} style={{ flex: 1 }}>
        {label}
      </Txt>
      <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? colors.gold : colors.border, padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white }} />
      </View>
    </Pressable>
  );
}
