import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, View, Vibration } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Divider, EmptyState, Header, Icon, ScreenContainer, Spinner, TrackSteps, Txt } from '@/components';
import { auth } from '@/services/firebase';
import { PAGER_SESSION_RE, PAGER_TOKEN_RE, receiptFromPos, type Receipt } from '@/services/pagerLink';
import {
  describeLoyaltyError,
  LOYALTY_REASON,
  pagerInvoice,
  pagerLoyalty,
  pagerOpen,
  pagerReason,
  pagerStatus,
  type PagerAck,
  type PagerMe,
  type PagerOrder,
  type PagerReply,
} from '@/services/storePager';
import { useAuthStore } from '@/store/authStore';
import { usePagerStore } from '@/store/pagerStore';
import { MONTHS_AR_LIST } from '@/utils/date';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';

/** The site's poll interval. The stage changes in seconds at the counter. */
const POLL_MS = 4000;
/** No good reply for this long ⇒ say the connection dropped. */
const STALE_MS = 15_000;
/** No invoice match after this ⇒ stop promising one (site: 5 minutes). */
const NO_INVOICE_MS = 5 * 60 * 1000;
/** Keep buzzing at most this long; the site stops its ring after a minute. */
const RING_MS = 60_000;
/** A first call older than this is old news — show it, don't buzz. */
const STALE_CALL_MS = 10 * 60 * 1000;
/** Strong, repeating pattern (Android honours the timings; iOS buzzes). */
const RING_PATTERN = [0, 400, 150, 400, 150, 600, 1500];

/** Used when `pagerInvoice` sends no merchant block — the site's defaults. */
const MERCHANT_DEFAULTS = { legalName: 'مقهى اشعة الشمس لتقديم المشروبات', vatNumber: '311874945500003' };

const STEPS = [
  { label: 'قيد التجهيز', en: 'Preparing' },
  { label: 'جاهز — تفضّل استلمه', en: 'Ready' },
  { label: 'تم الاستلام', en: 'Collected' },
];

type Phase = 'boot' | 'live' | 'dead' | 'offline';

function isLive(o: PagerOrder | null): boolean {
  return !!o && !o.expired && (o.stage === 'new' || o.stage === 'ready');
}

function noInvoice(o: PagerOrder | null): boolean {
  return !!o && o.details?.state !== 'matched' && Number(o.createdAgoMs) > NO_INVOICE_MS;
}

function headline(o: PagerOrder): string {
  if (o.expired && o.stage !== 'collected') return 'انتهى البيجر';
  switch (o.stage) {
    case 'ready':
      return 'جاهز — تفضّل استلمه';
    case 'collected':
      return 'تم الاستلام — بالعافية';
    case 'closed':
      return 'أُغلق هذا البيجر';
    default:
      return 'قيد التجهيز';
  }
}

