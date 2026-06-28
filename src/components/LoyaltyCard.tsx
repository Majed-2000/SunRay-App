import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { LOGO } from '@/assets';
import { Txt } from './Txt';

export interface LoyaltyCardProps {
  points: number;
  tierLabel: string;
  pointsToNext: number;
  goal: number;
  onPress?: () => void;
}

export function LoyaltyCard({ points, tierLabel, pointsToNext, goal, onPress }: LoyaltyCardProps) {
  const pct = Math.min(100, Math.round((points / goal) * 100));
  return (
    <LinearGradient
      colors={gradients.loyalty}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        shadows.gold,
        {
          borderRadius: radius['2xl'],
          padding: 20,
          overflow: 'hidden',
        },
      ]}
    >
      <Image
        source={LOGO}
        style={{
          position: 'absolute',
          left: -24,
          bottom: -26,
          width: 112,
          height: 112,
          opacity: 0.32,
        }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt size={11} weight="bold" latin color="#5a3f12" tracking={1}>
          SUN POINTS
        </Txt>
        <View
          style={{
            backgroundColor: 'rgba(42,28,8,0.55)',
            borderRadius: radius.pill,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Txt size={10} weight="extraBold" color={colors.white}>
            ⭐ عضو {tierLabel}
          </Txt>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <Txt size={40} weight="black" color="#2a1c08" style={{ lineHeight: 44 }}>
          {toArabicDigits(points)}
        </Txt>
        <Txt size={14} weight="bold" color="#5a3f12">
          نقطة مشرقة
        </Txt>
      </View>

      <View
        style={{
          marginTop: 14,
          height: 8,
          borderRadius: radius.sm,
          backgroundColor: 'rgba(42,28,8,0.22)',
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#2a1c08', '#5a3f12']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${pct}%`, height: '100%', borderRadius: radius.sm }}
        />
      </View>

      <Txt size={12} weight="bold" color="#3a2806" style={{ marginTop: 8 }}>
        {pointsToNext > 0
          ? `باقي ${toArabicDigits(pointsToNext)} نقطة لمشروبك المجاني`
          : 'مشروبك المجاني جاهز للاستبدال 🎉'}
        {onPress ? ' · اضغط للتفاصيل ←' : ''}
      </Txt>

      {/* full-card press target */}
      {onPress ? <PressOverlay onPress={onPress} /> : null}
    </LinearGradient>
  );
}

function PressOverlay({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [StyleSheet.absoluteFill, { opacity: pressed ? 0.06 : 0, backgroundColor: '#000' }]}
    />
  );
}
