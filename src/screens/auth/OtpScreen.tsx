import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { CONFIG } from '@/constants/config';
import { Button, Header, ScreenContainer, Txt } from '@/components';
import { useAuthStore, toast } from '@/store';
import { toArabicDigits, toWesternDigits } from '@/utils/numerals';
import { formatMobileDisplay } from '@/utils/validators';

const LENGTH = 4;

export function OtpScreen() {
  const phone = useAuthStore((s) => s.pendingPhone);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const submit = (value: string) => {
    if (value.length < LENGTH) {
      toast('أدخل رمز التحقق كاملًا');
      return;
    }
    verifyOtp();
    router.replace('/(tabs)/home');
  };

  return (
    <ScreenContainer header={<Header showBack />}>
      <View style={{ marginTop: spacing.lg }}>
        <Txt size={28} weight="black" color={colors.ink}>
          رمز التحقق
        </Txt>
        <Txt size={14} color={colors.textMuted} style={{ marginTop: 8, lineHeight: 22 }}>
          أرسلنا رمزًا مكوّنًا من ٤ أرقام إلى{'\n'}
          <Txt size={14} weight="extraBold" color={colors.ink}>
            {CONFIG.COUNTRY_DIAL_CODE} {formatMobileDisplay(phone)}
          </Txt>
        </Txt>

        {/* hidden input drives the boxes */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12, marginTop: spacing['3xl'] }}
        >
          {Array.from({ length: LENGTH }).map((_, i) => {
            const char = code[i];
            const focused = i === code.length;
            return (
              <View
                key={i}
                style={[
                  shadows.xs,
                  {
                    flex: 1,
                    height: 64,
                    borderRadius: radius.lg,
                    backgroundColor: colors.card,
                    borderWidth: 1.5,
                    borderColor: char || focused ? colors.gold : colors.borderSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Txt size={26} weight="black" color={colors.ink}>
                  {char ? toArabicDigits(char) : ''}
                </Txt>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => {
            const digits = toWesternDigits(t).replace(/\D/g, '').slice(0, LENGTH);
            setCode(digits);
            if (digits.length === LENGTH) submit(digits);
          }}
          keyboardType="number-pad"
          maxLength={LENGTH}
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />

        <View style={{ marginTop: spacing['2xl'], alignItems: 'center' }}>
          {seconds > 0 ? (
            <Txt size={13} color={colors.textFaint}>
              إعادة الإرسال خلال {toArabicDigits(seconds)} ثانية
            </Txt>
          ) : (
            <Txt
              size={13}
              weight="extraBold"
              color={colors.terracotta}
              onPress={() => {
                setSeconds(30);
                toast('تم إرسال الرمز مجددًا');
              }}
            >
              إعادة إرسال الرمز
            </Txt>
          )}
        </View>

        <Button label="تأكيد" onPress={() => submit(code)} style={{ marginTop: spacing['2xl'] }} />
        <Txt size={12} color={colors.textFaint} center style={{ marginTop: spacing.lg }}>
          للتجربة: أدخل أي ٤ أرقام
        </Txt>
      </View>
    </ScreenContainer>
  );
}
