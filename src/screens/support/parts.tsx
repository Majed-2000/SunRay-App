import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { OptionChip, Txt } from '@/components';
import { toArabicDigits } from '@/utils/numerals';
import { MONTHS_AR_LIST } from '@/utils/date';
import { dayNameFor } from '@/services/requestRules';

/**
 * Small pieces shared by the catering and ticket screens.
 *
 * Dates and times are picked from chips rather than a native picker: the app
 * ships no date-picker module, and adding a native dependency for two fields
 * would mean a new store build for every platform. Chips also make the
 * bookable window (tomorrow to +30, minus closed dates) impossible to step out
 * of, where a free-form picker needs an error message for every wrong pick.
 */

/** Titled block in a form. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Txt size={14} weight="black" color={colors.ink} style={{ marginBottom: hint ? 2 : spacing.sm }}>
        {title}
      </Txt>
      {hint ? (
        <Txt size={12} color={colors.textMuted} style={{ marginBottom: spacing.sm, lineHeight: 19 }}>
          {hint}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

const parseYmd = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** «الخميس ١٢ أكتوبر» from `YYYY-MM-DD`. */
export function formatEventDate(s: string | undefined): string {
  const d = s ? parseYmd(s) : null;
  if (!d) return s ?? '';
  return `${dayNameFor(s as string)} ${toArabicDigits(d.getDate())} ${MONTHS_AR_LIST[d.getMonth()]}`;
}

/** «٤:٣٠ م» from `HH:MM`. */
export function formatTime12(hhmm: string | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) return hhmm ?? '';
  const h = Number(m[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${toArabicDigits(h12)}:${toArabicDigits(m[2])} ${h < 12 ? 'ص' : 'م'}`;
}

/** Horizontal strip of date chips. */
export function DateChips({ dates, value, onChange }: { dates: string[]; value: string; onChange: (d: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {dates.map((d) => {
        const date = parseYmd(d) as Date;
        const on = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={formatEventDate(d)}
            style={({ pressed }) => ({
              width: 64,
              paddingVertical: 10,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: on ? colors.ink : colors.border,
              backgroundColor: on ? colors.ink : colors.card,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Txt size={11} color={on ? colors.textOnDarkMuted : colors.textFaint}>
              {dayNameFor(d)}
            </Txt>
            <Txt size={18} weight="black" color={on ? colors.white : colors.ink}>
              {toArabicDigits(date.getDate())}
            </Txt>
            <Txt size={10} color={on ? colors.textOnDarkMuted : colors.textFaint}>
              {MONTHS_AR_LIST[date.getMonth()]}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const MINUTES = ['00', '15', '30', '45'] as const;

/**
 * Hour + minute chips producing `HH:MM` (24-hour), the format the site's
 * `<input type="time">` stores. Quarter hours only — the site's field steps by
 * five minutes, but nobody books a coffee corner for 4:35.
 */
export function TimeChips({
  value,
  onChange,
  hours,
}: {
  value: string;
  onChange: (hhmm: string) => void;
  /** Hours to offer, 0–23. */
  hours: number[];
}) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const pick = (hour: number, min: string) => onChange(`${String(hour).padStart(2, '0')}:${min}`);
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {hours.map((hour) => (
          <OptionChip
            key={hour}
            label={formatTime12(`${hour}:00`).replace(/:٠٠/, '')}
            selected={h !== '' && Number(h) === hour}
            onPress={() => pick(hour, m || '00')}
            style={{ minWidth: 64, paddingHorizontal: spacing.md }}
          />
        ))}
      </View>
      {h !== '' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
          {MINUTES.map((min) => (
            <OptionChip key={min} block label={`:${toArabicDigits(min)}`} selected={m === min} onPress={() => pick(Number(h), min)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Rounded status pill. */
export function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'info' | 'muted' }) {
  const bg = tone === 'ok' ? colors.successSoft : tone === 'warn' ? colors.chipGold : tone === 'muted' ? colors.chip : colors.chipCream;
  const fg = tone === 'ok' ? colors.success : tone === 'muted' ? colors.textMuted : colors.ink;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Txt size={12} weight="extraBold" color={fg}>
        {label}
      </Txt>
    </View>
  );
}
