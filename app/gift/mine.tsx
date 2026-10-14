import { Redirect } from 'expo-router';
import { STORE_HAS_GIFTCARDS } from '@/constants/features';
import { MyGiftsScreen } from '@/screens/gift/MyGiftsScreen';

// Gated at the route, so a deep link cannot open a feature that is switched off.
export default function Route() {
  return STORE_HAS_GIFTCARDS ? <MyGiftsScreen /> : <Redirect href="/(tabs)/home" />;
}
