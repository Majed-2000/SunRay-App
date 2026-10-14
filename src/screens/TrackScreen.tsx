import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Button, Header, ScreenContainer, Spinner, TrackSteps, Txt } from '@/components';
import { strings } from '@/i18n';
import { flowStages, currentStepIndex, orderStage, orderRef, useOrderStore } from '@/store';

/**
 * How often the live order is re-read. Each poll reads the customer's whole
 * feed (there is no single-order callable), so this is deliberately slow; the
 * stages it tracks change over minutes, not seconds.
 */
const POLL_MS = 20_000;

/**
 * Preparation tracking for a pickup or curbside order.
 *
 * This screen used to show a drawn map, a courier who does not exist
 * («سعد · سيارة بيضاء»), a call button with nothing behind it, and an ETA of
 * zero for every live order. The store does not deliver and does not report an
 * ETA, so what remains is what it does report: the stage.
 */
export function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((s) => s.getById(id));
  const fetchOrder = useOrderStore((s) => s.fetchOrder);
  const t = strings();
  const [loading, setLoading] = useState(!order);

  useEffect(() => {
    if (!id) return;

    let active = true;
    fetchOrder(id).finally(() => active && setLoading(false));
    const poll = () => {
      // No polling from the background — nobody is looking, and it costs a
      // callable each time.
      if (AppState.currentState !== 'active') return;
      const current = useOrderStore.getState().getById(id);
      if (current && orderStage(current) === 'completed') return;
      fetchOrder(id);
    };
    const timer = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, fetchOrder]);

  if (!order) {
    return (
      <ScreenContainer scroll={false} header={<Header showBack title="تتبع الطلب" />}>
        {loading ? (
          <Spinner />
        ) : (
          <Txt size={15} color={colors.textMuted} center style={{ marginTop: spacing['4xl'] }}>
            الطلب غير موجود
          </Txt>
        )}
      </ScreenContainer>
    );
  }

  const stage = orderStage(order);
  const currentIndex = currentStepIndex(order);
  const steps = flowStages(order.type).map((s) => ({ label: t.orderStage[s], en: t.orderStageEn[s] }));

  return (
    <ScreenContainer scroll={false} padded={false} header={<View style={{ paddingHorizontal: spacing['2xl'] }}><Header showBack title="تتبع الطلب" /></View>}>
      <View style={{ padding: spacing['2xl'] }}>
        <Txt size={13} weight="bold" color={colors.textFaint}>
          رقم الطلب {orderRef(order)}
        </Txt>
        <Txt size={24} weight="black" color={colors.ink} style={{ marginTop: 2 }}>
          {t.orderStage[stage]}
        </Txt>

        <View style={{ marginTop: spacing.xl }}>
          <TrackSteps steps={steps} currentIndex={currentIndex < 0 ? 0 : currentIndex} />
        </View>

        <Button label="تفاصيل الطلب" variant="gold" style={{ marginTop: spacing.xl }} onPress={() => router.replace(`/orders/${order.id}`)} />
        <Button label="العودة للرئيسية" variant="outline" style={{ marginTop: spacing.md }} onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </ScreenContainer>
  );
}
