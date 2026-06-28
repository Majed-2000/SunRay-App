import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, radius, spacing } from '@/theme';
import { Button, Header, OptionChip, ScreenContainer, Sheet, TextField, Txt } from '@/components';
import { CONFIG } from '@/constants/config';
import type { Gender } from '@/types';
import { toArabicDigits } from '@/utils/numerals';
import { MONTHS_AR_LIST } from '@/utils/date';
import { useAuthStore, toast } from '@/store';

const SAUDI_CITIES = [
  'الطائف', 'مكة المكرمة', 'جدة', 'الرياض', 'المدينة المنورة', 'الدمام', 'الخبر',
  'أبها', 'تبوك', 'بريدة', 'حائل', 'جازان', 'نجران', 'الباحة', 'ينبع', 'الجبيل',
];

export function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [gender, setGender] = useState<Gender | undefined>(user?.gender);
  const [city, setCity] = useState<string | undefined>(user?.city);
  const [birthDay, setBirthDay] = useState<number | undefined>(user?.birthDay);
  const [birthMonth, setBirthMonth] = useState<number | undefined>(user?.birthMonth);

  const [cityOpen, setCityOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  const onSave = () => {
    updateProfile({
      name: name.trim() || user?.name,
      email: email.trim(),
      gender,
      city,
      birthDay,
      birthMonth,
    });
    toast('تم تحديث ملفك ☀');
    router.back();
  };

  return (
    <>
      <ScreenContainer
        header={<Header showBack title="تعديل الملف الشخصي" />}
        footer={<Button label="حفظ التغييرات" variant="gold" onPress={onSave} />}
      >
        <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' }}>
          <LinearGradient colors={gradients.goldSoft} style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={34} weight="black" color={colors.inkDeep}>
              {(name.trim().charAt(0) || user?.avatarText) ?? 'ض'}
            </Txt>
          </LinearGradient>
        </View>

        <View style={{ gap: spacing.lg }}>
          <TextField label="الاسم" placeholder="اسمك" value={name} onChangeText={setName} />
          <TextField label="البريد الإلكتروني" placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr />

          {/* gender */}
          <View>
            <FieldLabel>الجنس</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <OptionChip label="أنثى" selected={gender === 'female'} onPress={() => setGender('female')} block />
              <OptionChip label="ذكر" selected={gender === 'male'} onPress={() => setGender('male')} block />
            </View>
          </View>

          {/* city */}
          <View>
            <FieldLabel>المدينة</FieldLabel>
            <SelectRow value={city} placeholder="اختر مدينتك" onPress={() => setCityOpen(true)} />
          </View>

          {/* birthday (day + month, no year) */}
          <View>
            <FieldLabel>تاريخ الميلاد (يوم وشهر)</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <SelectRow value={birthDay ? toArabicDigits(birthDay) : undefined} placeholder="اليوم" onPress={() => setDayOpen(true)} />
              </View>
              <View style={{ flex: 1 }}>
                <SelectRow value={birthMonth ? MONTHS_AR_LIST[birthMonth - 1] : undefined} placeholder="الشهر" onPress={() => setMonthOpen(true)} />
              </View>
            </View>
            <Txt size={11} color={colors.textFaint} style={{ marginTop: 6 }}>
              نستخدمه لإرسال هدية في يوم ميلادك 🎂 (بدون الحاجة للسنة)
            </Txt>
          </View>

          {/* phone (read-only) */}
          <View>
            <FieldLabel>رقم الجوال</FieldLabel>
            <View style={{ backgroundColor: colors.chip, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16 }}>
              <Txt size={15} weight="bold" color={colors.textMuted} style={{ writingDirection: 'ltr' }}>
                {CONFIG.COUNTRY_DIAL_CODE} {user?.phone ?? '—'}
              </Txt>
            </View>
            <Txt size={11} color={colors.textFaint} style={{ marginTop: 6 }}>
              لا يمكن تغيير رقم الجوال حاليًا
            </Txt>
          </View>
        </View>
      </ScreenContainer>

      {/* city sheet */}
      <Sheet visible={cityOpen} onClose={() => setCityOpen(false)} title="اختر المدينة">
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: spacing.lg, gap: 8 }}>
          {SAUDI_CITIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setCity(c);
                setCityOpen(false);
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
                borderColor: city === c ? colors.gold : colors.borderSoft,
              }}
            >
              <Txt size={15} weight="bold" color={colors.ink}>
                {c}
              </Txt>
              {city === c ? <Ionicons name="checkmark-circle" size={20} color={colors.gold} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      {/* day sheet */}
      <Sheet visible={dayOpen} onClose={() => setDayOpen(false)} title="يوم الميلاد">
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: 31 }).map((_, i) => {
              const d = i + 1;
              const selected = birthDay === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    setBirthDay(d);
                    setDayOpen(false);
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.ink : colors.card,
                    borderWidth: 1,
                    borderColor: selected ? colors.ink : colors.borderSoft,
                  }}
                >
                  <Txt size={15} weight="extraBold" color={selected ? colors.white : colors.ink}>
                    {toArabicDigits(d)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Sheet>

      {/* month sheet */}
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
