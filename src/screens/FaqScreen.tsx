import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { Card, Header, ScreenContainer, Txt } from '@/components';
import { faqItems } from '@/data';

export function FaqScreen() {
  const [open, setOpen] = useState<string | null>(faqItems[0]?.id ?? null);

  return (
    <ScreenContainer header={<Header showBack title="الأسئلة الشائعة" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'], gap: 10 }}>
        {faqItems.map((item) => {
          const expanded = open === item.id;
          return (
            <Card key={item.id} radiusKey="lg" padding={0} style={{ overflow: 'hidden' }}>
              <Pressable
                onPress={() => setOpen(expanded ? null : item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg }}
              >
                <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
                  {item.questionAr}
                </Txt>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.terracotta} />
              </Pressable>
              {expanded ? (
                <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
                  <Txt size={13} color={colors.textMuted} style={{ lineHeight: 22 }}>
                    {item.answerAr}
                  </Txt>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </ScreenContainer>
  );
}
