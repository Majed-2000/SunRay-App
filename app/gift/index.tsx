import { Redirect } from 'expo-router';
import { STORE_HAS_GIFTCARDS } from '@/constants/features';
import { GiftListScreen } from '@/screens/gift/GiftListScreen';

// Gated at the route, so a deep link cannot open a feature that is not real yet.
export default function Route() {
  return STORE_HAS_GIFTCARDS ? <GiftListScreen /> : <Redirect href="/(tabs)/home" />;
}
