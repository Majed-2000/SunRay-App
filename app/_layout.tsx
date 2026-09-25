import { useEffect } from 'react';
import { I18nManager, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
// Imported per weight, not from the package root.
//
// The root index `require()`s every file the family ships, and Metro bundles
// whatever is required — so importing four named weights from
// '@expo-google-fonts/poppins' still put all eighteen faces, italics included,
// into the app (~3 MB of TTF for four fonts actually used). Subpath imports
// pull exactly one file each.
import { useFonts } from 'expo-font';
import { BalooBhaijaan2_400Regular } from '@expo-google-fonts/baloo-bhaijaan-2/400Regular';
import { BalooBhaijaan2_500Medium } from '@expo-google-fonts/baloo-bhaijaan-2/500Medium';
import { BalooBhaijaan2_600SemiBold } from '@expo-google-fonts/baloo-bhaijaan-2/600SemiBold';
import { BalooBhaijaan2_700Bold } from '@expo-google-fonts/baloo-bhaijaan-2/700Bold';
import { BalooBhaijaan2_800ExtraBold } from '@expo-google-fonts/baloo-bhaijaan-2/800ExtraBold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { colors } from '@/theme';
import { Toast } from '@/components';
import { useAuthStore } from '@/store';

// RTL is forced natively by the `expo-localization` plugin (`forcesRTL` in
// app.json), which writes React Native's RTL preference before JS loads — so
// the very first launch after install is already right-to-left. Before that,
// only this block existed: it takes effect on the NEXT launch, so every new
// customer saw the app mirrored the wrong way once. Kept as a fallback for
// Expo Go, where config plugins do not run.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Arabic + Latin come from Google Fonts as static per-weight files. The
    // variable builds of these families load without error but render every
    // weight at 400 — see src/theme/typography.ts.
    BalooBhaijaan2_400Regular,
    BalooBhaijaan2_500Medium,
    BalooBhaijaan2_600SemiBold,
    BalooBhaijaan2_700Bold,
    BalooBhaijaan2_800ExtraBold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    // The wordmark face. Licensed, not on Google Fonts, so it ships in-repo.
    // The key here IS the family name referenced by fonts.wordmark.
    'BiomeW01-Black': require('../assets/fonts/BiomeW01-Black.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Restore a persisted Firebase sign-in once on app start.
  useEffect(() => {
    useAuthStore.getState().restoreSession();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_left', // RTL-friendly push direction
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="cart" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="order-success" options={{ gestureEnabled: false }} />
        </Stack>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Last line of defence for a render error anywhere in the app.
 *
 * Without it one bad render left a blank white screen with no way back short of
 * killing the app. Plain `Text`, not `Txt`: this can render before the fonts
 * have loaded, or because something in the theme itself is what threw.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 44 }}>☕</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 12, textAlign: 'center' }}>
        حدث خطأ غير متوقع
      </Text>
      <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
        نعتذر عن ذلك. سلّتك محفوظة، جرّب مرة أخرى.
      </Text>
      <Pressable
        onPress={() => retry()}
        accessibilityRole="button"
        style={{ marginTop: 24, backgroundColor: colors.ink, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 100 }}
      >
        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '700' }}>إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}
