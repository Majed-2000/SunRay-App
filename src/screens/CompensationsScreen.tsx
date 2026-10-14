import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Card, EmptyState, ErrorState, Header, Icon, ScreenContainer, Spinner, Txt } from '@/components';
import { useAuthStore } from '@/store';
import { toArabicDigits } from '@/utils/numerals';
import { ksaDate } from '@/utils/ksaDate';
import { fetchMyCompensations, type Compensation, type CompsResult } from '@/services/storeCompensations';

/**
 * «تعويضاتي» — what the branch owes this customer, and the code to claim it.
 *
 * The owner's brief was narrow on purpose: follow the compensation and its
 * state, and show the code to share with the cashier — nothing more. So the
 * code is shown large **only while the compensation is active**. After it is
 * collected or cancelled the number stays in the details as a reference, but a
 * big code on a spent compensation invites a second claim at the till, and the
 * cashier is the one who has to argue about it.
 */
export function CompensationsScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const signedIn = isAuthenticated && !isGuest;

  const [res, setRes] = useState<CompsResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRes(await fetchMyCompensations());
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const header = <Header showBack title="تعويضاتي" />;
  const signIn = () => {
    logout();
    router.replace('/(auth)/login');
  };

  // A compensation belongs to a phone number; a guest has none to look up.
  if (!signedIn || (res && !res.ok && res.reason === 'login') || (res?.ok && res.data.hasPhone === false)) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="ticket"
          title="سجّل دخولك لعرض تعويضاتك"
          subtitle="التعويضات مرتبطة برقم جوالك"
          actionLabel="تسجيل الدخول"
          onAction={signIn}
        />
      </ScreenContainer>
    );
  }
  if (!res) {
    return (
      <ScreenContainer header={header}>
        <Spinner label="نجلب تعويضاتك…" />
      </ScreenContainer>
    );
  }
  if (!res.ok) {
    return (
      <ScreenContainer header={header}>
        <ErrorState message="تعذّر التحميل — حاول بعد قليل" onRetry={() => void load()} />
      </ScreenContainer>
    );
  }

  const list = res.data.comps;
  return (
    <ScreenContainer header={header} scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['4xl'], gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.goldDeep}
            colors={[colors.goldDeep]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {list.length ? (
          list.map((c, i) => <CompCard key={c.code ?? i} comp={c} />)
        ) : (
          <EmptyState icon="ticket" title="لا تعويضات على رقمك" />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function stateLabel(s: Compensation['state']): string {
  if (s === 'redeemed') return 'تم الاستلام';
  if (s === 'cancelled') return 'أُلغي';
  return 'بانتظارك — صالح للاستلام';
}

function itemLine(c: Compensation): string {
  if (c.items?.length) {
    return c.items
      .map((x) => `${x.name}${x.temp ? ` — ${x.temp}` : ''}${(x.qty ?? 1) > 1 ? ` ×${toArabicDigits(x.qty!)}` : ''}`)
      .join('\n');
  }
  return c.offer ?? '';
}

function CompCard({ comp: c }: { comp: Compensation }) {
  const active = c.state === 'active';
  const title = c.items?.length
    ? `${c.items[0].name}${c.items.length > 1 ? ` +${toArabicDigits(c.items.length - 1)}` : ''}`
    : c.offer || 'تعويض';

  const rows: [string, string, boolean?][] = [
    ['رقم التعويض', c.code ?? '', true],
    ['ما يشمله', itemLine(c)],
    ['تاريخ الإصدار', ksaDate(c.issuedAt, true)],
    ['فرع الاستلام', c.branch ?? ''],
    ...(c.state === 'redeemed'
      ? ([
          ['تاريخ الاستلام', ksaDate(c.redeemedAt, true)],
          ['رقم الفاتورة', c.invoiceCode ?? '', true],
        ] as [string, string, boolean][])
      : []),
    ...(c.state === 'cancelled' ? ([['تاريخ الإلغاء', ksaDate(c.cancelledAt, true)]] as [string, string][]) : []),
    ['مرتبط بطلبك', c.orderRef ?? '', true],
    ['مرتبط بتذكرتك', c.ticketRef ?? '', true],
  ];

  return (
    <Card radiusKey="lg" style={{ opacity: active ? 1 : 0.8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <Icon name="ticket" size={24} accent={active ? undefined : null} />
        <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
          {title}
        </Txt>
        <Txt size={12} weight="extraBold" color={active ? colors.success : colors.textMuted}>
          {stateLabel(c.state)}
        </Txt>
      </View>

      {active && c.code ? (
        <View
          style={{
            marginTop: spacing.md,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.gold,
            borderRadius: radius.md,
            paddingVertical: spacing.lg,
            alignItems: 'center',
            backgroundColor: colors.chipGold,
          }}
        >
          <Txt size={12} color={colors.textMuted} center>
            {`أرِ هذا الكود للكاشير${c.branch ? ` في ${c.branch}` : ''}`}
          </Txt>
          <Txt
            latin
            size={34}
            weight="black"
            color={colors.ink}
            selectable
            style={{ letterSpacing: 2, marginTop: 4, writingDirection: 'ltr' }}
          >
            {c.code}
          </Txt>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        {rows
          .filter(([, v]) => v)
          .map(([k, v, ltr]) => (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: spacing.md,
                paddingVertical: 7,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSoft,
              }}
            >
              <Txt size={12} color={colors.textMuted}>
                {k}
              </Txt>
              <Txt
                size={12}
                weight="bold"
                color={colors.ink}
                style={{ flexShrink: 1, writingDirection: ltr ? 'ltr' : 'rtl', lineHeight: 19 }}
              >
                {v}
              </Txt>
            </View>
          ))}
      </View>
    </Card>
  );
}
