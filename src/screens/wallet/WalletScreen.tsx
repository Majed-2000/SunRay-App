import { View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  Card,
  Divider,
  ErrorState,
  Header,
  ScreenContainer,
  SectionHeader,
  Spinner,
  TransactionRow,
  Txt,
  WalletBalanceCard,
} from '@/components';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { useWalletStore } from '@/store';

export function WalletScreen() {
  const balance = useWalletStore((s) => s.balance);
  const transactions = useWalletStore((s) => s.transactions);
  const recent = transactions.slice(0, 4);
  const { loading, error, reload } = useSimulatedLoad();

  if (loading) {
    return (
      <ScreenContainer scroll={false} header={<Header showBack title="المحفظة" />}>
        <Spinner label="نحضّر محفظتك…" />
      </ScreenContainer>
    );
  }
  if (error) {
    return (
      <ScreenContainer scroll={false} header={<Header showBack title="المحفظة" />}>
        <ErrorState onRetry={reload} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer header={<Header showBack title="المحفظة" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <WalletBalanceCard balance={balance} onTopup={() => router.push('/wallet/topup')} />

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="آخر العمليات"
            actionLabel={transactions.length > 4 ? 'عرض الكل' : undefined}
            onAction={() => router.push('/wallet/history')}
          />
          <Card radiusKey="lg" padding={spacing.lg}>
            {recent.length === 0 ? (
              <Txt size={13} color={colors.textMuted} center style={{ paddingVertical: spacing.lg }}>
                لا توجد عمليات بعد
              </Txt>
            ) : (
              recent.map((tx, i) => (
                <View key={tx.id}>
                  <TransactionRow tx={tx} />
                  {i < recent.length - 1 ? <Divider marginV={0} /> : null}
                </View>
              ))
            )}
          </Card>
        </View>

        <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.xl, lineHeight: 18 }}>
          🔒 الرصيد والعمليات تجريبية — لا يوجد دفع حقيقي
        </Txt>
      </View>
    </ScreenContainer>
  );
}
