import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { Txt } from './Txt';

export interface TrackStep {
  label: string;
  en: string;
}

export interface TrackStepsProps {
  steps: TrackStep[];
  currentIndex: number;
}

export function TrackSteps({ steps, currentIndex }: TrackStepsProps) {
  return (
    <View>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i <= currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <View key={step.en} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: active ? colors.gold : colors.borderDashed,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    height: 34,
                    backgroundColor: i < currentIndex ? colors.gold : colors.borderDashed,
                  }}
                />
              ) : null}
            </View>
            <View style={{ paddingTop: 1, paddingBottom: isLast ? 0 : 12 }}>
              <Txt size={15} weight="extraBold" color={active ? colors.ink : '#a99878'}>
                {step.label}
              </Txt>
              <Txt size={11} latin color={colors.textFaint}>
                {step.en}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}
