import { Redirect } from 'expo-router';
import { STORE_HAS_GIFTCARDS } from '@/constants/features';
import { GiftScreen } from '@/screens/gift/GiftScreen';

// Gated at the route, so a deep link cannot open a feature that is switched off.
export default function Route() {
  return STORE_HAS_GIFTCARDS ? <GiftScreen /> : <Redirect href="/(tabs)/home" />;
}
