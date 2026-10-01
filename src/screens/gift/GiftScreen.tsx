import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Share, Switch, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  ErrorState,
  GiftCardPreview,
  Header,
  Icon,
  PhoneField,
  ScreenContainer,
  Spinner,
  TextField,
  Txt,
} from '@/components';
import { giftDesignById, giftDesigns } from '@/data';
import { auth } from '@/services/firebase';
import {
  BG_DEFAULT,
  BG_PALETTE,
  GIFT_LIMITS,
  RM_DEFAULT,
  RM_PALETTE,
  createGiftCardPayment,
  describeGiftError,
  getGiftCard,
  giftShareMessage,
  giftShareUrl,
  isGiftPaid,
  packageContents,
  sanitizeHex,
  updateGiftCardDetails,
  waitForGiftActive,
  type GiftCardDetails,
  type GiftCardView,
  type GiftDesignId,
  type GiftPaymentIntent,
} from '@/services/storeGifts';
import { formatRiyal } from '@/utils/numerals';
import { isValidSaudiMobile, normalizeMobile } from '@/utils/validators';
import { useAuthStore, toast } from '@/store';
import { GiftPayForm } from './GiftPayForm';

type Stage =
  | { step: 'loading' }
  | { step: 'invalid'; message: string }
  /** Writing the card. */
  | { step: 'form' }
  /** Intent exists on the server; collecting the card. */
  | { step: 'pay'; intent: GiftPaymentIntent }
  /** Charged on this phone; waiting for the server to activate the gift. */
  | { step: 'settling'; intent: GiftPaymentIntent }
  /** The server has not confirmed within the wait. Not a failure. */
  | { step: 'pending' }
  | { step: 'done' };

/**
 * One gift, from writing the card to sharing the link.
 *
 * This is the app's copy of sunray.sa's `store/gift.html?g=<id>` for the
 * person giving — same calls, same order, same fields:
 *
 *   getGiftCard → updateGiftCardDetails → createGiftCardPayment → Moyasar →
 *   getGiftCard until `active` → share the link.
 *
 * Keyed by the gift id rather than holding the flow in memory, so a gift left
 * unpaid can be resumed from «هداياي», and a paid one opened again shows its
 * link to share.
 */
