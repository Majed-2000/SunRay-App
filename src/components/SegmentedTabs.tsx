import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { Txt } from './Txt';

export interface SegmentedTab<T extends string> {
  key: T;
  label: string;
  /** Shown as a count beside the label. Omit for none; 0 renders as ٠. */
  count?: number;
}

export interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (key: T) => void;
}

/**
 * Switch between views of the same list.
 *
 * Counts sit inside the tab because "do I have anything running right now?" is
 * the question people open the orders screen with; answering it in the control
 * itself saves a row of chrome above the list.
 *
 * The whole tab is the touch target. The first version put `onPress` on the
 * text, so the space around a short label like "نشط" simply did not respond —
 * the control looked bigger than it was.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#e3d6bf',
        borderRadius: radius.md,
        padding: 4,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.sm + 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.card : 'transparent',
              // Feedback only on the inactive tab: pressing the one already
              // selected should feel like nothing, because nothing happens.
              opacity: !active && pressed ? 0.6 : 1,
            })}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.count === undefined ? t.label : `${t.label}، ${t.count}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={13} weight="extraBold" color={active ? colors.ink : colors.textMuted}>
                {t.label}
              </Txt>
              {t.count === undefined ? null : (
                <View
                  style={{
                    minWidth: 20,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: radius.pill,
                    backgroundColor: active ? colors.chip : 'transparent',
                  }}
                >
                  <Txt size={11} weight="extraBold" center color={active ? colors.ink : colors.textFaint}>
                    {toArabicDigits(t.count)}
                  </Txt>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
