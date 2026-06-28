import { View, type ViewStyle } from 'react-native';

export interface ResponsiveGridProps<T> {
  data: T[];
  columns: number;
  gap?: number;
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  style?: ViewStyle;
}

/**
 * Simple flex-wrap grid. Each cell takes an equal fraction so rows stay aligned;
 * the column count is driven by the caller (use useResponsive().gridColumns).
 */
export function ResponsiveGrid<T>({
  data,
  columns,
  gap = 14,
  keyExtractor,
  renderItem,
  style,
}: ResponsiveGridProps<T>) {
  const basisPct = `${100 / columns}%` as const;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]}>
      {data.map((item, index) => (
        <View
          key={keyExtractor(item, index)}
          style={{
            width: basisPct,
            paddingLeft: index % columns === 0 ? 0 : gap / 2,
            paddingRight: (index + 1) % columns === 0 ? 0 : gap / 2,
            marginBottom: gap,
          }}
        >
          {renderItem(item, index)}
        </View>
      ))}
    </View>
  );
}