export function GiftScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = String(rawId ?? '');
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signedIn = isAuthenticated && !isGuest;

  const [stage, setStage] = useState<Stage>({ step: 'loading' });
  const [gift, setGift] = useState<GiftCardView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A failed attempt leaves Moyasar's form on its finished 3-D Secure page;
  // a fresh one has to be mounted to try again (as in checkout).
  const [attempt, setAttempt] = useState(0);

  // The card being written.
  const [occasion, setOccasion] = useState('');
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [phone, setPhone] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [design, setDesign] = useState<GiftDesignId>('sunray');
  const [rm, setRm] = useState(RM_DEFAULT);
  const [bg, setBg] = useState(BG_DEFAULT);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  /** Fill the form from what the server already holds — a resumed gift keeps its words. */
  const prefill = (g: GiftCardView) => {
    const c = g.card ?? {};
    setOccasion(c.occasion ?? '');
    setMessage(c.message ?? '');
    setSenderName(c.senderName?.trim() || auth().currentUser?.displayName?.trim() || '');
    setReceiverName(c.receiverName ?? '');
    setPhone(c.recipientPhone ? normalizeMobile(String(c.recipientPhone).replace(/^(\+?966|0)/, '')) : '');
    setShowDetails(!!c.showDetails);
    if (c.design === 'sunray' || c.design === 'graduation' || c.design === 'custom') setDesign(c.design);
    setRm(sanitizeHex(c.rmColor, RM_DEFAULT));
    setBg(sanitizeHex(c.bgColor, BG_DEFAULT));
  };

  const load = useCallback(async () => {
    setStage({ step: 'loading' });
    try {
      const g = await getGiftCard(id);
      if (!mountedRef.current) return;
      if (!g) {
        setStage({ step: 'invalid', message: 'لم نعثر على هذه البطاقة' });
        return;
      }
      setGift(g);
      if (isGiftPaid(g)) setStage({ step: 'done' });
      else if (g.status === 'cancelled') setStage({ step: 'invalid', message: 'هذه البطاقة لم تعد سارية' });
      else {
        prefill(g);
        setStage({ step: 'form' });
      }
    } catch (e) {
      if (mountedRef.current) setStage({ step: 'invalid', message: describeGiftError(e) });
    }
  }, [id]);

  useEffect(() => {
    if (!signedIn) return;
    void load();
  }, [load, signedIn]);

  /**
   * While the server confirms a charge the customer stays here — the same
   * guard as checkout. Leaving mid-wait would drop the confirmation, and a
   * customer who does not see one tends to pay again.
   */
  const stageRef = useRef(stage);
  stageRef.current = stage;
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

  const card = (): GiftCardDetails => ({
    occasion: occasion.trim(),
    message: message.trim(),
    senderName: senderName.trim(),
    receiverName: receiverName.trim(),
    // The site's field takes «05XXXXXXXX»; the app's field holds the nine
    // digits after +966. Same number, in the form the server already parses.
    recipientPhone: phone ? `0${normalizeMobile(phone)}` : '',
    showDetails,
    design,
    rmColor: design === 'custom' ? rm : null,
    bgColor: design === 'custom' ? bg : null,
  });

  const startPay = async () => {
    if (submitting) return;
    if (phone && !isValidSaudiMobile(phone)) {
      toast('رقم جوال المستلم غير صحيح — أو اتركه فارغاً');
      return;
    }
    setSubmitting(true);
    try {
      // Details first, then the intent — the site's order. The card is saved
      // before money moves so a paid gift never goes out blank.
      await updateGiftCardDetails(id, card());
      const intent = await createGiftCardPayment(id);
      if (mountedRef.current) setStage({ step: 'pay', intent });
    } catch (e) {
      if (/already_paid/.test(String((e as Error)?.message ?? e))) {
        // Paid in another session or on the site. Show it, do not charge again.
        toast(describeGiftError(e));
        void load();
      } else {
        toast(describeGiftError(e));
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  /**
   * The card form finished on this phone. Ask the server what happened.
   *
   * The device's "paid" is a hint (see `storePay.ts`); the gift turns `active`
   * only when Moyasar's webhook reaches the server. A timeout is shown as
   * "still confirming", never as a failure — the charge may have gone through.
   */
  const onPaymentResult = async (outcome: 'paid' | 'failed') => {
    if (stage.step !== 'pay') return;
    if (outcome === 'failed') {
      toast('لم تكتمل عملية الدفع، تحقّق من بيانات البطاقة');
      setAttempt((n) => n + 1);
      return;
    }
    setStage({ step: 'settling', intent: stage.intent });
    const res = await waitForGiftActive(id, { isCancelled: () => !mountedRef.current });
    if (!mountedRef.current) return;
    if (res.status === 'active') {
      setGift(res.gift);
      setStage({ step: 'done' });
    } else {
      setStage({ step: 'pending' });
    }
  };

  const recheck = async () => {
    setSubmitting(true);
    const g = await getGiftCard(id).catch(() => null);
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (isGiftPaid(g)) {
      setGift(g);
      setStage({ step: 'done' });
    } else {
      toast('لم يتأكّد الدفع بعد — حاول بعد قليل');
    }
  };

  const share = () => {
    Share.share({ message: giftShareMessage(id), title: 'بطاقة إهداء' }).catch(() => {});
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = <Header showBack title={stage.step === 'done' ? 'بطاقتك جاهزة' : 'بطاقة الإهداء'} />;

  if (!signedIn) {
    return (
      <ScreenContainer header={header}>
        <View style={{ paddingTop: spacing['4xl'] }}>
          <ErrorState
            title="سجّل دخولك أولاً"
            message="الإهداء مرتبط بحسابك لتجده في «هداياي» وتشاركه متى شئت."
            retryLabel="تسجيل الدخول"
            onRetry={() => router.push('/(auth)/login')}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (stage.step === 'loading') {
    return (
      <ScreenContainer header={header}>
        <Spinner label="جارٍ تحميل البطاقة…" />
      </ScreenContainer>
    );
  }

  if (stage.step === 'invalid') {
    return (
      <ScreenContainer header={header}>
        <View style={{ paddingTop: spacing['4xl'] }}>
          <ErrorState title={stage.message} onRetry={() => void load()} />
        </View>
      </ScreenContainer>
    );
  }

  if (stage.step === 'done' && gift) return <GiftDone id={id} gift={gift} onShare={share} header={header} />;

  if (stage.step === 'pending') {
    return (
      <ScreenContainer header={header}>
        <Card radiusKey="lg" style={{ marginTop: spacing['2xl'], alignItems: 'center', paddingVertical: spacing['2xl'] }}>
          <Icon name="hourglass" size={44} />
          <Txt size={16} weight="black" color={colors.ink} center style={{ marginTop: spacing.md }}>
            نؤكّد دفعتك الآن
          </Txt>
          <Txt size={13} color={colors.textMuted} center style={{ marginTop: spacing.sm, lineHeight: 21 }}>
            تأخّر تأكيد البنك قليلاً. لا تدفع مرة ثانية — ستجد البطاقة في «هداياي» حين يكتمل التأكيد.
          </Txt>
          <Button label="تحقّق الآن" onPress={() => void recheck()} loading={submitting} style={{ marginTop: spacing.lg }} />
          <Button label="هداياي" variant="ghost" onPress={() => router.replace('/gift/mine')} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScreenContainer>
    );
  }

  const paying = stage.step === 'pay' || stage.step === 'settling';
  const d = giftDesignById(design);
  const pkg = gift?.package;
  const contents = pkg ? packageContents({ cups: Number(pkg.cups) || 0, desserts: Number(pkg.desserts) || 0 }) : '';

  return (
    <ScreenContainer
      header={header}
      footer={
        paying ? (
          <Txt size={12} color={colors.textMuted} center style={{ paddingTop: spacing.md }}>
            {stage.step === 'settling'
              ? 'جارٍ التأكيد…'
              : `بطاقة ${stage.intent.code} · ${formatRiyal(stage.intent.amountHalalas / 100)}`}
          </Txt>
        ) : (
          <View style={{ paddingTop: spacing.md }}>
            <Button
              label="دفع وإصدار البطاقة"
              variant="gold"
              // Display only: the charge is what `createGiftCardPayment` returns.
              trailing={gift?.amountSar ? formatRiyal(Number(gift.amountSar)) : undefined}
              onPress={() => void startPay()}
              loading={submitting}
            />
          </View>
        )
      }
    >
      <View style={{ paddingTop: spacing.md, paddingBottom: spacing['2xl'] }}>
        {pkg ? (
          <Card radiusKey="lg" backgroundColor={colors.chipGold} style={{ marginBottom: spacing.lg }}>
            <Txt size={14} weight="black" color={colors.ink}>
              باقة «{pkg.name ?? ''}»
            </Txt>
            {contents ? (
              <Txt size={13} color={colors.textSecondary} style={{ marginTop: 4, lineHeight: 21 }}>
                تشمل {contents} — يختارها المستلِم عند فتح الهديّة.
              </Txt>
            ) : null}
          </Card>
        ) : null}

        {/* Live preview: the face the recipient will see, and the words on its back. */}
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
          <GiftCardPreview design={d} rmColor={rm} bgColor={bg} size="sm" style={{ width: '40%' }} />
          <GiftCardBack
            card={{ occasion, message, senderName, receiverName }}
            code={gift?.code}
            style={{ flex: 1 }}
          />
        </View>

        {paying ? (
          <View style={{ marginTop: spacing.xl }}>
            <Txt size={15} weight="black" color={colors.ink} style={{ marginBottom: spacing.md }}>
              بيانات البطاقة
            </Txt>
            {stage.step === 'settling' ? (
              <Card radiusKey="lg" style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
                <Spinner label="نؤكّد دفعتك…" fill={false} />
                <Txt size={12} color={colors.textMuted} center style={{ marginTop: spacing.sm, lineHeight: 19 }}>
                  لا تغلق التطبيق — نتأكّد من اكتمال العملية لدى البنك
                </Txt>
              </Card>
            ) : (
              <>
                <GiftPayForm key={`${stage.intent.intentId}-${attempt}`} giftId={id} intent={stage.intent} onResult={onPaymentResult} />
                <Pressable
                  onPress={() => setStage({ step: 'form' })}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ marginTop: spacing.md, alignSelf: 'center' }}
                >
                  <Txt size={13} weight="extraBold" color={colors.goldDeep}>
                    تعديل البطاقة
                  </Txt>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <TextField
              label="عنوان الإهداء (اختياري)"
              placeholder="مثال: مبروك التخرّج"
              value={occasion}
              onChangeText={setOccasion}
              maxLength={GIFT_LIMITS.occasion}
              containerStyle={{ marginTop: spacing.xl }}
            />
            <TextField
              label="رسالة الإهداء (اختياري)"
              placeholder="اكتب كلمة لطيفة من قلبك…"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={GIFT_LIMITS.message}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              containerStyle={{ marginTop: spacing.md }}
            />
            <TextField
              label="اسم المُرسِل (اختياري)"
              placeholder="من: …"
              value={senderName}
              onChangeText={setSenderName}
              maxLength={GIFT_LIMITS.senderName}
              containerStyle={{ marginTop: spacing.md }}
            />
            <TextField
              label="اسم المُستلِم (اختياري)"
              placeholder="إلى: …"
              value={receiverName}
              onChangeText={setReceiverName}
              maxLength={GIFT_LIMITS.receiverName}
              containerStyle={{ marginTop: spacing.md }}
            />

            <Label>رقم جوال المُستلِم (اختياري)</Label>
            <PhoneField value={phone} onChangeText={setPhone} />
            <Txt size={12} color={colors.textMuted} style={{ marginTop: 6, lineHeight: 19 }}>
              إدخال الرقم يعني أن المستلم تصله رسالة نصية فيها رابط الهديّة بعد إتمام الدفع.
            </Txt>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
              <View style={{ flex: 1 }}>
                <Txt size={14} weight="extraBold" color={colors.ink}>
                  إظهار تفاصيل الباقة للمستلم
                </Txt>
                <Txt size={12} color={colors.textMuted} style={{ lineHeight: 19 }}>
                  مخفية افتراضياً لتبقى مفاجأة. السعر لا يظهر أبداً.
                </Txt>
              </View>
              <Switch
                value={showDetails}
                onValueChange={setShowDetails}
                trackColor={{ false: colors.border, true: colors.gold }}
                thumbColor={colors.white}
              />
            </View>

            <Label>اختر التصميم</Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {giftDesigns.map((g) => {
                const on = g.id === design;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setDesign(g.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={g.nameAr}
                    style={{ flex: 1, alignItems: 'center' }}
                  >
                    <View
                      style={{
                        width: '100%',
                        borderRadius: radius.xl + 3,
                        borderWidth: 3,
                        borderColor: on ? colors.gold : 'transparent',
                      }}
                    >
                      <GiftCardPreview
                        design={g}
                        rmColor={g.id === 'custom' ? rm : undefined}
                        bgColor={g.id === 'custom' ? bg : undefined}
                        size="sm"
                      />
                    </View>
                    <Txt size={12} weight={on ? 'extraBold' : 'bold'} color={on ? colors.ink : colors.textMuted} style={{ marginTop: 6 }}>
                      {g.nameAr}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>

            {design === 'custom' ? (
              <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
                <Txt size={12} color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                  لوّنها بذوقك — اختر لوناً للنقوش وآخر للخلفية.
                </Txt>
                <Swatches title="لون النقوش" palette={RM_PALETTE} value={rm} onChange={setRm} />
                <Swatches title="لون الخلفية" palette={BG_PALETTE} value={bg} onChange={setBg} />
              </Card>
            ) : null}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

/** After payment: the card, its link, and the share sheet. */
function GiftDone({
  id,
  gift,
  onShare,
  header,
}: {
  id: string;
  gift: GiftCardView;
  onShare: () => void;
  header: ReactNode;
}) {
  const c = gift.card ?? {};
  const d = giftDesignById(c.design);
  const used = gift.status === 'used';
  return (
    <ScreenContainer header={header}>
      <View style={{ paddingTop: spacing.md, paddingBottom: spacing['2xl'] }}>
        <Txt size={13} color={colors.textMuted} center style={{ lineHeight: 21, marginBottom: spacing.lg }}>
          {used
            ? 'استُلمت هذه الهديّة.'
            : 'أرسل الرابط للمُهدى إليه — يفتحها، يقرأ إهداءك، ويختار هديّته.'}
        </Txt>

        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
          <GiftCardPreview design={d} rmColor={c.rmColor} bgColor={c.bgColor} size="sm" style={{ width: '40%' }} />
          <GiftCardBack card={c} code={gift.code} style={{ flex: 1 }} />
        </View>

        {gift.smsSent ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg }}>
            <Icon name="check" size={18} color={colors.success} accent={null} />
            <Txt size={13} weight="extraBold" color={colors.success}>
              أُرسلت رسالة نصية للمستلم برابط الهديّة
            </Txt>
          </View>
        ) : null}

        {!used ? (
          <>
            <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
              <Txt size={12} color={colors.textMuted} style={{ marginBottom: 6 }}>
                رابط الهديّة
              </Txt>
              {/* Selectable, so it can be copied by hand — there is no clipboard
                  module in this build. */}
              <Txt size={13} latin selectable color={colors.ink} style={{ writingDirection: 'ltr', textAlign: 'left' }}>
                {giftShareUrl(id)}
              </Txt>
            </Card>
            <Button label="مشاركة الرابط" variant="gold" onPress={onShare} style={{ marginTop: spacing.lg }} />
          </>
        ) : null}
        <Button label="هداياي" variant="outline" onPress={() => router.replace('/gift/mine')} style={{ marginTop: spacing.md }} />
      </View>
    </ScreenContainer>
  );
}

/**
 * The back of the card — the site's `backHtml`: title, message, names, and the
 * gift code the recipient shows at the counter.
 */
function GiftCardBack({
  card,
  code,
  style,
}: {
  card: Partial<Pick<GiftCardDetails, 'occasion' | 'message' | 'senderName' | 'receiverName'>>;
  code?: string;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.cardAlt,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          padding: spacing.md,
          justifyContent: 'space-between',
        },
        style,
      ]}
    >
      <View>
        <Txt size={16} weight="black" color={colors.goldDeep} numberOfLines={2}>
          {card.occasion?.trim() || 'إهداء لك'}
        </Txt>
        {card.message?.trim() ? (
          <Txt size={13} color={colors.ink} style={{ marginTop: 6, lineHeight: 20 }} numberOfLines={8}>
            {card.message.trim()}
          </Txt>
        ) : null}
        {card.receiverName?.trim() ? (
          <Txt size={12} weight="bold" color={colors.textSecondary} style={{ marginTop: 8 }} numberOfLines={1}>
            إلى: {card.receiverName.trim()}
          </Txt>
        ) : null}
        {card.senderName?.trim() ? (
          <Txt size={12} weight="bold" color={colors.textSecondary} numberOfLines={1}>
            من: {card.senderName.trim()}
          </Txt>
        ) : null}
      </View>
      {code ? (
        <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDashed, paddingTop: 8 }}>
          <Txt size={10} color={colors.textFaint}>
            كود الإهداء
          </Txt>
          <Txt size={18} weight="black" latin color={colors.goldDeep} style={{ writingDirection: 'ltr', textAlign: 'left' }}>
            {code}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function Swatches({
  title,
  palette,
  value,
  onChange,
}: {
  title: string;
  palette: readonly string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Txt size={13} weight="extraBold" color={colors.ink} style={{ marginBottom: 8 }}>
        {title}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {palette.map((c) => {
          const on = c === value;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c}
              hitSlop={4}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c,
                borderWidth: on ? 3 : 1,
                borderColor: on ? colors.ink : colors.border,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
      {children}
    </Txt>
  );
}
