import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Header, QtyStepper, ScreenContainer, Txt } from '@/components';
import { useBranchStore } from '@/store';
import { toArabicDigits } from '@/utils/numerals';

export function WaitlistScreen() {
  const branch = useBranchStore((s) => s.current());
  const [party, setParty] = useState(2);
  const [joined, setJoined] = useState(false);

  const aheadCount = 4;
  const estWait = 20;
  const position = 5;

  return (
    <ScreenContainer header={<Header showBack title="قائمة الانتظار" subtitle={`${branch.nameAr} ممتلئ الآن — سجّل وننبّهك عند توفّر طاولة`} />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        {joined ? (
          <>
            <View style={{ backgroundColor: colors.ink, borderRadius: radius['2xl'], padding: spacing['3xl'], alignItems: 'center' }}>
              <Txt size={13} color={colors.textGoldSoft}>
                ترتيبك في القائمة
              </Txt>
              <Txt size={72} weight="black" color={colors.gold} style={{ lineHeight: 76 }}>
                {toArabicDigits(position)}
              </Txt>
              <Txt size={13} color={colors.textOnDarkMuted} style={{ marginTop: 4 }}>
                الانتظار التقريبي {toArabicDigits(estWait)} دقيقة
              </Txt>
            </View>
            <Card radiusKey="lg" style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Txt size={14} weight="extraBold" color={colors.ink}>
                  مجموعتك
                </Txt>
                <Txt size={12} color={colors.textFaint}>
                  {toArabicDigits(party)} أشخاص
                </Txt>
              </View>
              <Txt size={24}>👥</Txt>
            </Card>
            <Button label="إلغاء التسجيل" variant="danger" style={{ marginTop: spacing.lg }} onPress={() => setJoined(false)} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.lg }}>
              <StatCard value={toArabicDigits(aheadCount)} label="مجموعات أمامك" />
              <StatCard value={toArabicDigits(estWait)} label="دقيقة تقريبًا" accent />
            </View>
            <Card radiusKey="lg" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
              <Txt size={14} weight="extraBold" color={colors.ink}>
                عدد الأشخاص
              </Txt>
              <QtyStepper value={party} onInc={() => setParty((p) => p + 1)} onDec={() => setParty((p) => Math.max(1, p - 1))} />
            </Card>
            <Button label="سجّلني في القائمة" onPress={() => setJoined(true)} />
            <Button label="العودة" variant="outline" style={{ marginTop: 10 }} onPress={() => router.back()} />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card radiusKey="lg" style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xl }}>
      <Txt size={30} weight="black" color={accent ? colors.terracotta : colors.ink}>
        {value}
      </Txt>
      <Txt size={12} color={colors.textFaint} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </Card>
  );
}
