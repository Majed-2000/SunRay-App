import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme';
import { strings } from '@/i18n';
import { useBranchStore, useCatalogStore } from '@/store';

type IoniconName = keyof typeof Ionicons.glyphMap;

function icon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const t = strings().tabs;

  // Load the menu + branches once when entering the app. In mock mode this is an
  // instant no-op (data already present); in backend mode it fetches from the API.
  useEffect(() => {
    useCatalogStore.getState().load();
    useBranchStore.getState().load();
  }, []);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: '#b8a888',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bold,
          fontSize: 10,
          marginTop: Platform.OS === 'ios' ? 2 : 0,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t.home, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="menu" options={{ title: t.menu, tabBarIcon: icon('cafe') }} />
      <Tabs.Screen name="orders" options={{ title: t.orders, tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="loyalty" options={{ title: t.loyalty, tabBarIcon: icon('star') }} />
      <Tabs.Screen name="account" options={{ title: t.account, tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
