import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  Button,
  Card,
  Header,
  OptionChip,
  ScreenContainer,
  TextField,
  Txt,
  WalletBalanceCard,
} from '@/components';
import { CONFIG } from '@/constants/config';
import { toArabicDigits, toWesternDigits } from '@/utils/numerals';
import { useWalletStore, toast } from '@/store';

export function WalletTopupScreen() {
  const balance = useWalletStore((s) => s.balance);
  const topup = useWalletStore((s) => s.topup);
  const [amount, setAmount] = useState<number>(CONFIG.WALLET_TOPUP_PRESETS[1]);
  const [custom, setCustom] = useState('');

  const finalAmount = custom ? Number(toWesternDigits(custom).replace(/\D/g, '')) : amount;

  const onTopup = () => {
    if (!finalAmount || finalAmount <= 0) {
      toast('أدخل مبلغًا صحيحًا');
      return;
    }
    topup(finalAmount);
    toast('تم شحن المحفظة 🎉');
    router.back();
  };

  return (
    <ScreenContainer header={<Header showBack title="شحن المحفظة" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <WalletBalanceCard balance={balance} />

        <Txt size={15} weight="black" color={colors.ink} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          اختر المبلغ
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {CONFIG.WALLET_TOPUP_PRESETS.map((preset) => (
            <OptionChip
              key={preset}
              label={`${toArabicDigits(preset)} ﷼`}
              selected={!custom && amount === preset}
              onPress={() => {
                setAmount(preset);
                setCustom('');
              }}
              block
            />
          ))}
        </View>

        <TextField
          label="أو مبلغ مخصص"
          placeholder="٠٠ ﷼"
          keyboardType="number-pad"
          value={custom}
          onChangeText={setCustom}
          containerStyle={{ marginTop: spacing.xl }}
          ltr
        />

        <Card radiusKey="md" style={{ marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt size={14} color={colors.textSecondary}>
            الرصيد بعد الشحن
          </Txt>
          <Txt size={16} weight="black" color={colors.terracotta}>
            {toArabicDigits(balance + (finalAmount || 0))} ﷼
          </Txt>
        </Card>

        <Button label="شحن الآن" variant="gold" style={{ marginTop: spacing.xl }} onPress={onTopup} />
        <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.lg }}>
          🔒 شحن تجريبي — لا يتم خصم أي مبلغ حقيقي
        </Txt>
      </View>
    </ScreenContainer>
  );
}
