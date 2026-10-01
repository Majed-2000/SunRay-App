import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  ScreenContainer,
  Sheet,
  Spinner,
  TextField,
  Txt,
} from '@/components';
import { toast, useAuthStore } from '@/store';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { ksaDate } from '@/utils/ksaDate';
import {
  fetchMyVisits,
  fetchVisitDetail,
  rateVisit,
  type Visit,
  type VisitDetail,
  type VisitReview,
} from '@/services/storeLoyalty';

type DetailState = { ok: true; detail: VisitDetail } | { ok: false; reason: 'unavailable' | 'error' } | 'loading';

/**
 * «زياراتي» — purchases made at the branch till, matched to this phone.
 *
 * Each visit is a loyalty event the server recorded from a Foodics invoice. The
 * list is cheap; the invoice behind a visit (lines, modifiers, VAT, payment) is
 * fetched only when the customer opens it, and kept for the life of the screen
 * so opening and closing it again does not call the server again — the server
 * may have to ask Foodics for it.
 *
 * Rating a visit uses the same three keys as rating an online order, with the
 * questions reworded for someone who bought at the counter («ما مدى سهولة الطلب
 * من المتجر؟» makes no sense to them, and a customer who reads a question that
 * does not fit stops taking the whole form seriously).
 */
export function VisitsScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const signedIn = isAuthenticated && !isGuest;

  const [visits, setVisits] = useState<Visit[] | null | 'error'>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating] = useState<Visit | null>(null);
  const details = useRef<Record<string, DetailState>>({});
  const [, bump] = useState(0);

  const load = useCallback(async () => {
    const res = await fetchMyVisits();
    setVisits(res ?? 'error');
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openDetail = async (id: string) => {
    const cur = details.current[id];
    if (cur && cur !== 'loading' && (cur.ok || cur.reason === 'unavailable')) return;
    details.current[id] = 'loading';
    bump((n) => n + 1);
    details.current[id] = await fetchVisitDetail(id);
    bump((n) => n + 1);
  };

  const header = <Header showBack title="زياراتي" subtitle="مشترياتك من الفرع" />;

  if (!signedIn) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="receipt"
          title="سجّل دخولك لعرض زياراتك"
          subtitle="زياراتك للفرع مرتبطة برقم جوالك"
          actionLabel="تسجيل الدخول"
          onAction={() => {
            logout();
            router.replace('/(auth)/login');
          }}
        />
      </ScreenContainer>
    );
  }
  if (visits === null) {
    return (
      <ScreenContainer header={header}>
        <Spinner label="نجلب زياراتك…" />
      </ScreenContainer>
    );
  }
  if (visits === 'error') {
    return (
      <ScreenContainer header={header}>
        <ErrorState message="تعذّر تحميل زياراتك — حاول بعد قليل" onRetry={() => void load()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer header={header} scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['4xl'], gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.goldDeep}
            colors={[colors.goldDeep]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {visits.length ? (
          visits.map((v) => (
            <VisitCard
              key={v.id}
              visit={v}
              detail={details.current[v.id]}
              onOpen={() => void openDetail(v.id)}
              onRate={() => setRating(v)}
            />
          ))
        ) : (
          <EmptyState
            icon="store"
            title="لا زيارات مسجّلة بعد"
            subtitle="أدخل رقم جوالك عند الكاشير في زيارتك القادمة لتظهر هنا وتكسب نقاطها"
          />
        )}
      </ScrollView>

      <RateSheet
        visit={rating}
        onClose={() => setRating(null)}
        onSaved={(id, review) => {
          setVisits((list) =>
            Array.isArray(list) ? list.map((x) => (x.id === id ? { ...x, review } : x)) : list,
          );
          setRating(null);
          toast('شكراً لتقييمك');
        }}
      />
    </ScreenContainer>
  );
}

function VisitCard({
  visit: v,
  detail,
  onOpen,
  onRate,
}: {
  visit: Visit;
  detail: DetailState | undefined;
  onOpen: () => void;
  onRate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const title = v.branchName ? `زيارة فرع ${v.branchName}` : 'زيارة الفرع';
  const checkNumber = detail && detail !== 'loading' && detail.ok ? detail.detail.checkNumber : null;
  const invoice = checkNumber || v.code;

  return (
    <Card radiusKey="lg" padding={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Icon name="cup-hot" size={26} />
          <Txt size={15} weight="extraBold" color={colors.ink} style={{ flex: 1 }}>
            {title}
          </Txt>
          {v.totalHalalas != null ? (
            <Txt size={15} weight="black" color={colors.ink}>
              {formatRiyal(v.totalHalalas / 100)}
            </Txt>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
          {v.createdAt ? <Chip text={ksaDate(v.createdAt)} /> : null}
          {invoice ? <Chip text={`فاتورة ${invoice}`} /> : null}
          {v.points ? <Chip text={`+${toArabicDigits(v.points)} نقطة`} gold /> : null}
        </View>
      </View>

      {v.hasDetail ? (
        <>
          <Pressable
            onPress={() => {
              const next = !open;
              setOpen(next);
              if (next) onOpen();
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: colors.borderSoft,
            }}
          >
            <Txt size={13} weight="bold" color={colors.ink}>
              تفاصيل الطلب
            </Txt>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.goldDeep} />
          </Pressable>
          {open ? <VisitDetailView state={detail} onRetry={onOpen} /> : null}
        </>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSoft, padding: spacing.md }}>
        {v.review?.overall ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Ionicons name="star" size={14} color={colors.gold} />
            <Txt size={12} weight="bold" color={colors.textMuted}>
              {`تقييمك: ${toArabicDigits(v.review.overall)}/${toArabicDigits(5)} · شكراً لك`}
            </Txt>
          </View>
        ) : (
          <Button label="كيف كانت تجربتك؟ قيّمنا" variant="ghost" size="sm" onPress={onRate} />
        )}
      </View>
    </Card>
  );
}

function Chip({ text, gold }: { text: string; gold?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: gold ? colors.chipGold : colors.chip,
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 3,
      }}
    >
      <Txt size={11} weight="bold" color={colors.textSecondary}>
        {text}
      </Txt>
    </View>
  );
}

/** Riyals (Foodics' unit) → formatted. Rounded to halalas first, as the website does. */
const sar = (v: unknown) => formatRiyal(Math.round((Number(v) || 0) * 100) / 100);

function VisitDetailView({ state, onRetry }: { state: DetailState | undefined; onRetry: () => void }) {
  const pad = { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg };
  if (!state || state === 'loading') {
    return (
      <View style={pad}>
        <Spinner fill={false} />
      </View>
    );
  }
  if (!state.ok) {
    return (
      <View style={[pad, { alignItems: 'center', gap: spacing.sm }]}>
        <Txt size={12} color={colors.textMuted} center>
          {state.reason === 'error' ? 'تعذّر تحميل التفاصيل — حاول مرة ثانية' : 'التفاصيل غير متاحة لهذه الزيارة'}
        </Txt>
        {state.reason === 'error' ? <Button label="إعادة المحاولة" variant="outline" size="sm" fullWidth={false} onPress={onRetry} /> : null}
      </View>
    );
  }

  const s = state.detail;
  // Returned quantities are netted out; a fully returned line disappears.
  const lines = (s.lines ?? []).filter((l) => (Number(l.qty) || 0) - (Number(l.returned) || 0) > 0);
  const sub = (Number(s.subtotal) || 0) - (Number(s.taxExclDiscount) || 0);
  const vat = (Number(s.total) || 0) - (Number(s.rounding) || 0) - sub;
  const pays = (s.payments ?? []).map((p) => `${p.method || '—'} ${sar(p.amount)}`).join(' · ');

  return (
    <View style={[pad, { gap: 8 }]}>
      {s.number ? (
        <Txt size={11} color={colors.textFaint}>
          {`رقم الطلب ${s.number}`}
        </Txt>
      ) : null}
      {lines.map((l, i) => {
        const q = (Number(l.qty) || 0) - (Number(l.returned) || 0);
        const mods = (l.mods ?? []).map((m) => m.name).filter(Boolean).join(' · ');
        const lineTotal = l.total != null ? Number(l.total) : (Number(l.unit) || 0) * q;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Txt size={12} weight="black" color={colors.goldDeep} style={{ minWidth: 18 }}>
              {toArabicDigits(q)}
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt size={13} weight="bold" color={colors.ink}>
                {l.name ?? ''}
              </Txt>
              {mods ? (
                <Txt size={11} color={colors.textMuted}>
                  {mods}
                </Txt>
              ) : null}
            </View>
            <Txt size={12} weight="bold" color={colors.ink}>
              {sar(lineTotal)}
            </Txt>
          </View>
        );
      })}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8, gap: 4 }}>
        {Number(s.discount) > 0 ? <TotalRow k="الخصم" v={`− ${sar(s.discount)}`} /> : null}
        <TotalRow k="المجموع قبل الضريبة" v={sar(sub)} />
        <TotalRow k="ضريبة القيمة المضافة ١٥٪" v={sar(vat)} />
        {Number(s.rounding) ? <TotalRow k="التقريب" v={sar(s.rounding)} /> : null}
        <TotalRow k="الإجمالي" v={sar(s.total)} strong />
      </View>
      {pays ? (
        <Txt size={11} color={colors.textMuted}>
          {`الدفع: ${pays}`}
        </Txt>
      ) : null}
    </View>
  );
}

