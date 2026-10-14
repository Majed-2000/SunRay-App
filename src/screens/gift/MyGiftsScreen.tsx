import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  ScreenContainer,
  SegmentedTabs,
  Spinner,
  Txt,
} from '@/components';
import { formatDateAr } from '@/utils/date';
import { useAuthStore } from '@/store';
import {
  boughtGiftStatusLabel,
  fetchBoughtGifts,
  fetchMyGifts,
  giftIdFromLink,
  giftShareMessage,
  myGiftStateLabel,
  myGiftUrl,
  type BoughtGift,
  type MyGift,
  type MyGifts,
} from '@/services/storeGifts';

type Tab = 'sent' | 'received';

/**
 * «هداياي» — what the customer gave and what they were given.
 *
 * Two server lists, because the server keeps two kinds of gift:
 * - gift cards bought from a package, which `myOrders` lists as `gift` rows
 *   keyed by gift id — the id the share link is built from;
 * - everything `myGifts` returns: gifted orders sent and received, gifts from
 *   Sun Ray, and gift cards addressed to this customer.
 *
 * The recipient side opens on sunray.sa (that is where cups are chosen and the
 * gift is claimed), so a received gift's button opens the site rather than an
 * app screen that would have to re-implement it.
 */
export function MyGiftsScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signedIn = isAuthenticated && !isGuest;

  const [tab, setTab] = useState<Tab>('sent');
  const [bought, setBought] = useState<BoughtGift[] | null>(null);
  const [gifts, setGifts] = useState<MyGifts | null>(null);
  const [failed, setFailed] = useState(false);
  // One list failing is not an empty list: the fallback `[]` below used to be
  // indistinguishable from «لم ترسل هدايا بعد».
  const [partial, setPartial] = useState({ bought: false, gifts: false });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    // Independent calls: one failing must not blank the other. The account
    // page on the site makes the same choice for orders and visits.
    const [b, g] = await Promise.allSettled([fetchBoughtGifts(), fetchMyGifts()]);
    if (b.status === 'fulfilled') setBought(b.value);
    if (g.status === 'fulfilled') setGifts(g.value);
    setPartial({ bought: b.status === 'rejected', gifts: g.status === 'rejected' });
    if (b.status === 'rejected' && g.status === 'rejected') setFailed(true);
    else {
      if (b.status === 'rejected') setBought((x) => x ?? []);
      if (g.status === 'rejected') setGifts((x) => x ?? { received: [], sent: [], fromSunray: [], cards: [] });
    }
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [load, signedIn]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const header = <Header showBack title="هداياي" />;

  if (!signedIn) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="gift"
          title="سجّل الدخول لعرض هداياك"
          actionLabel="تسجيل الدخول"
          onAction={() => router.push('/(auth)/login')}
        />
      </ScreenContainer>
    );
  }

  if (failed && !bought && !gifts) {
    return (
      <ScreenContainer header={header}>
        <ErrorState message="تعذّر تحميل الهدايا — حاول بعد قليل" onRetry={() => void load()} />
      </ScreenContainer>
    );
  }

  if (!bought || !gifts) {
    return (
      <ScreenContainer header={header}>
        <Spinner label="جارٍ تحميل هداياك…" />
      </ScreenContainer>
    );
  }

  const received = [...gifts.received, ...gifts.fromSunray, ...gifts.cards];
  // A bought card may also be listed by `myGifts` — show it once, from the
  // order feed, where its id and status are certain.
  const boughtIds = new Set(bought.map((b) => b.id));
  const sentOther = gifts.sent.filter((g) => {
    const gid = giftIdFromLink(g.link);
    return !gid || !boughtIds.has(gid);
  });
  const sentCount = bought.length + sentOther.length;
  const tabFailed = tab === 'sent' ? partial.bought || partial.gifts : partial.gifts;
  const retry = (
    <ErrorState message="تعذّر تحميل الهدايا — حاول بعد قليل" onRetry={() => void load()} />
  );
  const retryBanner = (
    <Card radiusKey="lg">
      <Txt size={13} weight="bold" color={colors.danger}>
        تعذّر تحميل بعض الهدايا، قد تكون القائمة ناقصة
      </Txt>
      <Button label="إعادة المحاولة" variant="outline" size="sm" onPress={() => void load()} style={{ marginTop: spacing.sm }} />
    </Card>
  );

  return (
    <ScreenContainer
      scroll={false}
      padded={false}
      header={<View style={{ paddingHorizontal: spacing['2xl'] }}>{header}</View>}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SegmentedTabs<Tab>
          tabs={[
            { key: 'sent', label: 'أرسلتها', count: sentCount },
            { key: 'received', label: 'وصلتني', count: received.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldDeep} />}
      >
        {tabFailed && (tab === 'sent' ? sentCount === 0 : received.length === 0) ? retry : null}
        {tabFailed && (tab === 'sent' ? sentCount > 0 : received.length > 0) ? retryBanner : null}
        {tabFailed && (tab === 'sent' ? sentCount === 0 : received.length === 0) ? null : tab === 'sent' ? (
          sentCount === 0 ? (
            <EmptyState
              icon="gift"
              title="لم ترسل هدايا بعد"
              subtitle="أهدِ باقة لمن تحب وشاركه الرابط."
              actionLabel="باقات الإهداء"
              onAction={() => router.push('/gift')}
            />
          ) : (
            <>
              {bought.map((g) => (
                <BoughtRow key={g.id} gift={g} />
              ))}
              {sentOther.map((g, i) => (
                <MyGiftRow key={`s${i}`} gift={g} side="sent" />
              ))}
            </>
          )
        ) : received.length === 0 ? (
          <EmptyState icon="gift" title="لا هدايا بعد" subtitle="ما يصلك من هدايا يظهر هنا." />
        ) : (
          received.map((g, i) => <MyGiftRow key={`r${i}`} gift={g} side="received" />)
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const share = (giftId: string) => {
  Share.share({ message: giftShareMessage(giftId), title: 'بطاقة إهداء' }).catch(() => {});
};

/** A gift card this customer bought from a package. */
function BoughtRow({ gift }: { gift: BoughtGift }) {
  const live = gift.status === 'active';
  const unpaid = !gift.status || !['active', 'used', 'cancelled'].includes(gift.status);
  return (
    <Card radiusKey="lg">
      <RowHead
        title={gift.recipientName ? `إلى ${gift.recipientName}` : 'بطاقة إهداء'}
        state={boughtGiftStatusLabel(gift.status)}
        tone={live ? 'ok' : unpaid ? 'warn' : 'muted'}
      />
      <Meta code={gift.code} at={gift.createdAt} />
      {live ? (
        <Button label="مشاركة الرابط" variant="gold" size="sm" onPress={() => share(gift.id)} style={{ marginTop: spacing.md }} />
      ) : unpaid ? (
        <Button label="أكمل الدفع" variant="outline" size="sm" onPress={() => router.push(`/gift/${gift.id}`)} style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}

/** One row of `myGifts`. */
function MyGiftRow({ gift, side }: { gift: MyGift; side: 'sent' | 'received' }) {
  const who = gift.who ? (side === 'sent' ? `إلى ${gift.who}` : `من ${gift.who}`) : side === 'sent' ? 'هديّة' : 'هديّة لك';
  const items = (gift.items ?? []).slice(0, 4).join(' · ');
  const url = myGiftUrl(gift);
  const giftId = giftIdFromLink(gift.link);
  const waiting = gift.state !== 'claimed' && gift.state !== 'ended' && gift.state !== 'unpaid';
  return (
    <Card radiusKey="lg">
      <RowHead title={who} state={myGiftStateLabel(gift.state, side)} tone={gift.state === 'claimed' ? 'muted' : waiting ? 'ok' : 'warn'} />
      {gift.message ? (
        <Txt size={13} color={colors.textMuted} style={{ marginTop: 6, lineHeight: 20 }}>
          «{gift.message}»
        </Txt>
      ) : null}
      {items ? (
        <Txt size={13} color={colors.ink} style={{ marginTop: 6 }}>
          {items}
        </Txt>
      ) : null}
      {gift.endedReason ? (
        <Txt size={12} color={colors.textMuted} style={{ marginTop: 6 }}>
          السبب: {gift.endedReason}
        </Txt>
      ) : null}
      <Meta code={gift.code ?? null} />
      {side === 'sent' && waiting && giftId ? (
        <Button label="مشاركة الرابط" variant="gold" size="sm" onPress={() => share(giftId)} style={{ marginTop: spacing.md }} />
      ) : side === 'received' && waiting && url ? (
        // Opened and claimed on the site — that is where the recipient picks
        // their cups and chooses pickup or car.
        <Button
          label={gift.token ? 'افتح هديّتك' : 'عرض البطاقة'}
          variant={gift.token ? 'gold' : 'outline'}
          size="sm"
          onPress={() => void Linking.openURL(url)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </Card>
  );
}

function RowHead({ title, state, tone }: { title: string; state: string; tone: 'ok' | 'warn' | 'muted' }) {
  const fg = tone === 'ok' ? colors.success : tone === 'warn' ? colors.goldDeep : colors.textMuted;
  const bgc = tone === 'ok' ? colors.successSoft : tone === 'warn' ? colors.chipGold : colors.chip;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }} numberOfLines={2}>
        {title}
      </Txt>
      <View style={{ backgroundColor: bgc, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Txt size={11} weight="extraBold" color={fg}>
          {state}
        </Txt>
      </View>
    </View>
  );
}

function Meta({ code, at }: { code: string | null; at?: number }) {
  if (!code && !at) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' }}>
      {at ? (
        <Txt size={12} color={colors.textFaint}>
          {formatDateAr(at)}
        </Txt>
      ) : null}
      {code ? (
        <Txt size={12} latin color={colors.textFaint} style={{ writingDirection: 'ltr' }}>
          {code}
        </Txt>
      ) : null}
    </View>
  );
}
