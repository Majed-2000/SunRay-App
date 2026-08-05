import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
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
import { warmUpBackend } from '@/services/api';

// Force RTL for the Arabic-first experience.
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

  // Restore a saved backend session (if any) once on app start. No-op in mock mode.
  // Also nudge a sleeping free-tier host awake so the first login isn't a cold start.
  useEffect(() => {
    warmUpBackend();
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
