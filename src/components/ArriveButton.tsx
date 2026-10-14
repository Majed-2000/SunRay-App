import { useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing } from '@/theme';
import { Button } from './Button';
import { Txt } from './Txt';
import { Icon } from './icons/Icon';
import { markCarArrived, describeArrivalError } from '@/services/storeCurbside';
import { toast, useOrderStore } from '@/store';

export interface ArriveButtonProps {
  /** Preferred identifier — the random tracking token. */
  token?: string | null;
  code?: string | null;
  orderId?: string | null;
  /** Reflects an arrival already recorded, so a reopened screen stays honest. */
  alreadyArrived?: boolean;
}

/**
 * "وصلت" — tells the branch the customer is outside.
 *
 * ## Why it asks for location
 *
 * The server refuses the press unless the phone is inside the branch radius
 * (300m by default). That gate exists so an arrival cannot be reported from
 * home or from the road, which would send a barista out to an empty kerb. The
 * coordinates are sent for that check and nothing else.
 *
 * ## Why a refusal is spelled out
 *
 * There are two gates — ten minutes since the order, and proximity — and they
 * need opposite responses: wait, or drive closer. A single "couldn't do that"
 * leaves someone sitting in a car with a button that looks broken.
 *
 * ## Why pressing twice is safe
 *
 * The server treats arrival as an event, not a flag, and collapses repeated
 * presses inside a 60-second window into one. So a customer who taps again
 * because nothing visibly happened does not summon a second slip — but the
 * press is still logged, which is what someone reads when the customer says
 * they pressed it ten minutes ago.
 */
export function ArriveButton({ token, code, orderId, alreadyArrived }: ArriveButtonProps) {
  const [busy, setBusy] = useState(false);
  const [pressed, setArrived] = useState(false);
  const arrived = pressed || Boolean(alreadyArrived);

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Not a failure of the order — say what is missing and why.
        toast(describeArrivalError('location_required'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const res = await markCarArrived({
        token: token ?? null,
        code: code ?? null,
        orderId: orderId ?? null,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? undefined,
      });

      if (!res.ok) {
        toast(describeArrivalError(res.reason, res.retryAfterSec));
        return;
      }

      setArrived(true);
      // Remembered past this screen, so reopening the order still says the
      // branch was told instead of offering the button again.
      if (orderId) useOrderStore.getState().markArrived(orderId);
      toast('أبلغنا الفرع — الطلب في طريقه إليك');
    } catch {
      // A GPS read can fail outright (no fix indoors, hardware off).
      toast('تعذّر تحديد موقعك، تأكد من تفعيل الموقع');
    } finally {
      setBusy(false);
    }
  };

  if (arrived) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <Txt size={14} weight="extraBold" color={colors.success}>
          ✓ أبلغنا الفرع بوصولك
        </Txt>
        <Txt size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
          الباريستا في طريقه إلى سيارتك
        </Txt>
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <Button label="وصلت" iconLeft={<Icon name="car" size={20} accent={null} />} variant="gold" loading={busy} onPress={press} />
      <Txt size={11} color={colors.textFaint} center>
        اضغط عند وصولك لموقف الفرع
      </Txt>
    </View>
  );
}
