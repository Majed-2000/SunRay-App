import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Button, Card, EmptyState, Header, ScreenContainer, Spinner, TextField, Txt } from '@/components';
import { toast } from '@/store';
import { auth } from '@/services/firebase';
import { listMyRequests, type MyRequest } from '@/services/myRequests';
import { lookupTicketByCode, subscribeTicket } from '@/services/storeTickets';
import { TICKET_STATUS_AR, normalizeTicketCode, type TicketRecord } from '@/services/requestRules';
import { formatDateAr } from '@/utils/date';
import { StatusPill } from './parts';
import { ticketTone } from './TicketScreen';

/**
 * «تذاكري» — tickets opened from this phone, plus lookup of an older one by
 * its `TK-####` code.
 *
 * The list is the keys remembered on the device, each read on its own. The
 * lookup goes through `sunray/shortIndex/ticket/<code>` — one key — instead of
 * the site's `orderByChild("code")` query over everyone's tickets, which only
 * works while that node is world-readable.
 */
export function TicketsScreen() {
  const [items, setItems] = useState<MyRequest[] | null>(null);
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);

  const reload = useCallback(() => {
    let live = true;
    void listMyRequests('ticket', auth().currentUser?.uid ?? null).then((r) => live && setItems(r));
    return () => {
      live = false;
    };
  }, []);
  useFocusEffect(reload);

  const lookup = async () => {
    if (looking) return;
    const normalized = normalizeTicketCode(code);
    if (!normalized) return toast('اكتب رقم التذكرة، مثل TK-1234');
    setLooking(true);
    try {
      const found = await lookupTicketByCode(normalized);
      if (!found) {
        toast('لم يتم العثور على التذكرة');
        return;
      }
      setCode('');
      reload();
      router.push({ pathname: '/ticket/[key]', params: { key: found.key } });
    } catch {
      toast('تعذّر البحث، تحقّق من اتصالك');
    } finally {
      setLooking(false);
    }
  };

  return (
    <ScreenContainer header={<Header showBack title="تذاكري" />} scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Button label="افتح تذكرة جديدة" onPress={() => router.push('/ticket/new')} />

        <Card radiusKey="lg" style={{ marginTop: spacing.lg }}>
          <Txt size={14} weight="black" color={colors.ink}>
            تذكرة سابقة؟
          </Txt>
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 2, marginBottom: spacing.sm }}>
            اكتب رقمها لمتابعتها من هنا
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextField
              value={code}
              onChangeText={setCode}
              placeholder="TK-1234"
              ltr
              autoCapitalize="characters"
              maxLength={10}
              containerStyle={{ flex: 1 }}
              onSubmitEditing={() => void lookup()}
            />
            <Button label="بحث" size="sm" fullWidth={false} loading={looking} onPress={() => void lookup()} />
          </View>
        </Card>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {items == null ? (
            <Spinner fill={false} />
          ) : items.length === 0 ? (
            <EmptyState icon="ticket" title="لا توجد تذاكر" subtitle="التذاكر التي ترفعها تظهر هنا مع ردود فريقنا" />
          ) : (
            items.map((it) => <TicketRow key={it.key} item={it} />)
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

function TicketRow({ item }: { item: MyRequest }) {
  const [t, setT] = useState<TicketRecord | null | undefined>(undefined);
  useEffect(() => subscribeTicket(item.key, setT, () => setT(undefined)), [item.key]);
  if (t === null) return null; // deleted by staff; `subscribeTicket` forgets it
  const status = t?.status ?? 'new';
  return (
    <Card radiusKey="lg" onPress={() => router.push({ pathname: '/ticket/[key]', params: { key: item.key } })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="black" latin color={colors.ink}>
            {t?.code ?? item.code}
          </Txt>
          <Txt size={12} color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>
            {t ? [t.title, t.createdAt ? formatDateAr(t.createdAt) : ''].filter(Boolean).join(' · ') : 'جارٍ التحميل…'}
          </Txt>
        </View>
        {t ? <StatusPill label={TICKET_STATUS_AR[status] ?? status} tone={ticketTone(status)} /> : null}
      </View>
      {t?.adminReply ? (
        <Txt size={12} weight="bold" color={colors.success} style={{ marginTop: spacing.sm }}>
          وصلك رد من فريقنا
        </Txt>
      ) : null}
    </Card>
  );
}
