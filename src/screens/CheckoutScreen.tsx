import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  Button,
  Card,
  Divider,
  Header,
  PriceRow,
  ScreenContainer,
  Txt,
} from '@/components';
import type { PaymentMethod } from '@/types';
import { CONFIG } from '@/constants/config';
import { strings } from '@/i18n';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { pointsEarned } from '@/utils/money';
import { useCartTotals } from '@/hooks/useCartTotals';
import { useResponsive } from '@/hooks/useResponsive';
import { USE_BACKEND } from '@/services/api';
import {
  useAuthStore,
  useBranchStore,
  useCartStore,
  useCatalogStore,
  useLoyaltyStore,
  useOrderStore,
  useWalletStore,
  toast,
} from '@/store';

const METHODS: { id: PaymentMethod; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'wallet', label: 'محفظة سن راي', sub: 'الدفع من رصيدك', icon: 'wallet' },
  { id: 'card', label: 'بطاقة مدى / فيزا', sub: '•••• ٤٢٣٧', icon: 'card' },
  { id: 'applePay', label: 'Apple Pay', sub: 'دفع سريع', icon: 'logo-apple' },
  { id: 'cash', label: 'الدفع عند الاستلام', sub: 'نقدًا أو بالبطاقة', icon: 'cash' },
];

