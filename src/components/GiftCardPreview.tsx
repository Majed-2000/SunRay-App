import { memo, useEffect, useMemo, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { GiftDesign } from '@/types';
import { colors, radius } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { BG_DEFAULT, GIFT_SITE, RM_DEFAULT, sanitizeHex } from '@/services/storeGifts';
import { Txt } from './Txt';
import { Icon } from './icons/Icon';

/** The site's art is a 1080 x 1920 portrait. */
export const GIFT_FACE_RATIO = 1080 / 1920;

export interface GiftCardPreviewProps {
  design: GiftDesign;
  /** «على كيفك» only: pattern and background colours. */
  rmColor?: string | null;
  bgColor?: string | null;
  /** Price chip, in riyals. Omit on a card that has already been bought. */
  amount?: number;
  /** Bottom strip — start label and end value. */
  footerStart?: string;
  footerEnd?: string;
  size?: 'sm' | 'lg';
  style?: ViewStyle;
}

/**
 * The face of a gift card, drawn from the website's own SVG.
 *
 * The recipient opens the gift on sunray.sa, which draws
 * `store/assets/gift/bg_<design>.svg`. Shipping a second set of faces in the
 * app would mean the sender designs one card and the recipient receives a
 * different one, so the app loads the same files. «على كيفك» is recoloured
 * exactly as `gift.js` does it: the file is drawn in two colours, and those
 * two strings are swapped for the sender's choice.
 *
 * The files are fetched once per session and kept in memory — 35 to 115 KB
 * each, which is not worth bundling into an APK for a screen most people
 * never open. Until one arrives (or if the site is unreachable) the card
 * shows the brand sun on cream, never an empty box.
 */
export const GiftCardPreview = memo(function GiftCardPreview({
  design,
  rmColor,
  bgColor,
  amount,
  footerStart,
  footerEnd,
  size = 'lg',
  style,
}: GiftCardPreviewProps) {
  const big = size === 'lg';
  const raw = useFaceXml(design.id);

  const xml = useMemo(() => {
    if (!raw) return null;
    if (design.id !== 'custom') return raw;
    const rm = sanitizeHex(rmColor, RM_DEFAULT);
    const bg = sanitizeHex(bgColor, BG_DEFAULT);
    return raw.split(RM_DEFAULT).join(rm).split(BG_DEFAULT).join(bg);
  }, [raw, design.id, rmColor, bgColor]);

  const showStrip = amount != null || !!footerStart || !!footerEnd;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`بطاقة إهداء — ${design.nameAr}`}
      style={[
        {
          aspectRatio: GIFT_FACE_RATIO,
          borderRadius: big ? radius['2xl'] : radius.xl,
          overflow: 'hidden',
          backgroundColor: colors.bgWarm,
          borderWidth: 1,
          borderColor: colors.borderSoft,
        },
        style,
      ]}
    >
      {xml ? (
        <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sun" size={big ? 72 : 44} />
        </View>
      )}

      {showStrip ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(67,67,68,0.78)',
            paddingHorizontal: big ? 16 : 10,
            paddingVertical: big ? 10 : 7,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Txt size={big ? 13 : 11} weight="bold" color={colors.white} numberOfLines={1} style={{ flexShrink: 1 }}>
            {footerStart ?? (amount != null ? `${toArabicDigits(amount)} ﷼` : '')}
          </Txt>
          {footerEnd ? (
            <Txt size={big ? 13 : 11} weight="extraBold" color={colors.gold} numberOfLines={1}>
              {footerEnd}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

// ── Face loading ────────────────────────────────────────────────────────────

const faces = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function faceUrl(id: GiftDesign['id']): string {
  // `custom` is the site's `bg_XX.svg`, the one drawn in the two swap colours.
  return `${GIFT_SITE}/store/assets/gift/bg_${id === 'custom' ? 'XX' : id}.svg`;
}

function loadFace(id: GiftDesign['id']): Promise<string | null> {
  const known = faces.get(id);
  if (known) return Promise.resolve(known);
  let p = inflight.get(id);
  if (!p) {
    p = fetch(faceUrl(id))
      .then((r) => (r.ok ? r.text() : null))
      // The XML prolog is noise to the renderer; dropping it is one less thing
      // for its parser to disagree with.
      .then((t) => (t && t.includes('<svg') ? t.replace(/<\?xml[^>]*\?>/, '').trim() : null))
      .then((t) => {
        if (t) faces.set(id, t);
        return t;
      })
      .catch(() => null)
      // A failure is not cached: the next card to mount tries again.
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

function useFaceXml(id: GiftDesign['id']): string | null {
  const [xml, setXml] = useState<string | null>(() => faces.get(id) ?? null);
  useEffect(() => {
    let alive = true;
    setXml(faces.get(id) ?? null);
    void loadFace(id).then((t) => {
      if (alive && t) setXml(t);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return xml;
}
