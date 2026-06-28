import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '@/theme';
import { Txt } from './Txt';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  containerStyle?: ViewStyle;
  ltr?: boolean;
}

export function TextField({ label, containerStyle, ltr, style, ...rest }: TextFieldProps) {
  return (
    <View style={containerStyle}>
      {label ? (
        <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginBottom: spacing.sm }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[
          {
            backgroundColor: colors.card,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: colors.borderSoft,
            paddingHorizontal: spacing.lg,
            paddingVertical: 14,
            fontFamily: fonts.bold,
            fontSize: 16,
            color: colors.ink,
            textAlign: ltr ? 'left' : 'right',
            writingDirection: ltr ? 'ltr' : 'rtl',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
