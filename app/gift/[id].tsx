import { Redirect } from 'expo-router';
import { STORE_HAS_GIFTCARDS } from '@/constants/features';
import { GiftDetailScreen } from '@/screens/gift/GiftDetailScreen';

// Gated at the route, so a deep link cannot open a feature that is not real yet.
export default function Route() {
  return STORE_HAS_GIFTCARDS ? <GiftDetailScreen /> : <Redirect href="/(tabs)/home" />;
}