export function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const orderType = useCartStore((s) => s.orderType);
  const addressId = useCartStore((s) => s.addressId);
  const useWallet = useCartStore((s) => s.useWallet);
  const setUseWallet = useCartStore((s) => s.setUseWallet);
  const redeemPoints = useCartStore((s) => s.redeemPoints);
  const setRedeemPoints = useCartStore((s) => s.setRedeemPoints);
  const clear = useCartStore((s) => s.clear);

  const walletBalance = useWalletStore((s) => s.balance);
  const points = useLoyaltyStore((s) => s.points);
  const branch = useBranchStore((s) => s.current());
  const isGuest = useAuthStore((s) => s.isGuest);
  const totals = useCartTotals();
  const { contentMaxWidth } = useResponsive();
  const t = strings();

  const [method, setMethod] = useState<PaymentMethod>(walletBalance > 0 ? 'wallet' : 'card');
  const [submitting, setSubmitting] = useState(false);

  // In backend mode the server ignores coupon/points/wallet (discount is forced to
  // 0 this phase), so we show the server-aligned total and hide those perks — the
  // checkout must never display a discount it won't actually apply.
  const displayTotal = USE_BACKEND ? totals.subtotal + totals.vat + totals.deliveryFee : totals.total;

  const place = async () => {
    // Backend mode: send the cart to the server (it computes the totals), then
    // go to success. Wallet/loyalty stay mock and are not touched here.
    if (USE_BACKEND) {
      // Ordering requires a signed-in customer (no anonymous orders). Send guests
      // to login first; the cart is preserved so they can come back and check out.
      if (isGuest) {
        toast('سجّل دخولك لإتمام الطلب');
        router.push('/(auth)/login');
        return;
      }
      if (submitting) return;
      setSubmitting(true);
      const result = await useOrderStore.getState().submitToBackend({
        branchId: branch.id,
        type: orderType,
        lines,
      });
      setSubmitting(false);
      if (!result.ok) {
        // Cart is kept in every failure case so nothing is lost.
        if (result.reason === 'auth') {
          // The session expired and couldn't refresh — onSessionExpired already
          // routes to login; just explain why.
          toast('انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى لإكمال الطلب');
        } else if (result.reason === 'network') {
          toast('تعذّر الاتصال بالإنترنت، تأكد من الشبكة وحاول مجددًا');
        } else {
          toast('تعذّر إرسال الطلب، حاول مجددًا');
        }
        return;
      }
      clear();
      router.replace(`/order-success?id=${result.order.id}`);
      return;
    }

    // Mock mode (unchanged): compute locally + update mock wallet/loyalty.
    const order = useOrderStore.getState().place({
      type: orderType,
      branchId: branch.id,
      addressId: addressId ?? undefined,
      items: lines.map((l) => ({
        nameAr: l.nameAr,
        optionLabel: l.optionLabel,
        qty: l.qty,
        lineTotal: l.unitPrice * l.qty,
      })),
      subtotal: totals.subtotal,
      vat: totals.vat,
      deliveryFee: totals.deliveryFee,
      discount: totals.discount + totals.pointsDiscount,
      total: totals.total,
      paymentMethod: method,
      pointsEarned: pointsEarned(totals.subtotal),
      etaMinutes: orderType === 'delivery' ? 25 : 12,
    });

    if (useWallet && totals.walletApplied > 0) {
      useWalletStore.getState().debit(totals.walletApplied, `طلب ${order.id}`);
    }
    if (method === 'wallet') {
      useWalletStore.getState().debit(totals.total, `طلب ${order.id}`);
    }
    if (redeemPoints && totals.pointsSpent > 0) {
      useLoyaltyStore.getState().spend(totals.pointsSpent);
    }
    useLoyaltyStore.getState().earn(order.pointsEarned);

    // Path A loyalty: count eligible coffee cups (the backend does this from
    // `customer.order.created` webhooks in production).
    const coffeeCups = lines.reduce((n, l) => {
      const cat = useCatalogStore.getState().productById(l.productId)?.categoryId;
      return cat && (CONFIG.COFFEE_CATEGORY_IDS as readonly string[]).includes(cat) ? n + l.qty : n;
    }, 0);
    useLoyaltyStore.getState().addCups(coffeeCups);

    clear();
    router.replace(`/order-success?id=${order.id}`);
  };

  return (
    <>
      <ScreenContainer
        scroll={false}
        padded={false}
        header={
          <View style={{ paddingHorizontal: spacing['2xl'] }}>
            <Header showBack title="الدفع" />
          </View>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}>
          <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
          {/* summary */}
          <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={orderType === 'delivery' ? 'bicycle' : 'storefront'} size={20} color={colors.terracotta} />
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="extraBold" color={colors.ink}>
                  {t.orderType[orderType]}
                </Txt>
                <Txt size={12} color={colors.textFaint}>
                  {branch.nameAr} · {toArabicDigits(totals.count)} عناصر
                </Txt>
              </View>
            </View>
          </Card>

          {/* payment methods */}
          <Txt size={15} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
            طريقة الدفع
          </Txt>
          <View style={{ gap: 10 }}>
            {METHODS.map((m) => {
              const active = method === m.id;
              const disabled = m.id === 'wallet' && walletBalance <= 0;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => !disabled && setMethod(m.id)}
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
                      borderColor: active ? colors.gold : 'transparent',
                      opacity: disabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.sm,
                      backgroundColor: colors.chip,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={m.icon} size={18} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="extraBold" color={colors.ink}>
                      {m.label}
                    </Txt>
                    <Txt size={12} color={colors.textFaint}>
                      {m.id === 'wallet' ? formatRiyal(walletBalance) : m.sub}
                    </Txt>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.gold : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* perks — hidden in backend mode (the server doesn't apply them yet) */}
          {!USE_BACKEND ? (
            <>
              <Txt size={15} weight="black" color={colors.ink} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
                خصومات ومكافآت
              </Txt>
              <Card radiusKey="lg" padding={0} style={{ overflow: 'hidden' }}>
                <PerkToggle
                  icon="wallet-outline"
                  label="استخدام رصيد المحفظة"
                  sub={formatRiyal(walletBalance)}
                  value={useWallet}
                  disabled={walletBalance <= 0 || method === 'wallet'}
                  onToggle={() => setUseWallet(!useWallet)}
                />
                <Divider marginV={0} />
                <PerkToggle
                  icon="star-outline"
                  label="استبدال نقاطي"
                  sub={`${toArabicDigits(points)} نقطة متاحة`}
                  value={redeemPoints}
                  disabled={points <= 0}
                  onToggle={() => setRedeemPoints(!redeemPoints)}
                />
              </Card>
            </>
          ) : null}

          {/* totals */}
          <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
            <PriceRow label="المجموع الفرعي" amount={totals.subtotal} />
            <PriceRow label="ضريبة القيمة المضافة (١٥٪)" amount={totals.vat} />
            {orderType === 'delivery' ? (
              <PriceRow label="رسوم التوصيل" amount={totals.deliveryFee === 0 ? 'مجانًا' : totals.deliveryFee} />
            ) : null}
            {!USE_BACKEND && totals.discount > 0 ? <PriceRow label="خصم الكوبون" amount={totals.discount} positive /> : null}
            {!USE_BACKEND && totals.pointsDiscount > 0 ? (
              <PriceRow label={`استبدال ${toArabicDigits(totals.pointsSpent)} نقطة`} amount={totals.pointsDiscount} positive />
            ) : null}
            {!USE_BACKEND && totals.walletApplied > 0 ? <PriceRow label="رصيد المحفظة" amount={totals.walletApplied} positive /> : null}
            <Divider dashed />
            <PriceRow label="الإجمالي المستحق" amount={displayTotal} emphasize />
          </Card>

          <View style={{ marginTop: spacing.lg, gap: 6 }}>
            <Txt size={11} color={colors.textFaint} center style={{ lineHeight: 18 }}>
              ℹ️ بعد الإرسال يظهر طلبك «قيد الانتظار» حتى يقبله الفرع، ثم يتحوّل إلى
              قيد التحضير فجاهز/في الطريق.
            </Txt>
            <Txt size={11} color={colors.textFaint} center style={{ lineHeight: 18 }}>
              🔒 تجربة تجريبية — لا يتم تنفيذ أي دفع حقيقي أو إرسال طلب فعلي
            </Txt>
          </View>
          </View>
        </ScrollView>
      </ScreenContainer>

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
          <Button
            label={orderType === 'delivery' ? 'اطلب التوصيل' : 'أكمل الطلب'}
            trailing={formatRiyal(displayTotal)}
            onPress={place}
            loading={submitting}
          />
        </View>
      </View>
    </>
  );
}

function PerkToggle({
  icon,
  label,
  sub,
  value,
  disabled,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  value: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}
    >
      <Ionicons name={icon} size={20} color={colors.terracotta} />
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="extraBold" color={colors.ink}>
          {label}
        </Txt>
        <Txt size={12} color={colors.textFaint}>
          {sub}
        </Txt>
      </View>
      <View
        style={{
          width: 46,
          height: 28,
          borderRadius: 14,
          backgroundColor: value ? colors.gold : colors.border,
          padding: 3,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white }} />
      </View>
    </Pressable>
  );
}
