import { useEffect, useState } from 'react';
import { FlatList, Image, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { subscribePhotos, type SitePhoto } from '@/services/storeSite';
import { Txt } from './Txt';

export interface PhotoStripProps {
  /** Section title. Pass null to hide it. */
  title?: string | null;
  /** Tile size in points. */
  size?: number;
}

/**
 * «لقطاتكم» — the customer photos the dashboard curates for the homepage.
 *
 * Read live from `sunray/siteConfig/photos` (public, at most ten). The strip
 * renders nothing at all until there is at least one photo: the website fills
 * an empty strip with brand-symbol placeholders, but on a phone's Home an empty
 * gallery is just a gap under a heading.
 *
 * A horizontal FlatList rather than a ScrollView so off-screen photos are not
 * decoded until they scroll into view — each is a full-size upload from Storage.
 */
export function PhotoStrip({ title = 'لقطاتكم', size = 132 }: PhotoStripProps) {
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  useEffect(() => subscribePhotos(setPhotos), []);

  if (!photos.length) return null;

  return (
    <View style={{ gap: spacing.md }}>
      {title ? (
        <Txt size={17} weight="black" color={colors.ink} style={{ paddingHorizontal: spacing.screenX }}>
          {title}
        </Txt>
      ) : null}
      <FlatList
        horizontal
        data={photos}
        keyExtractor={(p, i) => `${p.url}-${i}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.screenX, gap: 10 }}
        initialNumToRender={3}
        windowSize={3}
        renderItem={({ item }) => <PhotoTile photo={item} size={size} />}
      />
    </View>
  );
}

function PhotoTile({ photo, size }: { photo: SitePhoto; size: number }) {
  const [broken, setBroken] = useState(false);
  // A photo deleted from Storage while its link is still in the config: drop
  // the tile instead of showing a grey square.
  if (broken) return null;
  return (
    <View
      style={{
        width: size,
        height: size * 1.25,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.shimmerFrom,
      }}
    >
      <Image
        source={{ uri: photo.url }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        accessibilityLabel={photo.caption || 'لقطة عميل'}
        onError={() => setBroken(true)}
      />
      {photo.caption ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 8,
            paddingVertical: 5,
            backgroundColor: colors.overlay,
          }}
        >
          <Txt size={11} weight="bold" color={colors.white} numberOfLines={2}>
            {photo.caption}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
