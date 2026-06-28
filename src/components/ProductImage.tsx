import { Image, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
import { Txt } from './Txt';

export interface ProductImageProps {
  emoji: string;
  image?: string | null;
  height?: number;
  emojiSize?: number;
  radiusKey?: keyof typeof radius;
  showTag?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode; // overlay badges
}

/**
 * Placeholder product visual — diagonal cream stripes + emoji until real
 * photography is provided. Renders the image when available.
 */
export function ProductImage({
  emoji,
  image,
  height = 120,
  emojiSize = 46,
  radiusKey = 'lg',
  showTag = true,
  style,
  children,
}: ProductImageProps) {
  return (
    <View
      style={[
        {
          height,
          width: '100%',
          borderRadius: radius[radiusKey],
          overflow: 'hidden',
          backgroundColor: colors.shimmerFrom,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* simple striped texture using layered bands */}
      <View style={stripes} pointerEvents="none" />
      {image ? (
        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Txt size={emojiSize}>{emoji}</Txt>
      )}
      {showTag && !image ? (
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(255,255,255,0.7)',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
          }}
        >
          <Txt size={8} latin color={colors.textFaint}>
            photo
          </Txt>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const stripes: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: colors.shimmerTo,
  opacity: 0.5,
};
