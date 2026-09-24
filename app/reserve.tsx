import { Redirect } from 'expo-router';
import { STORE_HAS_RESERVATION } from '@/constants/features';
import { ReserveScreen } from '@/screens/ReserveScreen';

// Gated at the route too, so a deep link cannot reach a booking that nothing records.
export default function ReserveRoute() {
  return STORE_HAS_RESERVATION ? <ReserveScreen /> : <Redirect href="/(tabs)/home" />;
}
