import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Show the "إغلاق" pill in the header. */
  closeLabel?: string;
}

/** Lightweight bottom sheet built on RN Modal — no gesture lib dependency. */
export function Sheet({ visible, onClose, title, children, closeLabel = 'إغلاق' }: SheetProps) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    } else {
      anim.setValue(0);
    }
  }, [visible, anim]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.cardAlt,
          borderTopLeftRadius: radius['3xl'],
          borderTopRightRadius: radius['3xl'],
          paddingBottom: insets.bottom + spacing.lg,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) },
          ],
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: '#ddd3bc' }} />
        </View>
        {title ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing['2xl'],
              paddingVertical: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSoft,
            }}
          >
            <Txt size={18} weight="black" color={colors.ink}>
              {title}
            </Txt>
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: colors.chipGoldStrong,
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Txt size={13} weight="bold" color={colors.textFaint}>
                {closeLabel}
              </Txt>
            </Pressable>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}
