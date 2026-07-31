import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface ScreenContainerProps {
  children: ReactNode;
  /** Wrap content in a vertical ScrollView. */
  scroll?: boolean;
  /** Apply standard horizontal screen padding. */
  padded?: boolean;
  /** Sticky element above the scroll area (e.g. a Header). */
  header?: ReactNode;
  /** Sticky element pinned to the bottom (e.g. a checkout bar). */
  footer?: ReactNode;
  backgroundColor?: string;
  /** Respect the top safe-area inset (default true). */
  topInset?: boolean;
  contentStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
}

/**
 * Standard screen frame: safe areas, warm background, optional scroll, and
 * a centered max-width column on tablets to keep layouts readable.
 */
export function ScreenContainer({
  children,
  scroll = true,
  padded = true,
  header,
  footer,
  backgroundColor = colors.bg,
  topInset = true,
  contentStyle,
  scrollProps,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, isTablet } = useResponsive();

  const px = padded ? spacing.screenX : 0;
  const column: ViewStyle = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: px,
  };

  const body = (
    <View style={[column, !scroll && { flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    // Keyboard handling: from Android 15 the system no longer resizes the window
    // for `adjustResize` when the app draws edge-to-edge, so the keyboard can sit
    // on top of a focused input. KeyboardAvoidingView shrinks the content instead.
    // iOS never resized on its own and has always needed `padding`.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={{
          flex: 1,
          backgroundColor,
          paddingTop: topInset ? insets.top : 0,
        }}
      >
        {header ? <View style={[column, { paddingHorizontal: px }]}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Follow the focused field as the keyboard opens instead of leaving it
            // hidden behind it.
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={{
              paddingBottom: footer ? 0 : insets.bottom + spacing.lg,
              paddingTop: isTablet ? spacing.sm : 0,
            }}
            {...scrollProps}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? (
          <View
            style={{
              paddingBottom: insets.bottom + spacing.sm,
              backgroundColor,
            }}
          >
            <View style={column}>{footer}</View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
