import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, View, Vibration } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Header, Icon, ScreenContainer, Spinner, TextField, Txt } from '@/components';
import { classifyScan, FOLLOW_LENGTH, normalizeFollowCode, PAGER_SESSION_RE } from '@/services/pagerLink';
import { describeFollowError, pagerFollow, pagerReason } from '@/services/storePager';
import { activePagers, usePagerStore } from '@/store/pagerStore';

/** After a rejected code, ignore the camera this long — the site's 2.5 s. */
const REJECT_PAUSE_MS = 2500;
const HINT = 'وجّه الكاميرا على باركود الكاشير';

/** True while the app is in the foreground. */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * «ماسح ضوئي» — scan the cashier's QR to follow an order at the counter.
 *
 * Only Sun Ray links are acted on (the website's rule). A camera that opens
 * whatever URL it sees is a phishing door: a sticker over the cashier's code
 * would send customers anywhere. A pager link opens in the app; any other
 * sunray.sa page opens in the browser; anything else is refused in place.
 *
 * The camera runs only while this screen is focused and the app is in the
 * foreground. expo-camera allows one live preview at a time, and a camera left
 * running behind another screen costs battery for nothing.
 */
export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const appActive = useAppActive();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean }>({ text: HINT });
  const handling = useRef(false);
  const rejectUntil = useRef(0);

  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState('');

  const active = activePagers(usePagerStore((s) => s.active));

  useFocusEffect(
    useCallback(() => {
      // Coming back from a pager or the browser: ready for the next code.
      setFocused(true);
      handling.current = false;
      setMsg({ text: HINT });
      return () => setFocused(false);
    }, []),
  );

  const onScanned = useCallback((res: BarcodeScanningResult) => {
    if (handling.current || Date.now() < rejectUntil.current) return;
    const kind = classifyScan(res.data);
    if (kind.kind === 'foreign') {
      rejectUntil.current = Date.now() + REJECT_PAUSE_MS;
      setMsg({ text: 'هذا الباركود ليس من سن راي — امسح باركود الكاشير', bad: true });
      return;
    }
    handling.current = true;
    Vibration.vibrate(60);
    if (kind.kind === 'pager') {
      router.push({ pathname: '/pager', params: { t: kind.token ?? '', s: kind.session ?? '' } });
      return;
    }
    Linking.openURL(kind.url)
      .catch(() => setMsg({ text: 'تعذّر فتح الرابط', bad: true }))
      .finally(() => {
        // The browser takes focus; this only matters if it did not open.
        rejectUntil.current = Date.now() + REJECT_PAUSE_MS;
        handling.current = false;
      });
  }, []);

  const openFollow = async () => {
    const c = normalizeFollowCode(code);
    if (c.length !== FOLLOW_LENGTH || codeBusy) return;
    setCodeBusy(true);
    setCodeError('');
    try {
      const d = await pagerFollow(c);
      if (!d.s || !PAGER_SESSION_RE.test(d.s)) {
        setCodeError(describeFollowError('link_invalid'));
        return;
      }
      setCode('');
      router.push({ pathname: '/pager', params: { s: d.s } });
    } catch (e) {
      setCodeError(describeFollowError(pagerReason(e)));
    } finally {
      setCodeBusy(false);
    }
  };

  const cameraOn = !!permission?.granted && focused && appActive;

  return (
    <ScreenContainer header={<Header showBack title="ماسح ضوئي" subtitle="تابع طلبك · فاتورتك · نقاطك" />}>
      <View
        style={{
          aspectRatio: 1,
          borderRadius: radius.xl,
          overflow: 'hidden',
          backgroundColor: colors.inkDeep,
          marginTop: spacing.md,
        }}
      >
        {!permission ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Spinner />
          </View>
        ) : !permission.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md }}>
            <Icon name="ticket" size={44} color={colors.white} />
            <Txt size={16} weight="extraBold" color={colors.textOnDark} center>
              نحتاج الكاميرا لمسح باركود الكاشير
            </Txt>
            <Txt size={13} color={colors.textOnDarkMuted} center style={{ lineHeight: 20 }}>
              {permission.canAskAgain
                ? 'نستخدمها للمسح فقط — لا نصوّر ولا نحفظ شيئًا.'
                : 'رفضت إذن الكاميرا سابقًا. فعّله من إعدادات جوالك، أو اكتب رمز المتابعة بالأسفل.'}
            </Txt>
            {permission.canAskAgain ? (
              <Button label="اسمح بالكاميرا" variant="gold" fullWidth={false} onPress={() => void requestPermission()} />
            ) : (
              <Button
                label="افتح الإعدادات"
                variant="gold"
                fullWidth={false}
                onPress={() => void Linking.openSettings().catch(() => {})}
              />
            )}
          </View>
        ) : cameraOn ? (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScanned}
            />
            {/* The frame tells the customer where to hold the code. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: '18%',
                bottom: '18%',
                left: '18%',
                right: '18%',
                borderWidth: 3,
                borderColor: colors.gold,
                borderRadius: radius.lg,
              }}
            />
          </View>
        ) : null}
      </View>

      <Txt
        size={14}
        weight="bold"
        center
        color={msg.bad ? colors.danger : colors.textMuted}
        style={{ marginTop: spacing.md }}
        accessibilityLiveRegion="polite"
      >
        {msg.text}
      </Txt>

      {active.length ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Txt size={15} weight="extraBold" color={colors.ink}>
            طلباتك الحالية
          </Txt>
          {active.map((p) => (
            <Card
              key={p.pid}
              onPress={() => router.push({ pathname: '/pager', params: { s: p.s, t: p.t ?? '' } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              <View
                style={{
                  borderWidth: 2,
                  borderColor: colors.ink,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  minWidth: 64,
                  alignItems: 'center',
                }}
              >
                <Txt size={22} weight="black" latin color={colors.ink}>
                  {p.number || '—'}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="extraBold" color={colors.ink}>
                  تابع طلبك
                </Txt>
                <Txt size={12} color={colors.textMuted}>
                  اضغط لفتح البيجر
                </Txt>
              </View>
              <Icon name="bell" size={26} />
            </Card>
          ))}
        </View>
      ) : null}

      <Card style={{ marginTop: spacing.xl, marginBottom: spacing['3xl'] }}>
        <Txt size={15} weight="extraBold" color={colors.ink}>
          عندك رمز متابعة؟
        </Txt>
        <Txt size={13} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 20 }}>
          اكتب الرمز المكوّن من ٦ خانات لتفتح طلبك بدون الباركود.
        </Txt>
        <TextField
          value={code}
          onChangeText={(v) => {
            setCode(normalizeFollowCode(v));
            setCodeError('');
          }}
          ltr
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={FOLLOW_LENGTH + 4}
          placeholder="XXXXXX"
          accessibilityLabel="رمز المتابعة"
          returnKeyType="go"
          onSubmitEditing={() => void openFollow()}
          containerStyle={{ marginTop: spacing.md }}
          style={{ textAlign: 'center', fontSize: 24, letterSpacing: 6 }}
        />
        {codeError ? (
          <Txt size={13} weight="bold" color={colors.danger} style={{ marginTop: spacing.sm }}>
            {codeError}
          </Txt>
        ) : null}
        <Button
          label="افتح طلبي"
          variant="primary"
          style={{ marginTop: spacing.md }}
          disabled={code.length !== FOLLOW_LENGTH}
          loading={codeBusy}
          onPress={() => void openFollow()}
        />
      </Card>
    </ScreenContainer>
  );
}
