import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from 'expo-router';
import {
  CreditCard,
  CreditCardConfig,
  PaymentConfig,
  PaymentResponse,
  PaymentStatus,
  type PaymentResult,
} from 'react-native-moyasar-sdk';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Spinner, Txt } from '@/components';
import { toast } from '@/store';
import { formatRiyal } from '@/utils/numerals';
import { MOYASAR_PUBLISHABLE_KEY } from '@/services/storePay';
import {
  cateringPaymentDescription,
  cateringPaymentMetadata,
  describeCateringError,
  startCateringPayment,
  waitForCateringPayment,
  type CateringPayMode,
  type CateringPaymentIntent,
} from '@/services/storeCatering';

export interface PayOption {
  mode: CateringPayMode;
  label: string;
  /** Display estimate in riyals; the server's figure replaces it on the form. */
  estimateSar?: number;
  primary?: boolean;
}

type Stage =
  | { step: 'choose' }
  | { step: 'preparing' }
  | { step: 'card'; intent: CateringPaymentIntent; attempt: number }
  | { step: 'settling' };

/**
 * Pay a catering request by card — the booking's deposit or full amount, or
 * later the remainder.
 *
 * The Moyasar form is configured the way client-catering.js configures it:
 * description «كاترينق CK-####», metadata `{ catering_key, catering_intent }`,
 * mada/visa/mastercard. The metadata is the whole link between the charge and
 * the request — the webhook settles by it — so `MoyasarCardForm` (which
 * carries a store `order_id`) cannot be reused here.
 *
 * Each attempt asks the server for a fresh intent, as each tap on the site
 * does: retrying a failed card against an old intent is a server behaviour no
 * one here can read.
 */
export function CateringPayPanel({
  cateringKey,
  code,
  options,
  paidBefore,
  onSettled,
}: {
  cateringKey: string;
  code: string;
  options: PayOption[];
  /** `finance.paidHalalas` before this payment — settlement is a rise above it. */
  paidBefore: number;
  onSettled: (outcome: 'paid' | 'timeout' | 'free') => void;
}) {
  const [stage, setStage] = useState<Stage>({ step: 'choose' });

  // While the server confirms a charge the customer must stay: leaving would
  // hide the one screen that says the money is being confirmed.
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (stageRef.current.step !== 'settling') return;
        e.preventDefault();
        toast('انتظر لحظة — نؤكّد دفعتك');
      }),
    [navigation],
  );

  const begin = async (mode: CateringPayMode) => {
    setStage({ step: 'preparing' });
    try {
      const intent = await startCateringPayment(cateringKey, mode);
      if (!mounted.current) return;
      if (intent.free) {
        setStage({ step: 'choose' });
        onSettled('free');
        return;
      }
      setStage({ step: 'card', intent, attempt: 0 });
    } catch (e) {
      if (!mounted.current) return;
      toast(describeCateringError(e));
      setStage({ step: 'choose' });
    }
  };

  const onCardResult = async (outcome: 'paid' | 'failed') => {
    if (outcome === 'failed') {
      toast('لم تكتمل عملية الدفع، تحقّق من بيانات البطاقة');
      setStage({ step: 'choose' });
      return;
    }
    setStage({ step: 'settling' });
    const res = await waitForCateringPayment(cateringKey, paidBefore);
    if (!mounted.current) return;
    setStage({ step: 'choose' });
    onSettled(res);
  };

  if (stage.step === 'preparing') {
    return (
      <Card radiusKey="lg" style={{ alignItems: 'center' }}>
        <Spinner label="جارٍ تجهيز الدفع…" fill={false} />
      </Card>
    );
  }

  if (stage.step === 'settling') {
    return (
      <Card radiusKey="lg" style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
        <Spinner label="نؤكّد دفعتك…" fill={false} />
        <Txt size={12} color={colors.textMuted} center style={{ marginTop: spacing.sm, lineHeight: 19 }}>
          لا تغلق التطبيق — نتأكّد من اكتمال العملية لدى البنك
        </Txt>
      </Card>
    );
  }

  if (stage.step === 'card') {
    return (
      <View>
        <Txt size={13} color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          المبلغ المطلوب: <Txt size={13} weight="black" color={colors.ink}>{formatRiyal(stage.intent.amountHalalas / 100)}</Txt>
        </Txt>
        <CateringCard
          key={`${stage.intent.intentId}-${stage.attempt}`}
          cateringKey={cateringKey}
          code={code}
          intent={stage.intent}
          onResult={onCardResult}
        />
        <Button
          label="رجوع"
          variant="ghost"
          size="sm"
          onPress={() => setStage({ step: 'choose' })}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => (
        <Button
          key={o.mode}
          label={o.label}
          trailing={o.estimateSar != null ? formatRiyal(o.estimateSar) : undefined}
          variant={o.primary ? 'primary' : 'outline'}
          onPress={() => void begin(o.mode)}
        />
      ))}
    </View>
  );
}

function CateringCard({
  cateringKey,
  code,
  intent,
  onResult,
}: {
  cateringKey: string;
  code: string;
  intent: CateringPaymentIntent;
  onResult: (outcome: 'paid' | 'failed') => void;
}) {
  const paymentConfig = useMemo(
    () =>
      new PaymentConfig({
        publishableApiKey: MOYASAR_PUBLISHABLE_KEY,
        amount: intent.amountHalalas, // from createCateringPayment, never computed here
        currency: 'SAR',
        description: cateringPaymentDescription(code),
        metadata: cateringPaymentMetadata(cateringKey, intent.intentId),
        supportedNetworks: ['mada', 'visa', 'mastercard'],
        creditCard: new CreditCardConfig({ saveCard: false, manual: false }),
      }),
    [cateringKey, code, intent],
  );
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 14 }}>
      <CreditCard
        paymentConfig={paymentConfig}
        onPaymentResult={(result: PaymentResult) => {
          // Only a PaymentResponse carries a status; anything else is read as
          // not-paid, the safe side (see MoyasarCardForm).
          if (result instanceof PaymentResponse) {
            const paid =
              result.status === PaymentStatus.paid ||
              result.status === PaymentStatus.authorized ||
              result.status === PaymentStatus.captured;
            onResult(paid ? 'paid' : 'failed');
            return;
          }
          onResult('failed');
        }}
        style={{ textInputs: { borderWidth: 1.25 } }}
      />
    </View>
  );
}
