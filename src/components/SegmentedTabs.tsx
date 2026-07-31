import { View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { Txt } from './Txt';

export interface SegmentedTab<T extends string> {
  key: T;
  label: string;
  /** Shown as a count beside the label. Omit to show none; 0 renders as ٠. */
  count?: number;
}

export interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (key: T) => void;
}

/**
 * Two-or-three-way switch between views of the same list.
 *
 * Counts sit inside the tab rather than in a separate summary line: the number
 * is what people actually scan for ("do I have anything running right now?"),
 * and putting it here answers that without adding a row of chrome above the
 * list. The inactive count is dimmed so the active tab still reads first.
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
          <View
            key={t.key}
            style={{
              flex: 1,
              backgroundColor: active ? colors.card : 'transparent',
              borderRadius: radius.sm + 1,
            }}
          >
            <Txt
              size={13}
              weight="extraBold"
              center
              color={active ? colors.ink : colors.textMuted}
              onPress={() => onChange(t.key)}
              style={{ paddingVertical: 10 }}
            >
              {t.label}
              {t.count === undefined ? '' : `  ${toArabicDigits(t.count)}`}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}
