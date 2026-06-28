import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { EmptyState, Header, ScreenContainer, Txt } from '@/components';
import type { AppNotification, NotificationType } from '@/types';
import { relativeTimeAr } from '@/utils/date';
import { useNotificationStore } from '@/store';

const META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> = {
  orderAccepted: { icon: 'checkmark-circle', tint: colors.success, bg: '#e7f4ec' },
  orderReady: { icon: 'cafe', tint: colors.terracotta, bg: '#fbe9c4' },
  pointsEarned: { icon: 'star', tint: colors.gold, bg: colors.chipGold },
  giftReceived: { icon: 'gift', tint: colors.terracotta, bg: '#f3e0d2' },
  birthdayOffer: { icon: 'sparkles', tint: colors.gold, bg: colors.chipGold },
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
