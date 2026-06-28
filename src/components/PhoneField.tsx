import { TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { CONFIG } from '@/constants/config';
import { formatMobileDisplay, normalizeMobile, isValidSaudiMobile } from '@/utils/validators';
import { Txt } from './Txt';

export interface PhoneFieldProps {
  value: string; // clean local digits only (e.g. 501234567)
  onChangeText: (digits: string) => void;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

// Left-to-Right Mark — forces the line's base direction to LTR so the
// space-separated digit groups ("50 946 8000") are NOT reordered by RTL bidi.
const LRM = String.fromCharCode(0x200e);

/**
 * Saudi phone input. The app stays Arabic/RTL, but this field is forced LTR:
 *  - the wrapper uses `direction: 'ltr'` + plain `flexDirection: 'row'` (NO
 *    row-reverse), so [flag +966] sits on the left and the digits on the right;
 *  - only clean digits are stored; the display is grouped for readability and
 *    prefixed with an LRM so RTL never reverses the groups;
 *  - the TextInput forces textAlign:'left' + writingDirection:'ltr' and uses a
 *    phone keyboard with tel autofill hints.
 */
export function PhoneField({ value, onChangeText, style, autoFocus }: PhoneFieldProps) {
  const valid = isValidSaudiMobile(value);
  const display = value ? LRM + formatMobileDisplay(value) : '';

  return (
    <View
      style={[
        {
          direction: 'ltr', // pin LTR layout regardless of the app's RTL
          flexDirection: 'row',
          alignItems: 'stretch',
          backgroundColor: colors.card,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: valid ? colors.gold : colors.borderSoft,
        },
        style,
      ]}
    >
      {/* country code (left) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 14,
          backgroundColor: colors.chipGold,
        }}
      >
        <Txt size={18}>🇸🇦</Txt>
        <Txt size={15} weight="extraBold" color={colors.ink}>
          {CONFIG.COUNTRY_DIAL_CODE}
        </Txt>
      </View>

      {/* editable digits (right) — forced LTR */}
      <TextInput
        value={display}
        onChangeText={(t) => onChangeText(normalizeMobile(t))}
        placeholder="5X XXX XXXX"
        placeholderTextColor={colors.textGoldSoft}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus={autoFocus}
        maxLength={14}
        style={{
          flex: 1,
          paddingHorizontal: 14,
          paddingVertical: 16,
          fontFamily: fonts.bold,
          fontSize: 16,
          color: colors.ink,
          textAlign: 'left',
          writingDirection: 'ltr',
        }}
      />
    </View>
  );
}
