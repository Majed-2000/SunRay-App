import { Redirect } from 'expo-router';
import { STORE_HAS_WAITLIST } from '@/constants/features';
import { WaitlistScreen } from '@/screens/WaitlistScreen';

// Gated at the route too, so a deep link cannot reach a queue that does not exist.
export default function WaitlistRoute() {
  return STORE_HAS_WAITLIST ? <WaitlistScreen /> : <Redirect href="/(tabs)/home" />;
}
