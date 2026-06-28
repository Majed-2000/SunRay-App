import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  GiftCardPreview,
  Header,
  OptionChip,
  PhoneField,
  ScreenContainer,
  TextField,
  Txt,
} from '@/components';
import { giftDesigns, giftDesignById } from '@/data';
import { CONFIG } from '@/constants/config';
import { toArabicDigits } from '@/utils/numerals';
import { isValidSaudiMobile, normalizeMobile, formatMobileDisplay } from '@/utils/validators';
import { useAuthStore, useGiftStore, useLoyaltyStore, toast } from '@/store';

export function GiftCreateScreen() {
  const params = useLocalSearchParams<{ designId?: string; amount?: string }>();
  const user = useAuthStore((s) => s.user);
  const createGift = useGiftStore((s) => s.createGift);
  const earn = useLoyaltyStore((s) => s.earn);

  const [amount, setAmount] = useState<number>(Number(params.amount) || CONFIG.GIFT_AMOUNT_PRESETS[1]);
  const [designId, setDesignId] = useState<string>(params.designId ?? 'gold');
  const [custom, setCustom] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');

  const design = giftDesignById(designId);
  const finalAmount = custom ? Number(custom.replace(/\D/g, '')) || 0 : amount;

  const onSend = () => {
    if (!finalAmount || finalAmount < 10) {
      toast('اختر قيمة لا تقل عن ١٠ ﷼');
      return;
    }
    if (!isValidSaudiMobile(recipientPhone)) {
      toast('أدخل رقم جوال صحيح للمستلم');
      return;
    }
    const card = createGift({
      amount: finalAmount,
      designId,
      senderName: user?.name ?? 'صديقك',
      recipientName,
      recipientPhone: normalizeMobile(recipientPhone),
      message,
    });
    earn(Math.round(finalAmount / 2));
    toast('تم إرسال الهدية ☀');
    router.replace(`/gift/${card.id}`);
  };

  return (
    <ScreenContainer header={<Header showBack title="بطاقة إهداء" />}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing['5xl'] }}>
        {/* live preview */}
        <GiftCardPreview
          design={design}
          amount={finalAmount}
          footerStart={recipientName ? `إلى ${recipientName}` : 'إلى المستلم'}
          footerEnd={recipientPhone ? formatMobileDisplay(recipientPhone) : undefined}
        />

        <Txt size={12} color={colors.textMuted} center style={{ marginTop: spacing.md, lineHeight: 19 }}>
          سيصل المستلم كودًا، وعند استبداله يُضاف مبلغ البطاقة إلى محفظته.
        </Txt>

        {/* amount */}
        <Label>اختر القيمة</Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {CONFIG.GIFT_AMOUNT_PRESETS.map((p) => (
            <OptionChip
              key={p}
              label={`${toArabicDigits(p)} ﷼`}
              selected={!custom && amount === p}
              onPress={() => {
                setAmount(p);
                setCustom('');
              }}
              block
            />
          ))}
        </View>
        <TextField placeholder="قيمة مخصصة ﷼" keyboardType="number-pad" value={custom} onChangeText={setCustom} containerStyle={{ marginTop: 10 }} ltr />

        {/* design */}
        <Label>اختر التصميم</Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {giftDesigns.map((d) => (
            <OptionChip key={d.id} label={d.nameAr} selected={designId === d.id} onPress={() => setDesignId(d.id)} variant="gold" block />
          ))}
        </View>

        {/* recipient */}
        <Label>اسم المستلم</Label>
        <TextField placeholder="مثال: نوف" value={recipientName} onChangeText={setRecipientName} />

        <Label>رقم جوال المستلم</Label>
        <PhoneField value={recipientPhone} onChangeText={setRecipientPhone} />

        {/* message */}
        <Label>رسالة قصيرة</Label>
        <TextField
          placeholder="اكتب كلمة مشرقة…"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={120}
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />

        <Button label="أرسل الهدية" variant="gold" trailing={`${toArabicDigits(finalAmount)} ﷼`} style={{ marginTop: spacing.xl }} onPress={onSend} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
      {children}
    </Txt>
  );
}
