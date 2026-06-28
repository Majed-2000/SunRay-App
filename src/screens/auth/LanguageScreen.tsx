import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { LOGO } from '@/assets';
import { Button, ScreenContainer, Txt } from '@/components';
import { useAuthStore, toast } from '@/store';
import type { LocaleCode } from '@/i18n';

const OPTIONS: { code: LocaleCode; titleAr: string; native: string; soon?: boolean }[] = [
  { code: 'ar', titleAr: 'العربية', native: 'العربية' },
  { code: 'en', titleAr: 'الإنجليزية', native: 'English', soon: true },
];

export function LanguageScreen() {
  const setLocale = useAuthStore((s) => s.setLocale);
  const [selected, setSelected] = useState<LocaleCode>('ar');

  const onContinue = () => {
    setLocale('ar'); // Arabic-first MVP; English coming soon
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing['2xl'] }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <Image source={LOGO} style={{ width: 88, height: 88 }} />
          <Txt size={24} weight="black" color={colors.ink} style={{ marginTop: spacing.md }}>
            اختر لغتك
          </Txt>
          <Txt size={14} color={colors.textMuted} center style={{ marginTop: 6 }}>
            يمكنك تغيير اللغة لاحقًا من الإعدادات
          </Txt>
        </View>

        {OPTIONS.map((opt) => {
          const active = selected === opt.code;
          return (
            <Pressable
              key={opt.code}
              onPress={() => {
                if (opt.soon) {
                  toast('الإنجليزية قريبًا ☀');
                  return;
                }
                setSelected(opt.code);
              }}
              style={[
                shadows.sm,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.lg,
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                  borderWidth: 2,
                  borderColor: active ? colors.gold : 'transparent',
                  opacity: opt.soon ? 0.65 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Txt size={18} weight="extraBold" color={colors.ink}>
                  {opt.titleAr}
                </Txt>
                <Txt size={13} color={colors.textFaint}>
                  {opt.native}
                  {opt.soon ? ' · قريبًا' : ''}
                </Txt>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={26} color={colors.gold} /> : null}
            </Pressable>
          );
        })}

        <Button label="متابعة" onPress={onContinue} style={{ marginTop: spacing.lg }} />
      </View>
    </ScreenContainer>
  );
}
