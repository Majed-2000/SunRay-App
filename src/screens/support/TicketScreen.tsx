import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Button, Card, EmptyState, Header, ScreenContainer, Spinner, Txt } from '@/components';
import { subscribeTicket } from '@/services/storeTickets';
import { TICKET_STATUS_AR, type TicketRecord } from '@/services/requestRules';
import { formatDateAr } from '@/utils/date';
import { StatusPill, formatTime12 } from './parts';

export function ticketTone(status: string | undefined): 'ok' | 'muted' | 'info' {
  if (status === 'resolved') return 'ok';
  if (status === 'closed' || status === 'terminated') return 'muted';
  return 'info';
}

/**
 * One ticket, live — status and the staff reply.
 *
 * Reads exactly `sunray/tickets/<key>`. The site's tracking view shows one
 * reply field, `adminReply`, written by the dashboard; that is all there is to
 * show. Editing and deleting (which the site does client-side) are left out:
 * a customer who needs to add something opens a new ticket or messages us.
 */
export function TicketScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const [t, setT] = useState<TicketRecord | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => (key ? subscribeTicket(String(key), setT, () => setFailed(true)) : undefined), [key]);

  const header = <Header showBack title={t?.code ? `تذكرة ${t.code}` : 'التذكرة'} />;

  if (t === undefined) {
    return (
      <ScreenContainer header={header}>
        {failed ? <EmptyState icon="offline" title="تعذّر تحميل التذكرة" subtitle="تحقّق من اتصالك بالإنترنت" /> : <Spinner />}
      </ScreenContainer>
    );
  }
  if (t === null) {
    return (
      <ScreenContainer header={header}>
        <EmptyState icon="ticket" title="لم تعد هذه التذكرة موجودة" actionLabel="تذاكري" onAction={() => router.replace('/ticket')} />
      </ScreenContainer>
    );
  }

  const status = t.status ?? 'new';
  const incident = typeof t.incidentTime === 'string' ? t.incidentTime.split('T') : null;

  return (
    <ScreenContainer header={header}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg }}>
        <Card radiusKey="lg">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <Txt size={18} weight="black" latin color={colors.ink}>
              {t.code}
            </Txt>
            <StatusPill label={TICKET_STATUS_AR[status] ?? status} tone={ticketTone(status)} />
          </View>
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
            {[t.type === 'suggestion' ? 'اقتراح' : 'شكوى', t.createdAt ? formatDateAr(t.createdAt) : '']
              .filter(Boolean)
              .join(' · ')}
          </Txt>
          <Txt size={15} weight="extraBold" color={colors.ink} style={{ marginTop: spacing.md }}>
            {t.title}
          </Txt>
          <Txt size={13} color={colors.textSecondary} style={{ marginTop: 4, lineHeight: 21 }}>
            {t.body}
          </Txt>
          {incident ? (
            <Txt size={12} color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              وقت المشكلة: {incident[0]} {formatTime12(incident[1])}
            </Txt>
          ) : null}
        </Card>

        <Card radiusKey="lg" backgroundColor={t.adminReply ? colors.successSoft : colors.card}>
          <Txt size={14} weight="black" color={colors.ink}>
            رد فريق سن راي
          </Txt>
          <Txt size={13} color={t.adminReply ? colors.ink : colors.textMuted} style={{ marginTop: 6, lineHeight: 21 }}>
            {t.adminReply || 'لا يوجد رد بعد. نراجع تذكرتك ونرد عليك هنا وعلى وسيلة التواصل التي تركتها.'}
          </Txt>
        </Card>

        {status === 'resolved' || status === 'closed' || status === 'terminated' ? (
          <Button label="افتح تذكرة جديدة" variant="outline" onPress={() => router.push('/ticket/new')} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
