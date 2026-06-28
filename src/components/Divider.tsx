import { View } from 'react-native';
import { colors, spacing } from '@/theme';

export function Divider({ dashed, marginV = spacing.md }: { dashed?: boolean; marginV?: number }) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderBottomColor: dashed ? colors.borderDashed : colors.borderSoft,
        marginVertical: marginV,
      }}
    />
  );
}
