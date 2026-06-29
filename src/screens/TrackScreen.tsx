import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Card, Header, ScreenContainer, Spinner, TrackSteps, Txt } from '@/components';
import { strings } from '@/i18n';
import { toArabicDigits } from '@/utils/numerals';
import { USE_BACKEND } from '@/services/api';
import { flowStages, currentStepIndex, orderStage, orderRef, useOrderStore } from '@/store';

export function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((s) => s.getById(id));
  const advance = useOrderStore((s) => s.advance);
  const fetchOrder = useOrderStore((s) => s.fetchOrder);
  const advanceBackend = useOrderStore((s) => s.advanceBackend);
  const t = strings();
  const [loading, setLoading] = useState(USE_BACKEND && !order);

  useEffect(() => {
    if (!id) return;

    if (USE_BACKEND) {
      // Backend mode: POLL the real order every 3s so any status change (from the
      // dev button or a `curl PATCH`) shows up. We do NOT auto-mutate the backend.
      let active = true;
      fetchOrder(id).finally(() => active && setLoading(false));
      const timer = setInterval(() => {
        const current = useOrderStore.getState().getById(id);
        if (current && orderStage(current) === 'completed') {
          clearInterval(timer);
          return;
        }
        fetchOrder(id);
      }, 3000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }

    // Mock mode: simulate live progress locally (unchanged).
    const timer = setInterval(() => {
      const current = useOrderStore.getState().getById(id);
      if (!current || orderStage(current) === 'completed') {
        clearInterval(timer);
        return;
      }
      advance(id);
    }, 2600);
    return () => clearInterval(timer);
  }, [id, advance, fetchOrder]);

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

  const currentIndex = currentStepIndex(order);
  const steps = flowStages(order.type).map((s) => ({ label: t.orderStage[s], en: t.orderStageEn[s] }));
  const done = orderStage(order) === 'completed';

  return (
    <ScreenContainer scroll={false} padded={false} header={<View style={{ paddingHorizontal: spacing['2xl'] }}><Header showBack title="تتبع الطلب" /></View>}>
      {/* faux map */}
      <View style={{ height: 200, backgroundColor: '#e6dcc6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Ionicons name="map-outline" size={40} color="#bca97f" style={{ position: 'absolute', top: 24, left: 30, opacity: 0.5 }} />
        <Ionicons name="home" size={24} color={colors.terracotta} style={{ position: 'absolute', top: 50, right: 50 }} />
        <Txt size={44}>{order.type === 'delivery' ? '🛵' : '🏪'}</Txt>
        <View style={{ position: 'absolute', bottom: 40, left: 60, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.terracotta, borderWidth: 3, borderColor: colors.white }} />
      </View>

      <View style={{ padding: spacing['2xl'] }}>
        <Txt size={13} weight="bold" color={colors.textFaint}>
          رقم الطلب {orderRef(order.id)}
        </Txt>
        <Txt size={24} weight="black" color={colors.ink} style={{ marginTop: 2 }}>
          {done ? 'وصل طلبك، بالهنا ☀' : `الوصول خلال ${toArabicDigits(order.etaMinutes)} دقيقة`}
        </Txt>

        <View style={{ marginTop: spacing.xl }}>
          <TrackSteps steps={steps} currentIndex={currentIndex < 0 ? 0 : currentIndex} />
        </View>

        {order.type === 'delivery' ? (
          <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={22}>🧑‍🦱</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={14} weight="extraBold" color={colors.ink}>
                  سعد · مندوب التوصيل
                </Txt>
                <Txt size={11} color={colors.textFaint}>
                  سيارة بيضاء · ٤٢٣٧
                </Txt>
              </View>
              <View style={[shadows.xs, { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="call" size={17} color={colors.ink} />
              </View>
            </View>
          </Card>
        ) : null}

        {USE_BACKEND && !done && __DEV__ ? (
          <Button
            label="تقديم الحالة (اختبار)"
            variant="ghost"
            size="sm"
            style={{ marginTop: spacing.lg }}
            onPress={() => advanceBackend(order.id)}
          />
        ) : null}

        <Button label="العودة للرئيسية" variant="outline" style={{ marginTop: spacing.md }} onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </ScreenContainer>
  );
}
