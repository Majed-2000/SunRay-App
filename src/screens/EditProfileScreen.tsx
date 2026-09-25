import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, radius, spacing } from '@/theme';
import { Button, Header, ScreenContainer, Sheet, TextField, Txt } from '@/components';
import { CONFIG } from '@/constants/config';
import { MONTHS_AR_LIST } from '@/utils/date';
import { useAuthStore, useLoyaltyStore, toast } from '@/store';

/**
 * Profile — only what is stored and used.
 *
 * It used to collect email, gender, city and a birth day as well, keep them in
 * memory, report «تم تحديث ملفك» and lose them on restart. None had anywhere
 * to be stored or any use, and collecting data an app does not use is itself a
 * review problem (App Store 5.1.1). What remains:
 *
 * - the name, saved on the Firebase account and sent with orders;
 * - the birth month, saved on the server (`setMyBirthMonth`) for the birthday
 *   reward. The loyalty ledger reports it back, so it survives a reinstall.
 */
export function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const savedMonth = useLoyaltyStore((s) => s.data?.birthMonth ?? undefined);

  const [name, setName] = useState(user?.name ?? '');
  const [birthMonth, setBirthMonth] = useState<number | undefined>(user?.birthMonth ?? savedMonth);
  const [monthOpen, setMonthOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!name.trim()) {
      toast('اكتب اسمك');
      return;
    }
    setSaving(true);
    const ok = await saveProfile({ name, birthMonth });
    setSaving(false);
    if (!ok) {
      toast('تعذّر الحفظ، تحقّق من الاتصال وحاول مرة أخرى');
      return;
    }
    toast('تم حفظ ملفك ☀');
    router.back();
  };

  return (
    <>
      <ScreenContainer
        header={<Header showBack title="تعديل الملف الشخصي" />}
        footer={<Button label="حفظ التغييرات" variant="gold" onPress={onSave} loading={saving} />}
      >
        <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' }}>
          <LinearGradient colors={gradients.goldSoft} style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={34} weight="black" color={colors.inkDeep}>
              {(name.trim().charAt(0) || user?.avatarText) ?? 'ض'}
            </Txt>
          </LinearGradient>
        </View>

        <View style={{ gap: spacing.lg }}>
          <View>
            <TextField label="الاسم" placeholder="اسمك" value={name} onChangeText={setName} maxLength={40} />
            <Txt size={11} color={colors.textFaint} style={{ marginTop: 6 }}>
              يظهر للفرع مع طلبك ليناديك باسمك
            </Txt>
          </View>

          <View>
            <FieldLabel>شهر الميلاد</FieldLabel>
            <SelectRow
              value={birthMonth ? MONTHS_AR_LIST[birthMonth - 1] : undefined}
              placeholder="اختر الشهر"
              onPress={() => setMonthOpen(true)}
            />
            <Txt size={11} color={colors.textFaint} style={{ marginTop: 6 }}>
              لمكافأة يوم ميلادك 🎂 — الشهر يكفي
            </Txt>
          </View>

          {/* phone (read-only) */}
          <View>
            <FieldLabel>رقم الجوال</FieldLabel>
            <View style={{ backgroundColor: colors.chip, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16 }}>
              <Txt size={15} weight="bold" color={colors.textMuted} style={{ writingDirection: 'ltr' }}>
                {CONFIG.COUNTRY_DIAL_CODE} {user?.phone || '—'}
              </Txt>
            </View>
            <Txt size={11} color={colors.textFaint} style={{ marginTop: 6 }}>
              رقمك هو هويتك في الحساب ولا يمكن تغييره
            </Txt>
          </View>
        </View>
      </ScreenContainer>

      <Sheet visible={monthOpen} onClose={() => setMonthOpen(false)} title="شهر الميلاد">
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: spacing.lg, gap: 8 }}>
          {MONTHS_AR_LIST.map((m, i) => {
            const month = i + 1;
            const selected = birthMonth === month;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setBirthMonth(month);
                  setMonthOpen(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 14,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.gold : colors.borderSoft,
                }}
              >
                <Txt size={15} weight="bold" color={colors.ink}>
                  {m}
                </Txt>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.gold} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginBottom: spacing.sm }}>
      {children}
    </Txt>
  );
}

function SelectRow({
  value,
  placeholder,
  onPress,
}: {
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.borderSoft,
        paddingHorizontal: spacing.lg,
        paddingVertical: 15,
      }}
    >
      <Txt size={15} weight={value ? 'bold' : 'regular'} color={value ? colors.ink : colors.textFaint}>
        {value ?? placeholder}
      </Txt>
      <Ionicons name="chevron-down" size={18} color={colors.textGoldSoft} />
    </Pressable>
  );
}
