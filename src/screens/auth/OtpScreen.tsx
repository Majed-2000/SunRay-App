import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { CONFIG } from '@/constants/config';
import { Button, Header, ScreenContainer, Txt } from '@/components';
import { useAuthStore, toast } from '@/store';
import { toArabicDigits, toWesternDigits } from '@/utils/numerals';
import { formatMobileDisplay } from '@/utils/validators';

const LENGTH = 4;
/** How long the success state lingers before continuing to home. */
const SUCCESS_DELAY = 1200;

export function OtpScreen() {
  const phone = useAuthStore((s) => s.pendingPhone);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [verified, setVerified] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (verified) return; // stop trying to focus once we've switched to success
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [verified]);

  const submit = async (value: string) => {
    if (value.length < LENGTH) {
      toast('أدخل رمز التحقق كاملًا');
      return;
    }
    // Mock mode: any 4 digits works. Backend mode: POST /api/auth/verify.
    const okSignIn = await verifyOtp(value);
    if (!okSignIn) {
      toast('رمز غير صحيح أو تعذّر الاتصال بالخادم');
      return;
    }
    // Show a brief "verified successfully" moment, then continue.
    inputRef.current?.blur();
    setVerified(true);
  };

  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => router.replace('/(tabs)/home'), SUCCESS_DELAY);
    return () => clearTimeout(t);
  }, [verified]);

  if (verified) return <VerifiedSuccess />;

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

/** "تم التحقق بنجاح" — brief success state shown after a correct code. */
function VerifiedSuccess() {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
          <View
            style={[
              shadows.goldStrong,
              {
                width: 104,
                height: 104,
                borderRadius: radius['2xl'],
                backgroundColor: colors.gold,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Ionicons name="checkmark" size={56} color={colors.inkDeep} />
          </View>

          <Txt size={28} weight="black" color={colors.ink} center style={{ marginTop: spacing.xl }}>
            تم التحقق بنجاح
          </Txt>
          <Txt size={14} color={colors.textMuted} center style={{ marginTop: 8 }}>
            تم تأكيد رقم هاتفك بنجاح
          </Txt>
          <Txt size={12} color={colors.textFaint} center style={{ marginTop: spacing.xl }}>
            ...جارٍ المتابعة
          </Txt>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
