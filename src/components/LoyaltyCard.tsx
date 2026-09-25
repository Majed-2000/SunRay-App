import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { LOGO } from '@/assets';
import { Txt } from './Txt';

export interface LoyaltyCardProps {
  /**
   * The balance, or **null when it is not known** — still loading, the load
   * failed, or the ledger has no record of this phone. Null draws a dash, not
   * a zero: "٠ نقطة" is a statement about the customer, and a wrong one.
   */
  points: number | null;
  /** Replaces the footer line — used to say why the balance is unknown. */
  note?: string;
  /** Tier name, or null when tiers are switched off in the programme. */
  tierLabel: string | null;
  /**
   * Points remaining, and the goal they count toward. **Both null is normal.**
   *
   * The server withholds the reward threshold until an admin confirms it, and
   * refuses to guess — because "you have earned a reward" measured against an
   * estimate is a promise the customer reads as a commitment. When the goal is
   * unknown this card shows the balance and says nothing about a goal, rather
   * than drawing a progress bar against an invented number.
   */
  pointsToNext: number | null;
  goal: number | null;
  onPress?: () => void;
}

export function LoyaltyCard({ points, note, tierLabel, pointsToNext, goal, onPress }: LoyaltyCardProps) {
  const hasGoal = points != null && goal != null && goal > 0 && pointsToNext != null;
  const pct = hasGoal && points != null ? Math.min(100, Math.round((points / goal) * 100)) : 0;
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
            {tierLabel ? `⭐ عضو ${tierLabel}` : '⭐ عضو'}
          </Txt>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <Txt size={40} weight="black" color="#2a1c08" style={{ lineHeight: 44 }}>
          {points == null ? '—' : toArabicDigits(points)}
        </Txt>
        <Txt size={14} weight="bold" color="#5a3f12">
          نقطة مشرقة
        </Txt>
      </View>

      {/* No goal → no bar. An empty or full track against an unknown target
          says something the programme has not decided yet. */}
      {hasGoal ? (
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
            colors={[colors.ink, colors.inkDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${pct}%`, height: '100%', borderRadius: radius.sm }}
          />
        </View>
      ) : null}

      <Txt size={12} weight="bold" color="#3a2806" style={{ marginTop: hasGoal ? 8 : 12 }}>
        {note
          ? note
          : hasGoal
          ? pointsToNext > 0
            ? `باقي ${toArabicDigits(pointsToNext)} نقطة لمكافأتك`
            : 'مكافأتك جاهزة 🎉'
          : 'نقاطك تتراكم مع كل طلب'}
        {/* A note carries its own call to action (retry, sign in). */}
        {onPress && !note ? ' · اضغط للتفاصيل ←' : ''}
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
      style={({ pressed }) => [StyleSheet.absoluteFill, { opacity: pressed ? 0.06 : 0, backgroundColor: colors.ink }]}
    />
  );
}
