import { Redirect } from 'expo-router';
import { STORE_HAS_DELIVERY } from '@/constants/features';
import { AddressNewScreen } from '@/screens/AddressNewScreen';

// Gated at the route, so a deep link cannot open a feature that is not real yet.
export default function Route() {
  return STORE_HAS_DELIVERY ? <AddressNewScreen /> : <Redirect href="/(tabs)/home" />;
}
