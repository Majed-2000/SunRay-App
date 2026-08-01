import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Header, ScreenContainer, TextField, Txt } from '@/components';
import { formatRiyal } from '@/utils/numerals';
import { deleteAccount } from '@/services/auth';
import { useAuthStore, useWalletStore, toast } from '@/store';

/** Typed exactly to confirm. Short enough to type, specific enough to be deliberate. */
const CONFIRM_WORD = 'حذف';

/**
 * Account deletion.
 *
 * Deliberately a full screen, not a dialog. A dialog invites a reflexive tap;
 * this is irreversible, so the consequences get room to be read, and the action
 * is gated behind typing a word rather than a second "are you sure".
 *
 * The screen states plainly what survives deletion. Saying "everything will be
 * deleted" would be a lie: invoices are retained for tax purposes, and the
 * café's POS holds its own copy we have no right to touch. A person deciding
 * whether to leave deserves the accurate version.
 */
export function DeleteAccountScreen() {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const balance = useWalletStore((s) => s.balance);
  const logout = useAuthStore((s) => s.logout);

  const canDelete = confirm.trim() === CONFIRM_WORD && !busy;

  const onDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      await deleteAccount();
      // Clear local state before navigating: the tokens are already revoked
      // server-side, and leaving a stale session would show a signed-in shell
      // over an account that no longer exists.
      logout();
      toast('تم حذف حسابك');
      router.replace('/(auth)/login');
    } catch {
      toast('تعذّر حذف الحساب، حاول مرة أخرى');
      setBusy(false);
    }
  };

  return (
    <ScreenContainer header={<Header showBack title="حذف الحساب" />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Txt size={20} weight="black" color={colors.ink}>
          هذا الإجراء نهائي
        </Txt>
        <Txt size={14} color={colors.textSecondary} style={{ marginTop: 8, lineHeight: 24 }}>
          لا يمكن التراجع عن حذف الحساب، ولا يمكن استرجاع بياناتك بعده.
        </Txt>

        {balance > 0 ? (
          <Card
            radiusKey="lg"
            style={{ marginTop: spacing.xl, borderWidth: 1, borderColor: colors.terracotta }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="wallet-outline" size={20} color={colors.terracotta} />
              <Txt size={15} weight="black" color={colors.terracotta} style={{ flex: 1 }}>
                لديك رصيد {formatRiyal(balance)}
              </Txt>
            </View>
            <Txt size={13} color={colors.textSecondary} style={{ marginTop: 8, lineHeight: 21 }}>
              سيُفقد هذا الرصيد نهائيًا عند الحذف ولن يُعاد. استخدمه قبل المتابعة إن أردت.
            </Txt>
          </Card>
        ) : null}

        <Section title="سيُحذف نهائيًا">
          <Line icon="person-outline" text="اسمك ورقم جوالك وبريدك وبياناتك الشخصية" />
          <Line icon="location-outline" text="عناوينك المحفوظة" />
          <Line icon="star-outline" text="نقاط الولاء وأكواب القهوة المجمّعة" />
          <Line icon="notifications-outline" text="إشعاراتك" />
          <Line icon="log-out-outline" text="جلساتك على كل الأجهزة" />
        </Section>

        <Section title="سيبقى محفوظًا">
          <Line
            icon="receipt-outline"
            text="فواتير طلباتك السابقة — يُلزمنا النظام الضريبي بحفظها، وتُفصل عن هويتك فلا تدل عليك"
          />
          <Line
            icon="gift-outline"
            text="بطاقات الهدايا التي أرسلتها ولم تُستخدم بعد — حتى لا تضيع قيمتها على من يحملها"
          />
          <Line
            icon="storefront-outline"
            text="سجلّ مشترياتك في نظام المقهى (فودكس) — سجلّ يخصّ المقهى، لحذفه تواصل معهم مباشرة"
          />
        </Section>

        <View style={{ marginTop: spacing.xl }}>
          <Txt size={14} weight="bold" color={colors.ink}>
            اكتب «{CONFIRM_WORD}» للتأكيد
          </Txt>
          <TextField
            value={confirm}
            onChangeText={setConfirm}
            placeholder={CONFIRM_WORD}
            style={{ marginTop: 10 }}
          />
        </View>

        <Button
          label={busy ? 'جارٍ الحذف…' : 'حذف حسابي نهائيًا'}
          onPress={onDelete}
          disabled={!canDelete}
          loading={busy}
          style={{
            marginTop: spacing.lg,
            backgroundColor: canDelete ? colors.terracotta : colors.border,
          }}
        />

        <Button
          label="تراجع"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: 10 }}
        />
      </View>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Txt size={13} weight="black" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
        {title}
      </Txt>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: radius.sm,
          backgroundColor: colors.chip,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        <Ionicons name={icon} size={14} color={colors.textMuted} />
      </View>
      <Txt size={13} color={colors.textSecondary} style={{ flex: 1, lineHeight: 21 }}>
        {text}
      </Txt>
    </View>
  );
}
