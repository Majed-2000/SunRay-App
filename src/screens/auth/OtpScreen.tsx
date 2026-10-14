import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { CONFIG } from '@/constants/config';
import { Button, Header, ScreenContainer, Txt } from '@/components';
import { useAuthStore, toast } from '@/store';
import { toArabicDigits, toWesternDigits } from '@/utils/numerals';
import { formatMobileDisplay, ltr } from '@/utils/validators';
import { cooldownRemaining } from '@/utils/otpCooldown';

const LENGTH = 4;
/** How long the success state lingers before continuing to home. */
const SUCCESS_DELAY = 1200;

export function OtpScreen() {
  const phone = useAuthStore((s) => s.pendingPhone);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const [code, setCode] = useState('');
  // Server-driven: the store records when the next send is allowed.
  const [seconds, setSeconds] = useState(() => cooldownRemaining(useAuthStore.getState().otpCooldownEndsAt));
  const [verified, setVerified] = useState(false);
  const inputRef = useRef<TextInput>(null);

  /**
   * Resend the code — for real, through the same endpoint that sent the first.
   *
   * This button used to reset the countdown and toast "تم إرسال الرمز مجددًا"
   * without calling anything. Harmless while OTP was mocked and any four digits
   * passed; a dead end now that Yamamah sends the real code. Someone whose SMS
   * never arrived would tap it, be told it was resent, and wait for a message
   * that was never requested.
   *
   * The countdown only restarts when the send is accepted. Restarting it on
   * failure would lock them out of retrying for another 30 seconds over a
   * request that never left the phone. The length comes from the server's
   * `cooldownSec` (default 60), recorded by the store on every accepted send.
   */
  const [resending, setResending] = useState(false);
  const resend = async () => {
    if (resending || !phone) return;
    setResending(true);
    try {
      const sent = await requestOtp(phone);
      if (sent) {
        setSeconds(cooldownRemaining(useAuthStore.getState().otpCooldownEndsAt));
        setCode('');
        toast('تم إرسال الرمز مجددًا');
        inputRef.current?.focus();
      } else {
        toast(useAuthStore.getState().authError ?? 'تعذّر إرسال الرمز، حاول مرة أخرى');
      }
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (verified) return; // stop trying to focus once we've switched to success
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [verified]);

  /**
   * One verification at a time. The fourth digit auto-submits and «تأكيد»
   * submits too; the code is single-use, so the second request came back
   * "wrong", toasted «الرمز غير صحيح» and cleared the boxes while the first was
   * signing the customer in — and on a slow network each extra tap burned one
   * of the five attempts.
   */
  const verifyingRef = useRef(false);
  const [verifying, setVerifying] = useState(false);
  const submit = async (value: string) => {
    if (verifyingRef.current) return;
    if (value.length < LENGTH) {
      toast('أدخل رمز التحقق كاملًا');
      return;
    }
    verifyingRef.current = true;
    setVerifying(true);
    let okSignIn = false;
    try {
      okSignIn = await verifyOtp(value);
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
    if (!okSignIn) {
      // The store tells us WHY: wrong · expired · locked after five attempts.
      // "Wrong code" on a lockout leaves the customer typing into a dead prompt.
      toast(useAuthStore.getState().authError ?? 'تعذّر التحقق، حاول مرة أخرى');
      setCode('');
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
            {ltr(`${CONFIG.COUNTRY_DIAL_CODE} ${formatMobileDisplay(phone)}`)}
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
              color={resending ? colors.textFaint : colors.goldDeep}
              onPress={resending ? undefined : resend}
            >
              {resending ? 'جارٍ الإرسال…' : 'إعادة إرسال الرمز'}
            </Txt>
          )}
        </View>

        <Button label="تأكيد" onPress={() => submit(code)} loading={verifying} disabled={verifying} style={{ marginTop: spacing['2xl'] }} />
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
