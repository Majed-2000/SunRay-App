import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  BranchPickerSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  Header,
  OptionChip,
  PriceRow,
  QtyStepper,
  ScreenContainer,
  Sheet,
  TextField,
  Txt,
} from '@/components';
import type { OrderType } from '@/types';
import { strings } from '@/i18n';
import { formatRiyal } from '@/utils/numerals';
import { useCartTotals } from '@/hooks/useCartTotals';
import { useResponsive } from '@/hooks/useResponsive';
import {
  useAddressStore,
  useBranchStore,
  useCartStore,
} from '@/store';

const SCHEDULE_OPTIONS = ['في أقرب وقت', '٥:٠٠ م', '٦:٠٠ م', '٧:٠٠ م', '٨:٠٠ م'];

export function CartScreen() {
  const insets = useSafeAreaInsets();
  const { contentMaxWidth } = useResponsive();
  const [branchOpen, setBranchOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [coupon, setCoupon] = useState('');

  const lines = useCartStore((s) => s.lines);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const incLine = useCartStore((s) => s.incLine);
  const decLine = useCartStore((s) => s.decLine);
  const removeLine = useCartStore((s) => s.removeLine);
  const appliedCoupon = useCartStore((s) => s.coupon);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);
  const addressId = useCartStore((s) => s.addressId);
  const setAddress = useCartStore((s) => s.setAddress);
  const scheduledTime = useCartStore((s) => s.scheduledTime);
  const setScheduledTime = useCartStore((s) => s.setScheduledTime);

  const branch = useBranchStore((s) => s.current());
  const addresses = useAddressStore((s) => s.addresses);
  const selectedAddress = addresses.find((a) => a.id === addressId) ?? addresses.find((a) => a.isDefault);

  const totals = useCartTotals();
  const t = strings();
  const isDelivery = orderType === 'delivery';

  if (lines.length === 0) {
    return (
      <ScreenContainer header={<Header showBack title="سلّتك" />}>
        <EmptyState
          emoji="🧺"
          title={t.empty.cart}
          subtitle={t.empty.cartHint}
          actionLabel="تصفّح القائمة"
          onAction={() => router.replace('/(tabs)/menu')}
        />
      </ScreenContainer>
    );
  }

  return (
    <>
      <ScreenContainer
        scroll={false}
        padded={false}
        header={
          <View style={{ paddingHorizontal: spacing['2xl'] }}>
            <Header showBack title={`سلّتك · ${t.orderType[orderType].split(' ')[0]}`} />
          </View>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}>
          <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          {/* order type */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            {(['pickup', 'delivery', 'dineIn'] as OrderType[]).map((type) => (
              <OptionChip
                key={type}
                label={t.orderType[type].split(' ')[0]}
                selected={orderType === type}
                onPress={() => setOrderType(type)}
                block
              />
            ))}
          </View>

          {/* fulfillment rows */}
          <Card padding={0} style={{ marginBottom: spacing.lg, overflow: 'hidden' }}>
            <FulfillRow
              icon="storefront-outline"
              label="الفرع"
              value={branch.nameAr}
              onPress={() => setBranchOpen(true)}
            />
            {isDelivery ? (
              <>
                <Divider marginV={0} />
                <FulfillRow
                  icon="location-outline"
                  label="عنوان التوصيل"
                  value={selectedAddress?.titleAr ?? 'اختر عنوانًا'}
                  onPress={() => setAddressOpen(true)}
                />
              </>
            ) : null}
            <Divider marginV={0} />
            <FulfillRow
              icon="time-outline"
              label={isDelivery ? 'وقت التوصيل' : 'وقت الاستلام'}
              value={scheduledTime ?? 'في أقرب وقت'}
              onPress={() => setTimeOpen(true)}
            />
          </Card>

          {/* items */}
          <View style={{ gap: 12 }}>
            {lines.map((line) => (
              <View
                key={line.id}
                style={[
                  shadows.sm,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: colors.card,
                    borderRadius: radius.lg,
                    padding: 13,
                  },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt size={15} weight="extraBold" color={colors.ink}>
                      {line.emoji} {line.nameAr}
                    </Txt>
                  </View>
                  <Txt size={11} color={colors.textFaint} style={{ marginTop: 1 }}>
                    {line.optionLabel}
                  </Txt>
                  {line.notes ? (
                    <Txt size={11} color={colors.textMuted} style={{ marginTop: 1 }}>
                      📝 {line.notes}
                    </Txt>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <Txt size={14} weight="black" color={colors.terracotta}>
                      {formatRiyal(line.unitPrice * line.qty)}
                    </Txt>
                    <Pressable onPress={() => removeLine(line.id)} hitSlop={6}>
                      <Txt size={12} weight="bold" color={colors.danger}>
                        حذف
                      </Txt>
                    </Pressable>
                  </View>
                </View>
                <QtyStepper
                  size="sm"
                  value={line.qty}
                  onInc={() => incLine(line.id)}
                  onDec={() => decLine(line.id)}
                />
              </View>
            ))}
          </View>

          {/* coupon */}
          <Card style={{ marginTop: spacing.lg }} radiusKey="lg">
            {appliedCoupon ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="pricetag" size={16} color={colors.success} />
                  <Txt size={14} weight="extraBold" color={colors.ink}>
                    {appliedCoupon.code}
                  </Txt>
                  <Txt size={12} color={colors.textMuted}>
                    {appliedCoupon.titleAr}
                  </Txt>
                </View>
                <Pressable onPress={removeCoupon} hitSlop={6}>
                  <Txt size={13} weight="bold" color={colors.danger}>
                    إزالة
                  </Txt>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TextField
                  placeholder="كود الخصم"
                  value={coupon}
                  onChangeText={setCoupon}
                  autoCapitalize="characters"
                  containerStyle={{ flex: 1 }}
                  ltr
                />
                <Button
                  label="تطبيق"
                  size="sm"
                  fullWidth={false}
                  variant="outline"
                  onPress={() => {
                    if (applyCoupon(coupon)) setCoupon('');
                  }}
                />
              </View>
            )}
          </Card>

          {/* totals */}
          <Card style={{ marginTop: spacing.lg }} radiusKey="lg">
            <PriceRow label="المجموع الفرعي" amount={totals.subtotal} />
            <PriceRow label="ضريبة القيمة المضافة (١٥٪)" amount={totals.vat} />
            {isDelivery ? (
              <PriceRow label="رسوم التوصيل" amount={totals.deliveryFee === 0 ? 'مجانًا' : totals.deliveryFee} />
            ) : null}
            {totals.discount > 0 ? <PriceRow label="الخصم" amount={totals.discount} positive /> : null}
            <Divider dashed />
            <PriceRow label="الإجمالي" amount={totals.total} emphasize />
          </Card>
          </View>
        </ScrollView>
      </ScreenContainer>

      {/* checkout bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        }}
      >
        <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          <Button label="متابعة الدفع" trailing={formatRiyal(totals.total)} onPress={() => router.push('/checkout')} />
        </View>
      </View>

      <BranchPickerSheet visible={branchOpen} onClose={() => setBranchOpen(false)} />

      {/* address sheet */}
      <Sheet visible={addressOpen} onClose={() => setAddressOpen(false)} title="عنوان التوصيل">
        <View style={{ padding: spacing.lg, gap: 10 }}>
          {addresses.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setAddress(a.id);
                setAddressOpen(false);
              }}
              style={[
                shadows.xs,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                  borderWidth: 1.5,
                  borderColor: selectedAddress?.id === a.id ? colors.gold : 'transparent',
                },
              ]}
            >
              <Ionicons name="location" size={18} color={colors.terracotta} />
              <View style={{ flex: 1 }}>
                <Txt size={14} weight="extraBold" color={colors.ink}>
                  {a.titleAr}
                </Txt>
                <Txt size={12} color={colors.textFaint}>
                  {a.detailsAr}
                </Txt>
              </View>
            </Pressable>
          ))}
          <Button
            label="+ إضافة عنوان جديد"
            variant="outline"
            onPress={() => {
              setAddressOpen(false);
              router.push('/address-new');
            }}
          />
        </View>
      </Sheet>

      {/* time sheet */}
      <Sheet visible={timeOpen} onClose={() => setTimeOpen(false)} title="اختر الوقت">
        <View style={{ padding: spacing.lg, gap: 10 }}>
          {SCHEDULE_OPTIONS.map((opt) => {
            const value = opt === 'في أقرب وقت' ? null : opt;
            const active = scheduledTime === value;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  setScheduledTime(value);
                  setTimeOpen(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                  borderWidth: 1.5,
                  borderColor: active ? colors.gold : colors.borderSoft,
                }}
              >
                <Txt size={15} weight="bold" color={colors.ink}>
                  {opt}
                </Txt>
                {active ? <Ionicons name="checkmark-circle" size={20} color={colors.gold} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

function FulfillRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg }}
    >
      <Ionicons name={icon} size={20} color={colors.terracotta} />
      <View style={{ flex: 1 }}>
        <Txt size={11} color={colors.textFaint}>
          {label}
        </Txt>
        <Txt size={14} weight="extraBold" color={colors.ink}>
          {value}
        </Txt>
      </View>
      <Ionicons name="chevron-back" size={18} color={colors.textGoldSoft} />
    </Pressable>
  );
}
