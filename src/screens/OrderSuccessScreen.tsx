import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { Button, Card, Divider, ScreenContainer, Txt } from '@/components';
import { useOrderStore, orderRef } from '@/store';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';

export function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((s) => s.getById(id));
  const isDelivery = order?.type === 'delivery';

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={[
            shadows.gold,
            {
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.gold,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Ionicons name="checkmark" size={48} color={colors.inkDeep} />
        </View>

        <Txt size={26} weight="black" color={colors.ink} center style={{ marginTop: spacing.xl }}>
          تم إرسال طلبك ☀
        </Txt>
        <Txt size={14} color={colors.textMuted} style={{ marginTop: 6 }}>
          رقم الطلب {order ? orderRef(order.id) : '—'}
        </Txt>
        <View
          style={{
            backgroundColor: '#f3e8d0',
            borderRadius: 100,
            paddingHorizontal: 14,
            paddingVertical: 6,
            marginTop: spacing.md,
          }}
        >
          <Txt size={12} weight="extraBold" color="#8a6a1e">
            ● قيد الانتظار — بانتظار قبول الفرع
          </Txt>
        </View>
        <Txt size={12} color={colors.textFaint} center style={{ marginTop: 8, lineHeight: 18 }}>
          سيؤكّد الفرع طلبك خلال لحظات ثم يبدأ التحضير،{'\n'}وتقدر تتابع الحالة من «طلباتي».
        </Txt>

        <Card radiusKey="xl" style={{ width: '100%', marginTop: spacing['2xl'] }}>
          <Txt size={13} color={colors.textFaint} center>
            {isDelivery ? 'يصلك خلال' : 'جاهز للاستلام خلال'}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <Txt size={40} weight="black" color={colors.ink}>
              {toArabicDigits(order?.etaMinutes ?? 12)}
            </Txt>
            <Txt size={16} weight="bold" color={colors.textSecondary}>
              دقيقة
            </Txt>
          </View>
          <Divider dashed />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt size={14} color={colors.textSecondary}>
              ربحت من هذا الطلب
            </Txt>
            <Txt size={16} weight="black" color={colors.terracotta}>
              +{toArabicDigits(order?.pointsEarned ?? 0)} نقطة
            </Txt>
          </View>
          {order ? (
            <>
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt size={14} color={colors.textSecondary}>
                  الإجمالي
                </Txt>
                <Txt size={15} weight="extraBold" color={colors.ink}>
                  {formatRiyal(order.total)}
                </Txt>
              </View>
            </>
          ) : null}
        </Card>

        <View style={{ width: '100%', marginTop: spacing.xl, gap: 10 }}>
          {isDelivery ? (
            <Button label="تتبع الطلب" variant="gold" onPress={() => router.replace(`/track/${order?.id}`)} />
          ) : (
            <Button label="عرض الطلب" variant="gold" onPress={() => router.replace(`/orders/${order?.id}`)} />
          )}
          <Button label="العودة للرئيسية" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}
