import { useState } from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, shadows, spacing } from '@/theme';
import { LOGO } from '@/assets';
import { Button, PhoneField, Txt } from '@/components';
import { useAuthStore, toast } from '@/store';
import { isValidSaudiMobile, normalizeMobile } from '@/utils/validators';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);

  const valid = isValidSaudiMobile(phone);

  const onLogin = () => {
    if (!valid) {
      toast('أدخل رقم جوال صحيح');
      return;
    }
    setPendingPhone(normalizeMobile(phone));
    router.push('/(auth)/otp');
  };

  const onGuest = () => {
    continueAsGuest();
    router.replace('/(tabs)/home');
  };

  return (
    <LinearGradient
      colors={['#f6eedd', '#efe6d6']}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['4xl'], paddingTop: insets.top }}
    >
      <View style={{ position: 'absolute', top: 80, width: 260, height: 260, borderRadius: 130, backgroundColor: colors.gold, opacity: 0.16 }} />

      <Image source={LOGO} style={{ width: 120, height: 120 }} resizeMode="contain" />
      <Txt size={36} weight="black" color={colors.ink} latin style={{ marginTop: 14 }}>
        Sun Ray
      </Txt>
      <Txt size={17} weight="extraBold" color={colors.terracotta}>
        سن راي
      </Txt>
      <Txt size={13} weight="medium" color={colors.textMuted} style={{ marginTop: 10 }}>
        سجّل دخولك لتبدأ يومك مشرقًا
      </Txt>

      {/* phone field — LTR digits in an RTL app */}
      <PhoneField value={phone} onChangeText={setPhone} style={[shadows.sm, { width: '100%', marginTop: 34 }]} />

      <Button label="تسجيل الدخول" onPress={onLogin} style={{ marginTop: 12 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginTop: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        <Txt size={11} color={colors.textFaint}>
          أو
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      </View>

      <Button label="المتابعة كضيف" variant="outline" onPress={onGuest} style={{ marginTop: 16 }} />

      <Txt size={11} color={colors.textFaint} center style={{ marginTop: 20, lineHeight: 18 }}>
        بالمتابعة فأنت توافق على الشروط وسياسة الخصوصية
      </Txt>
    </LinearGradient>
  );
}
