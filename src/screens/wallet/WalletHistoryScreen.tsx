import { ScrollView, View } from 'react-native';
import { spacing } from '@/theme';
import { Card, Divider, EmptyState, Header, ScreenContainer, TransactionRow } from '@/components';
import { useWalletStore } from '@/store';

export function WalletHistoryScreen() {
  const transactions = useWalletStore((s) => s.transactions);

  return (
    <ScreenContainer scroll={false} header={<Header showBack title="سجل العمليات" />}>
      {transactions.length === 0 ? (
        <EmptyState emoji="🧾" title="لا توجد عمليات بعد" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing['4xl'] }}>
          <Card radiusKey="lg">
            {transactions.map((tx, i) => (
              <View key={tx.id}>
                <TransactionRow tx={tx} />
                {i < transactions.length - 1 ? <Divider marginV={0} /> : null}
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
