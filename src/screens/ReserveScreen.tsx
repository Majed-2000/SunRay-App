import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Button, Card, Divider, Header, OptionChip, QtyStepper, ScreenContainer, Txt } from '@/components';
import { useBranchStore } from '@/store';
import { toArabicDigits } from '@/utils/numerals';

const DATES = ['اليوم', 'غدًا', 'الأحد ٢٢', 'الإثنين ٢٣'];
const TIMES = ['٥:٠٠ م', '٦:٠٠ م', '٧:٠٠ م', '٨:٠٠ م', '٩:٠٠ م'];
const AREAS = ['داخلي', 'خارجي', 'جلسة أرضية'];

export function ReserveScreen() {
  const branch = useBranchStore((s) => s.current());
  const [date, setDate] = useState(DATES[0]);
  const [time, setTime] = useState(TIMES[2]);
  const [area, setArea] = useState(AREAS[0]);
  const [party, setParty] = useState(2);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <ScreenContainer header={<Header showBack title="حجز جلسة" onBack={() => router.replace('/(tabs)/home')} />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing['4xl'] }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={44}>🪑</Txt>
          </View>
          <Txt size={25} weight="black" color={colors.ink} style={{ marginTop: spacing.xl }}>
            تم تأكيد حجزك ☀
          </Txt>
          <Card radiusKey="xl" style={{ width: '100%', marginTop: spacing.xl }}>
            <Txt size={13} color={colors.textFaint}>
              تفاصيل الجلسة
            </Txt>
            <Txt size={17} weight="black" color={colors.ink} style={{ marginTop: 8, lineHeight: 28 }}>
              {date} · {time} · {toArabicDigits(party)} أشخاص · {area}
            </Txt>
            <Divider dashed />
            <Txt size={13} color={colors.textMuted}>
              نراك في فرع سن راي · {branch.nameAr}
            </Txt>
          </Card>
          <Button label="تم" style={{ marginTop: spacing.xl }} onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      header={<Header showBack title="احجز جلسة" subtitle="اختر وقتك المفضل ونجهّز لك المكان" />}
      footer={<Button label="تأكيد الحجز" variant="gold" onPress={() => setDone(true)} />}
    >
      <View style={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg }}>
          <Ionicons name="storefront-outline" size={18} color={colors.terracotta} />
          <Txt size={14} weight="extraBold" color={colors.ink}>
            {branch.nameAr}
          </Txt>
        </View>

        <Label>اليوم</Label>
        <Row>
          {DATES.map((d) => (
            <OptionChip key={d} label={d} selected={date === d} onPress={() => setDate(d)} radiusKey="md" />
          ))}
        </Row>

        <Label>الوقت</Label>
        <Row>
          {TIMES.map((tt) => (
            <OptionChip key={tt} label={tt} selected={time === tt} onPress={() => setTime(tt)} radiusKey="md" />
          ))}
        </Row>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl }}>
          <Txt size={14} weight="extraBold" color={colors.ink}>
            عدد الأشخاص
          </Txt>
          <QtyStepper value={party} onInc={() => setParty((p) => p + 1)} onDec={() => setParty((p) => Math.max(1, p - 1))} />
        </View>

        <Label>المكان</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AREAS.map((a) => (
            <OptionChip key={a} label={a} selected={area === a} onPress={() => setArea(a)} variant="gold" radiusKey="md" />
          ))}
        </View>
      </View>
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
function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}
