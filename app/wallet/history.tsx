import { Redirect } from 'expo-router';
import { STORE_HAS_WALLET } from '@/constants/features';
import { WalletHistoryScreen } from '@/screens/wallet/WalletHistoryScreen';

// Gated at the route, so a deep link cannot open a feature that is not real yet.
export default function Route() {
  return STORE_HAS_WALLET ? <WalletHistoryScreen /> : <Redirect href="/(tabs)/home" />;
}
