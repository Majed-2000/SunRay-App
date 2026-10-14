import { useMemo } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import {
  MAX_LETTERS,
  MAX_NUMBERS,
  PLATE_LETTERS_AR,
  normalizeArabicPlate,
  normalizePlateNumbers,
  transliterate,
  validatePlate,
} from '@/vendor/plate_core';

export interface PlateValue {
  lettersAr: string;
  numbers: string;
}

export interface PlateFieldProps {
  value: PlateValue;
  onChange: (v: PlateValue) => void;
}

/**
 * Saudi plate entry for curbside.
 *
 * The seventeen letters are shown as a keypad rather than left to the keyboard.
 * A Saudi plate uses a fixed subset of the alphabet, so a free Arabic keyboard
 * mostly offers characters that will be rejected — and the customer discovers
 * that only after tapping pay, sitting in a car park.
 *
 * The mapping, the allowed letters and the validation all come from
 * `@/vendor/plate_core`, a verbatim copy of the store's generated artefact.
 * Retyping seventeen letters here would be exactly the drift its source file
 * warns against: the app and the server would disagree about which car the
 * barista is looking for.
 *
 * The Latin transliteration is shown live because it is what is printed on the
 * slip at the counter, and it is deliberately non-phonetic — ع is E, م is Z,
 * ص is X. A customer who sees "E" where they expected "A" should see it here,
 * next to their own letters, rather than be surprised by the printed slip.
 */
export function PlateField({ value, onChange }: PlateFieldProps) {
  const latin = useMemo(() => transliterate(value.lettersAr), [value.lettersAr]);
  const check = useMemo(
    () => validatePlate(value.lettersAr, value.numbers),
    [value.lettersAr, value.numbers],
  );
  const started = value.lettersAr.length > 0 || value.numbers.length > 0;

  const toggleLetter = (letter: string) => {
    const current = value.lettersAr;
    // Tapping a letter already at the end removes it — the keypad has no
    // separate backspace, and reaching for one mid-entry is fiddly in a car.
    if (current.endsWith(letter)) {
      onChange({ ...value, lettersAr: current.slice(0, -1) });
      return;
    }
    if (current.length >= MAX_LETTERS) return;
    onChange({ ...value, lettersAr: normalizeArabicPlate(current + letter) });
  };

  return (
    <View style={{ gap: spacing.md }}>
      {/* numbers */}
      <View>
        <Txt size={12} color={colors.textMuted} style={{ marginBottom: 6 }}>
          أرقام اللوحة
        </Txt>
        <TextInput
          value={value.numbers}
          onChangeText={(t) =>
            // Normalise on the way in: phone keypads hand us Arabic-Indic
            // digits, which would otherwise reach the server as non-digits.
            onChange({ ...value, numbers: normalizePlateNumbers(t).slice(0, MAX_NUMBERS) })
          }
          keyboardType="number-pad"
          maxLength={MAX_NUMBERS}
          placeholder="١٢٣٤"
          placeholderTextColor={colors.textFaint}
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 20,
            letterSpacing: 4,
            textAlign: 'center',
            color: colors.ink,
          }}
        />
      </View>

      {/* letters */}
      <View>
        <Txt size={12} color={colors.textMuted} style={{ marginBottom: 6 }}>
          حروف اللوحة {value.lettersAr ? `· ${latin}` : ''}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PLATE_LETTERS_AR.map((letter) => {
            const picked = value.lettersAr.includes(letter);
            return (
              <Pressable
                key={letter}
                onPress={() => toggleLetter(letter)}
                accessibilityRole="button"
                accessibilityLabel={`الحرف ${letter}`}
                accessibilityState={{ selected: picked }}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: picked ? colors.gold : colors.card,
                  borderWidth: 1,
                  borderColor: picked ? colors.gold : colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Txt size={18} weight="black" color={picked ? colors.inkDeep : colors.ink}>
                  {letter}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Only complain once the customer has actually started. An error under
          an empty field reads as the form being broken before it is used. */}
      {started && !check.ok ? (
        <Txt size={12} color={colors.danger}>
          {check.message ?? 'تحقّق من رقم اللوحة'}
        </Txt>
      ) : null}
    </View>
  );
}
