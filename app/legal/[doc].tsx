import { useLocalSearchParams } from 'expo-router';
import { LegalScreen } from '@/screens/LegalScreen';

export default function LegalRoute() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  return <LegalScreen doc={String(doc ?? '')} />;
}