/** POS close time in Saudi time (UTC+3, no DST), like the site's `dateKsa`. */
function ksaDateTime(v: number | string | undefined): string {
  const ms = typeof v === 'number' ? v : Date.parse(String(v ?? ''));
  if (!Number.isFinite(ms)) return '';
  const k = new Date(ms + 3 * 60 * 60 * 1000);
  const hh = String(k.getUTCHours()).padStart(2, '0');
  const mm = String(k.getUTCMinutes()).padStart(2, '0');
  // Read with getUTC* after shifting, so the phone's own timezone never leaks in.
  const day = `${toArabicDigits(k.getUTCDate())} ${MONTHS_AR_LIST[k.getUTCMonth()]} ${toArabicDigits(k.getUTCFullYear())}`;
  return `${day} · ${toArabicDigits(`${hh}:${mm}`)}`;
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * The pager — follow one counter order from the cashier's QR.
 *
 * Opens with the cashier token (`t`) or a saved session (`s`), then polls
 * `pagerStatus` every 4 s — but only while this screen is focused and the app
 * is in the foreground, and only until the order is collected, closed or
 * expired. The app has no push for pagers, and we do not pretend otherwise:
 * the ready alert fires while the customer has the app open.
 *
 * «جاهز» is a call event with a sequence number, not just a stage. Each call
 * buzzes once; a re-call from the counter buzzes again. The highest seq
 * already buzzed is saved with the session, so reopening does not re-ring.
 */
export function PagerScreen() {
  const params = useLocalSearchParams<{ t?: string; s?: string }>();
  const token = PAGER_TOKEN_RE.test(params.t ?? '') ? (params.t as string) : '';
  const sessionParam = PAGER_SESSION_RE.test(params.s ?? '') ? (params.s as string) : '';

  const [phase, setPhase] = useState<Phase>('boot');
  const [bootKey, setBootKey] = useState(0);
  const [order, setOrder] = useState<PagerOrder | null>(null);
  const [me, setMe] = useState<PagerMe | null>(null);
  const [follow, setFollow] = useState('');
  const [stale, setStale] = useState(false);
  const [ringSeq, setRingSeq] = useState(0);

  const [loyBusy, setLoyBusy] = useState(false);
  const [loyError, setLoyError] = useState('');
  const [invBusy, setInvBusy] = useState(false);
  const [invNote, setInvNote] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [merchant, setMerchant] = useState(MERCHANT_DEFAULTS);

  const sRef = useRef('');
  const lastOkAt = useRef(0);
  const inflight = useRef(false);
  const acks = useRef<PagerAck[]>([]);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [focused, setFocused] = useState(true);
  const appActive = useAppActive();
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const fbUser = auth().currentUser;
  // An anonymous Firebase user (opened by a guest's pager) is not an account.
  const signedIn = isAuthenticated && !isGuest && !!fbUser && !fbUser.isAnonymous;

  const stopRing = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
    Vibration.cancel();
    setRingSeq(0);
  }, []);

  // Never leave the phone buzzing behind a closed screen.
  useEffect(() => () => Vibration.cancel(), []);

  const pollRef = useRef<() => Promise<void>>(async () => {});

  const apply = useCallback(
    (d: PagerReply) => {
      if (d.s) sRef.current = d.s;
      if (d.me) setMe(d.me);
      if (d.follow) setFollow(d.follow);
      const o = d.order;
      if (!o) return;
      lastOkAt.current = Date.now();
      setStale(false);
      setOrder(o);
      setPhase('live');

      const store = usePagerStore.getState();
      if (isLive(o) && sRef.current) store.remember({ pid: o.pid, number: o.number, s: sRef.current, t: token || undefined });
      else store.forget(o.pid);

      if (!isLive(o)) {
        stopRing();
        return;
      }
      // Sent back to «new» by the counter: the earlier call no longer stands.
      if (o.stage === 'new') {
        stopRing();
        return;
      }
      const seq = o.call?.seq ?? 0;
      if (!seq || seq <= store.alertedSeq(o.pid)) return;
      store.markAlerted(o.pid, seq);
      if (seq === 1 && Number(o.readyAgoMs) > STALE_CALL_MS) return;

      setRingSeq(seq);
      Vibration.vibrate(RING_PATTERN, true);
      if (ringTimer.current) clearTimeout(ringTimer.current);
      ringTimer.current = setTimeout(() => Vibration.cancel(), RING_MS);
      // Tell the counter the alert reached the phone.
      acks.current.push({ seq, kind: 'page_alert' });
      void pollRef.current();
    },
    [token, stopRing],
  );

  const poll = useCallback(async () => {
    const s = sRef.current;
    if (!s || inflight.current) return;
    inflight.current = true;
    const ack = acks.current.shift() ?? null;
    try {
      apply(await pagerStatus(s, { ack }));
    } catch (e) {
      if (ack) acks.current.unshift(ack);
      if (pagerReason(e) === 'link_invalid') {
        const pid = order?.pid;
        if (pid) usePagerStore.getState().forget(pid);
        sRef.current = '';
        stopRing();
        setPhase('dead');
        return;
      }
      setStale(!!lastOkAt.current && Date.now() - lastOkAt.current > STALE_MS);
    } finally {
      inflight.current = false;
      if (acks.current.length && sRef.current) setTimeout(() => void pollRef.current(), 300);
    }
  }, [apply, order?.pid, stopRing]);
  pollRef.current = poll;

  // Open: a saved session first (no new session per visit), the token if refused.
  useEffect(() => {
    let alive = true;
    setPhase('boot');
    const saved = sessionParam || (token ? usePagerStore.getState().sessionForToken(token) : undefined) || '';
    if (!token && !saved) {
      setPhase('dead');
      return;
    }
    (async () => {
      try {
        let d: PagerReply;
        if (saved) {
          sRef.current = saved;
          try {
            d = await pagerStatus(saved, { withMe: true });
          } catch (e) {
            if (pagerReason(e) !== 'link_invalid' || !token) throw e;
            sRef.current = '';
            d = await pagerOpen(token);
          }
        } else {
          d = await pagerOpen(token);
        }
        if (alive) apply(d);
      } catch (e) {
        if (!alive) return;
        setPhase(pagerReason(e) === 'link_invalid' ? 'dead' : 'offline');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, sessionParam, bootKey, apply]);

  const live = isLive(order);

  // Poll only while someone is looking at a live order.
  useEffect(() => {
    if (!focused || !appActive || phase !== 'live' || !live) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    // Back from the background or another screen: refresh now, not in 4 s.
    if (Date.now() - lastOkAt.current > POLL_MS) void pollRef.current();
    const loop = () => {
      timer = setTimeout(() => {
        void pollRef.current().then(() => {
          if (!stopped) loop();
        });
      }, POLL_MS);
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [focused, appActive, phase, live]);

  const onMyWay = () => {
    const seq = ringSeq;
    stopRing();
    if (seq) {
      acks.current.push({ seq, kind: 'on_my_way' });
      void poll();
    }
  };

  const claimPoints = async () => {
    if (loyBusy || !sRef.current) return;
    setLoyBusy(true);
    setLoyError('');
    try {
      apply(await pagerLoyalty(sRef.current));
    } catch (e) {
      setLoyError(describeLoyaltyError(pagerReason(e)));
    } finally {
      setLoyBusy(false);
    }
  };

  const loadInvoice = async () => {
    if (invBusy || !sRef.current) return;
    setInvBusy(true);
    setInvNote('');
    try {
      const d = await pagerInvoice(sRef.current);
      const r = d.ok ? receiptFromPos(d.number, d.order) : null;
      if (!r) {
        setInvNote('فاتورتك بتكون متاحة فور وصول تفاصيل الطلب.');
        return;
      }
      setReceipt(r);
      if (d.merchant?.legalName || d.merchant?.vatNumber) {
        setMerchant({
          legalName: d.merchant.legalName || MERCHANT_DEFAULTS.legalName,
          vatNumber: d.merchant.vatNumber || MERCHANT_DEFAULTS.vatNumber,
        });
      }
    } catch {
      setInvNote('تعذّر تحميل الفاتورة — حاول مرة ثانية');
    } finally {
      setInvBusy(false);
    }
  };

  const header = <Header showBack title="البيجر" />;

  if (phase === 'boot') {
    return (
      <ScreenContainer scroll={false} header={header}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
          <Spinner />
          <Txt size={14} color={colors.textMuted}>
            جارٍ فتح البيجر…
          </Txt>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === 'dead' || !order) {
    const offline = phase === 'offline';
    return (
      <ScreenContainer scroll={false} header={header}>
        <EmptyState
          icon={offline ? 'offline' : 'sparkle'}
          title={offline ? 'تعذّر الاتصال' : 'انتهت صلاحية البيجر'}
          subtitle={
            offline
              ? 'تحقّق من الإنترنت. رقم طلبك المطبوع في الإيصال هو رقم المناداة.'
              : 'الرابط صالحٌ لطلبٍ واحد ولمدّة محدودة. اطلب من الموظف عرض الباركود مرّة أخرى.'
          }
          actionLabel={offline ? 'حاول مرّة ثانية' : 'ماسح ضوئي'}
          onAction={offline ? () => setBootKey((k) => k + 1) : () => router.replace('/scan')}
        />
      </ScreenContainer>
    );
  }

  const o = order;
  const matched = o.details?.state === 'matched';
  const stepIndex = o.stage === 'collected' ? 2 : o.stage === 'ready' ? 1 : 0;
  const L = o.loyalty ?? { state: 'none' as const };

  return (
    <ScreenContainer header={header}>
      {/* Status */}
      <Card style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <Txt size={13} weight="bold" color={colors.textMuted}>
          طلبك رقم
        </Txt>
        <View
          style={{
            marginTop: spacing.sm,
            borderWidth: 3,
            borderColor: o.stage === 'ready' && live ? colors.gold : colors.ink,
            backgroundColor: o.stage === 'ready' && live ? colors.chipGold : colors.card,
            borderRadius: radius.lg,
            paddingHorizontal: spacing['2xl'],
            paddingVertical: spacing.xs,
          }}
        >
          <Txt size={44} weight="black" latin color={colors.ink} center>
            {o.number || '—'}
          </Txt>
        </View>
        <Txt size={20} weight="black" color={colors.ink} center style={{ marginTop: spacing.md }}>
          {headline(o)}
        </Txt>
        {live && stale ? (
          <Txt size={13} weight="bold" color={colors.danger} center style={{ marginTop: spacing.sm }}>
            انقطع الاتصال — نحاول من جديد…
          </Txt>
        ) : null}
      </Card>

      {o.stage !== 'closed' && !(o.expired && o.stage !== 'collected') ? (
        <Card style={{ marginTop: spacing.md }}>
          <TrackSteps steps={STEPS} currentIndex={stepIndex} />
        </Card>
      ) : null}

      {/* What was ordered, or why it is not here yet */}
      {matched && o.details?.items?.length ? (
        <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {o.details.items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={{ flexDirection: 'row', gap: spacing.md }}>
              <Txt size={15} weight="black" color={colors.goldDeep}>
                {toArabicDigits(Number(it.qty) || 1)}×
              </Txt>
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="bold" color={colors.ink}>
                  {it.name}
                </Txt>
                {it.mods?.length ? (
                  <Txt size={12} color={colors.textMuted}>
                    {it.mods.join(' · ')}
                  </Txt>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      ) : live ? (
        <Card style={{ marginTop: spacing.md }}>
          <Txt size={13} color={colors.textMuted} style={{ lineHeight: 21 }}>
            {noInvoice(o)
              ? 'ما وصلتنا فاتورة لهذا الرقم — تقدر تطلبها من الكاشير. ومناداة طلبك تعمل كالمعتاد.'
              : o.details?.state === 'delayed'
                ? 'تفاصيل طلبك أخذت وقتًا أطول قليلًا. تقدر تتابع حالة طلبك من هذه الصفحة.'
                : 'خلال لحظات ستصلنا تفاصيل طلبك من نقطة البيع (عادةً ١٥–٣٠ ثانية).'}
          </Txt>
        </Card>
      ) : null}

      {live ? (
        <Txt size={12} color={colors.textFaint} center style={{ marginTop: spacing.md, lineHeight: 18 }}>
          خلّ التطبيق مفتوحًا على هذه الصفحة، ونهتزّ لك إذا جهز طلبك.
        </Txt>
      ) : null}

      <LoyaltySection
        order={o}
        matched={matched}
        signedIn={signedIn}
        me={me}
        busy={loyBusy}
        error={loyError}
        onClaim={() => void claimPoints()}
      />

      {/* Invoice */}
      {o.invoice ? (
        receipt ? (
          <ReceiptCard
            receipt={receipt}
            merchant={merchant}
            customerName={
              L.name && ['intent', 'processing', 'awarded', 'already'].includes(L.state) ? L.name : ''
            }
          />
        ) : (
          <Card style={{ marginTop: spacing.md }}>
            <Txt size={15} weight="extraBold" color={colors.ink}>
              فاتورتك
            </Txt>
            {invNote ? (
              <Txt size={13} color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                {invNote}
              </Txt>
            ) : null}
            <Button
              label="عرض الفاتورة"
              variant="outline"
              style={{ marginTop: spacing.md }}
              loading={invBusy}
              onPress={() => void loadInvoice()}
              iconLeft={<Icon name="receipt" size={20} />}
            />
          </Card>
        )
      ) : !matched && o.stage !== 'closed' && !noInvoice(o) ? (
        <Txt size={12} color={colors.textFaint} center style={{ marginTop: spacing.md }}>
          فاتورتك بتكون متاحة فور وصول تفاصيل الطلب.
        </Txt>
      ) : null}

      {follow && live ? (
        <Card style={{ marginTop: spacing.md }} backgroundColor={colors.cardAlt} shadow="xs">
          <Txt size={13} color={colors.textMuted}>
            رمز المتابعة — يفتح طلبك من أي جهاز عبر «ماسح ضوئي»:
          </Txt>
          <Txt size={24} weight="black" latin color={colors.ink} center style={{ marginTop: spacing.sm, letterSpacing: 6 }}>
            {follow}
          </Txt>
        </Card>
      ) : null}

      <View style={{ height: spacing['4xl'] }} />

      {/* Ready: full-screen, can't be missed */}
      <Modal visible={ringSeq > 0} animationType="fade" onRequestClose={onMyWay} statusBarTranslucent>
        <View
          style={{ flex: 1, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Icon name="bell" size={72} accent={colors.white} />
          <Txt size={34} weight="black" color={colors.inkDeep} center>
            طلبك جاهز
          </Txt>
          <Txt size={64} weight="black" latin color={colors.inkDeep} center>
            {o.number || ''}
          </Txt>
          <Txt size={17} weight="extraBold" color={colors.inkDeep} center>
            تفضّل استلمه من منطقة الاستلام
          </Txt>
          <Button label="أنا في الطريق" variant="primary" style={{ marginTop: spacing.lg }} onPress={onMyWay} />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

/**
 * Points for this order — honest states only.
 *
 * Nothing says «added» before the ledger has it: `intent` and `processing`
 * are their own messages, and only `awarded` promises points. A guest is sent
 * to sign in rather than asked for a phone here: the app's account is an OTP
 * one, and points on an unverified number would be points the customer
 * cannot see in the app.
 */
function LoyaltySection({
  order: o,
  matched,
  signedIn,
  me,
  busy,
  error,
  onClaim,
}: {
  order: PagerOrder;
  matched: boolean;
  signedIn: boolean;
  me: PagerMe | null;
  busy: boolean;
  error: string;
  onClaim: () => void;
}) {
  const L = o.loyalty ?? { state: 'none' as const };
  const eligible = Number(L.eligible) || 0;

  if (noInvoice(o) && (L.state === 'none' || L.state === 'intent')) {
    if (L.state === 'none') return null;
    return (
      <Card style={{ marginTop: spacing.md }}>
        <Txt size={13} color={colors.textMuted}>
          ما لقينا فاتورة لهذا الطلب، فما انحسبت نقاطه.
        </Txt>
      </Card>
    );
  }
  if (L.state === 'none' && (o.expired || o.stage === 'closed' || (matched && eligible <= 0))) return null;

  const okLine = (text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name="check" size={22} />
      <Txt size={15} weight="extraBold" color={colors.success} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );

  let body: React.ReactNode = null;
  if (L.state === 'none') {
    const head = matched && eligible > 0 ? `طلبك يستحق ${toArabicDigits(eligible)} نقطة ولاء` : 'اكسب نقاطًا على طلبك';
    body = (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="sun" size={26} />
          <Txt size={16} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
            {head}
          </Txt>
        </View>
        {!(matched && eligible > 0) ? (
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
            بنحسبها فور وصول تفاصيله.
          </Txt>
        ) : null}
        {signedIn ? (
          <>
            {me ? (
              <Txt size={13} color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                {(me.name || '').split(' ')[0] || 'أهلًا بك'} · رصيدك الحالي {toArabicDigits(Number(me.balance) || 0)} نقطة
                {me.phoneMasked ? ` · ${me.phoneMasked}` : ''}
              </Txt>
            ) : null}
            {error ? (
              <Txt size={13} weight="bold" color={colors.danger} style={{ marginTop: spacing.sm }}>
                {error}
              </Txt>
            ) : null}
            <Button label="سجّل لي النقاط" variant="gold" style={{ marginTop: spacing.md }} loading={busy} onPress={onClaim} />
          </>
        ) : (
          <>
            <Txt size={13} color={colors.textMuted} style={{ marginTop: spacing.sm, lineHeight: 20 }}>
              سجّل دخولك برقم جوالك لتُضاف نقاط هذا الطلب إلى حسابك، ثم ارجع لطلبك من «ماسح ضوئي».
            </Txt>
            <Button
              label="سجّل دخولك"
              variant="outline"
              style={{ marginTop: spacing.md }}
              onPress={() => router.push('/(auth)/login')}
            />
          </>
        )}
      </>
    );
  } else if (L.state === 'intent') {
    body = (
      <>
        {okLine('استلمنا طلب التسجيل')}
        <Txt size={13} color={colors.textMuted} style={{ marginTop: 4 }}>
          {matched ? 'جارٍ تسجيل نقاطك…' : 'بنسجّل النقاط فور وصول تفاصيل الطلب.'}
        </Txt>
      </>
    );
  } else if (L.state === 'processing') {
    body = (
      <Txt size={14} weight="bold" color={colors.textMuted}>
        جارٍ تسجيل نقاطك…
      </Txt>
    );
  } else if (L.state === 'awarded') {
    body = (
      <>
        {okLine(`تمت إضافة ${toArabicDigits(Number(L.points) || 0)} نقطة إلى حسابك`)}
        {L.held ? (
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
            تصير قابلة للاستخدام بعد {toArabicDigits(L.holdMinutes || 15)} دقيقة من الطلب
          </Txt>
        ) : null}
        <Button
          label="نقاطي ومكافآتي"
          variant="outline"
          style={{ marginTop: spacing.md }}
          onPress={() => router.push('/(tabs)/loyalty')}
        />
      </>
    );
  } else if (L.state === 'already') {
    body = okLine('نقاط هذا الطلب مسجّلة مسبقًا');
  } else if (L.state === 'attention') {
    body = (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="alert" size={22} />
          <Txt size={15} weight="extraBold" color={colors.ink}>
            النقاط تحتاج مراجعة
          </Txt>
        </View>
        <Txt size={13} color={colors.textMuted} style={{ marginTop: 4 }}>
          {LOYALTY_REASON[L.reason ?? ''] ?? LOYALTY_REASON.error}
        </Txt>
      </>
    );
  }
  if (!body) return null;
  return <Card style={{ marginTop: spacing.md }}>{body}</Card>;
}

/**
 * The POS invoice as a plain receipt.
 *
 * An electronic copy, said so on the paper: the tax QR lives on the printed
 * receipt from the point of sale, and inventing one here would be a fake
 * ZATCA code. Totals are the POS's own (see `receiptFromPos`).
 */
function ReceiptCard({
  receipt: r,
  merchant,
  customerName,
}: {
  receipt: Receipt;
  merchant: { legalName: string; vatNumber: string };
  customerName: string;
}) {
  const money = (h: number) => formatRiyal(h / 100);
  const row = (label: string, value: string, strong?: boolean) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
      <Txt size={strong ? 15 : 13} weight={strong ? 'black' : 'bold'} color={strong ? colors.ink : colors.textMuted}>
        {label}
      </Txt>
      <Txt size={strong ? 15 : 13} weight={strong ? 'black' : 'bold'} color={colors.ink}>
        {value}
      </Txt>
    </View>
  );
  const when = ksaDateTime(r.closedAt);
  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Icon name="receipt" size={30} />
        <Txt size={15} weight="black" color={colors.ink} center>
          {merchant.legalName}
        </Txt>
        <Txt size={12} color={colors.textMuted} center>
          الرقم الضريبي {merchant.vatNumber}
        </Txt>
        <Txt size={12} weight="bold" color={colors.textMuted} center style={{ marginTop: 4 }}>
          فاتورة ضريبية مبسّطة
        </Txt>
      </View>
      <Divider dashed />
      {row('رقم الفاتورة', r.code)}
      {r.number ? row('رقم الطلب', r.number) : null}
      {r.branchName ? row('الفرع', r.branchName) : null}
      {when ? row('التاريخ', when) : null}
      {customerName ? row('العميل', customerName) : null}
      <Divider dashed />
      {r.lines.map((l, i) => (
        <View key={`${l.name}-${i}`} style={{ flexDirection: 'row', gap: spacing.sm, marginTop: i ? spacing.sm : 0 }}>
          <Txt size={14} weight="black" color={colors.goldDeep}>
            {toArabicDigits(l.qty)}×
          </Txt>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="bold" color={colors.ink}>
              {l.name}
            </Txt>
            {l.mods ? (
              <Txt size={12} color={colors.textMuted}>
                {l.mods}
              </Txt>
            ) : null}
          </View>
          {l.lineHalalas != null ? (
            <Txt size={14} weight="bold" color={colors.ink}>
              {money(l.lineHalalas)}
            </Txt>
          ) : null}
        </View>
      ))}
      <Divider dashed />
      {r.discountHalalas ? row('الخصم', money(r.discountHalalas)) : null}
      {row('المجموع قبل الضريبة', money(r.subExclHalalas))}
      {row('ضريبة القيمة المضافة', money(r.vatHalalas))}
      {r.roundingHalalas ? row('التقريب', money(r.roundingHalalas)) : null}
      {row('الإجمالي', money(r.totalHalalas), true)}
      {r.payments.length
        ? row('الدفع', r.payments.map((p) => `${p.method} ${money(p.amountHalalas)}`).join(' · '))
        : null}
      <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.md, lineHeight: 17 }}>
        نسخة إلكترونية من فاتورة نقطة البيع — الرمز الضريبي على الفاتورة المطبوعة
      </Txt>
    </Card>
  );
}
