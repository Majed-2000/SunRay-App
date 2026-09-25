import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, shadows, spacing } from '@/theme';
import { Button, Card, Divider, ScreenContainer, Txt } from '@/components';
import { useOrderStore, orderRef } from '@/store';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';

/**
 * After an order is placed.
 *
 * This used to promise «جاهز خلال ١٢ دقيقة» and «+٠ نقطة» for every live order —
 * neither figure exists until the branch accepts the order and it settles — and
 * its button navigated to `/track/undefined` because the live order was never
 * put in the store. Now checkout records the order before arriving here, and
 * the screen shows only what is known: the counter code and the total.
 */
export function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((s) => s.getById(id));

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
          تم إرسال طلبك
        </Txt>
        <View
          style={{
            backgroundColor: colors.chipGoldStrong,
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

        {order ? (
          <Card radiusKey="xl" style={{ width: '100%', marginTop: spacing['2xl'] }}>
            <Txt size={13} color={colors.textFaint} center>
              رقم طلبك عند الاستلام
            </Txt>
            <Txt size={36} weight="black" color={colors.ink} center latin style={{ marginTop: 4 }}>
              {orderRef(order)}
            </Txt>
            <Divider dashed />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt size={14} color={colors.textSecondary}>
                الإجمالي
              </Txt>
              <Txt size={15} weight="extraBold" color={colors.ink}>
                {formatRiyal(order.total)}
              </Txt>
            </View>
            {order.pointsEarned > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                <Txt size={14} color={colors.textSecondary}>
                  ربحت من هذا الطلب
                </Txt>
                <Txt size={16} weight="black" color={colors.goldDeep}>
                  +{toArabicDigits(order.pointsEarned)} نقطة
                </Txt>
              </View>
            ) : null}
          </Card>
        ) : null}

        <View style={{ width: '100%', marginTop: spacing.xl, gap: 10 }}>
          {id ? <Button label="عرض الطلب" variant="gold" onPress={() => router.replace(`/orders/${id}`)} /> : null}
          <Button label="العودة للرئيسية" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}
