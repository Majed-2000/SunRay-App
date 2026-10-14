import { Image, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
import { Icon, type IconName } from './icons/Icon';

export interface ProductImageProps {
  icon: IconName;
  image?: string | null;
  height?: number;
  iconSize?: number;
  radiusKey?: keyof typeof radius;
  style?: ViewStyle;
  children?: React.ReactNode; // overlay badges
}

/**
 * Product visual: the photo when the store has one, otherwise cream stripes
 * with the product's brand icon.
 */
export function ProductImage({
  icon,
  image,
  height = 120,
  iconSize = 46,
  radiusKey = 'lg',
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
        <Icon name={icon} size={iconSize} />
      )}
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
