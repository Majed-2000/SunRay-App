import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme';
import { strings } from '@/i18n';
import { isActiveOrder, useBranchStore, useCatalogStore, useOrderStore, useStoreSettingsStore } from '@/store';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Outline when inactive, solid when active.
 *
 * The set used to be four solid icons and one outline (`receipt-outline`), so
 * the orders tab read as permanently dimmed next to its neighbours. Only the
 * tint changed on selection, which is a weak signal against a warm cream bar
 * where the two tints are not far apart. Weight carries the state now, and the
 * odd icon out disappears as a side effect.
 */
function icon(name: IoniconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons
      name={(focused ? name : (`${name}-outline` as IoniconName))}
      size={size}
      color={color as string}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const t = strings().tabs;
  const activeOrders = useOrderStore((s) => s.orders.filter(isActiveOrder).length);

  // Load the menu + branches once when entering the app. In mock mode this is an
  // instant no-op (data already present); in backend mode it fetches from the API.
  useEffect(() => {
    useCatalogStore.getState().load();
    useBranchStore.getState().load();
    // Live settings: open/closed, gift packages, closed sections. Subscribed
    // rather than fetched — a customer who builds a cart before Maghrib and
    // checks out after would otherwise be refused with nothing on screen to
    // explain it.
    const stopSettings = useStoreSettingsStore.getState().start();
    return stopSettings;
  }, []);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
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

      <Tabs.Screen
        name="orders"
        options={{
          title: t.orders,
          tabBarIcon: icon('receipt'),
          // A live order is the one thing worth pulling someone back into the
          // app for, and until now nothing in the chrome said so — you had to
          // open the tab to find out whether anything was still running.
          tabBarBadge: activeOrders > 0 ? activeOrders : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.goldDeep,
            color: colors.white,
            fontFamily: fonts.bold,
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen name="loyalty" options={{ title: t.loyalty, tabBarIcon: icon('star') }} />
      <Tabs.Screen name="account" options={{ title: t.account, tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