function TotalRow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt size={12} weight={strong ? 'black' : 'regular'} color={strong ? colors.ink : colors.textMuted}>
        {k}
      </Txt>
      <Txt size={12} weight={strong ? 'black' : 'bold'} color={colors.ink}>
        {v}
      </Txt>
    </View>
  );
}

/** Questions for a visit, keys shared with the online-order review. */
const QUESTIONS: { key: 'storeExp' | 'service' | 'overall'; text: string }[] = [
  { key: 'storeExp', text: 'كيف كانت أجواء الفرع وضيافتنا؟' },
  { key: 'service', text: 'كيف تُقيّم مشروبك وطلبك؟' },
  { key: 'overall', text: 'ما مدى رضاك العام عن زيارتك لنا؟' },
];

function RateSheet({
  visit,
  onClose,
  onSaved,
}: {
  visit: Visit | null;
  onClose: () => void;
  onSaved: (id: string, review: VisitReview) => void;
}) {
  const gender = useAuthStore((s) => s.user?.gender ?? null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visit) {
      setRatings({});
      setComment('');
    }
  }, [visit]);

  // A comment box appears only when something went wrong (a 1 or 2), as on the
  // website: asking everyone to write is how forms go unanswered.
  const anyLow = QUESTIONS.some((q) => ratings[q.key] > 0 && ratings[q.key] < 3);
  const complete = QUESTIONS.every((q) => ratings[q.key] > 0);

  const submit = async () => {
    if (!visit || !complete || saving) return;
    setSaving(true);
    const review: VisitReview = {
      storeExp: ratings.storeExp,
      service: ratings.service,
      overall: ratings.overall,
      comment: comment.trim() || null,
      gender,
      at: Date.now(),
    };
    try {
      if (await rateVisit(visit.id, review)) onSaved(visit.id, review);
      else toast('تعذّر حفظ التقييم — حاول مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={!!visit} onClose={onClose} title="قيّم زيارتك">
      <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
        {QUESTIONS.map((q) => (
          <View key={q.key} style={{ gap: spacing.sm }}>
            <Txt size={14} weight="bold" color={colors.ink}>
              {q.text}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRatings((r) => ({ ...r, [q.key]: n }))}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${toArabicDigits(n)} من ${toArabicDigits(5)}`}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={(ratings[q.key] ?? 0) >= n ? 'star' : 'star-outline'}
                    size={32}
                    color={(ratings[q.key] ?? 0) >= n ? colors.gold : colors.textFaint}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {anyLow ? (
          <TextField
            label="ممكن توضّح لنا ما الذي لم يكن على ما يُرام؟"
            value={comment}
            onChangeText={setComment}
            maxLength={600}
            multiline
            placeholder="اكتب لنا ملاحظتك..."
          />
        ) : null}
        <Button label="إرسال التقييم" loading={saving} disabled={!complete || saving} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}
