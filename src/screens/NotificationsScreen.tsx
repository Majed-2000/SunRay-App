import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { EmptyState, Header, ScreenContainer, Txt } from '@/components';
import type { AppNotification, NotificationType } from '@/types';
import { relativeTimeAr } from '@/utils/date';
import { useNotificationStore } from '@/store';

const META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> = {
  orderAccepted: { icon: 'checkmark-circle', tint: colors.success, bg: colors.successSoft },
  orderReady: { icon: 'cafe', tint: colors.goldDeep, bg: colors.chipGold },
  // Radiant Gold on a gold-tinted chip is ~1.05:1 — the icon was very nearly
  // invisible against its own background. Gold is the chip, not the mark on it.
  pointsEarned: { icon: 'star', tint: colors.goldDeep, bg: colors.chipGold },
  giftReceived: { icon: 'gift', tint: colors.goldDeep, bg: colors.chipGold },
  birthdayOffer: { icon: 'sparkles', tint: colors.goldDeep, bg: colors.chipGold },
};

export function NotificationsScreen() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Opening the center marks everything read (clears the home badge).
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <ScreenContainer header={<Header showBack title="الإشعارات" />}>
      {notifications.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="لا توجد إشعارات"
          subtitle="ستظهر هنا تحديثات طلباتك ونقاطك وهداياك"
        />
      ) : (
        <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'], gap: 10 }}>
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = META[notification.type];
  return (
    <View
      style={[
        shadows.xs,
        {
          flexDirection: 'row',
          gap: 13,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
      ]}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.sm,
          backgroundColor: meta.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={meta.icon} size={20} color={meta.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
            {notification.titleAr}
          </Txt>
          <Txt size={11} color={colors.textFaint}>
            {relativeTimeAr(notification.createdAt)}
          </Txt>
        </View>
        <Txt size={13} color={colors.textMuted} style={{ marginTop: 3, lineHeight: 20 }}>
          {notification.bodyAr}
        </Txt>
      </View>
    </View>
  );
}
