import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Button, Card, EmptyState, Header, ScreenContainer, Spinner, Txt } from '@/components';
import { toast, useAuthStore } from '@/store';
import { auth } from '@/services/firebase';
import { formatRiyal, toArabicDigits } from '@/utils/numerals';
import { listMyRequests, type MyRequest } from '@/services/myRequests';
import { subscribeCatering } from '@/services/storeCatering';
import {
  CATERING_STATUS_AR,
  daysUntil,
  paidHalalas,
  quote,
  remainderHalalas,
  type CateringRecord,
} from '@/services/requestRules';
import { CateringPayPanel } from './CateringPayPanel';
import { StatusPill, formatEventDate, formatTime12 } from './parts';

/**
 * «طلبات الكاترينق» — the requests this account made on this phone.
 *
 * Built from the keys `myRequests` remembered, each read on its own
 * (`sunray/catering/<key>`), never by listing the node. A request made on the
 * website is not here; the web account page lists those through `myOrders`.
 *
 * The pay button follows the account page: an unpaid request can pay its
 * deposit or the full amount, a part-paid one pays the remainder
 * (`createCateringPayment` mode `remainder`).
 */
export function CateringRequestsScreen() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const [items, setItems] = useState<MyRequest[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void listMyRequests('catering', auth().currentUser?.uid ?? null).then((r) => live && setItems(r));
      return () => {
        live = false;
      };
    }, []),
  );

  const header = <Header showBack title="طلبات الكاترينق" />;

  if (isGuest) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="people"
          title="سجّل دخولك"
          subtitle="طلبات الكاترينق مرتبطة برقم جوالك"
          actionLabel="تسجيل الدخول"
          onAction={() => router.push('/(auth)/login')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer header={header}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md }}>
        {items == null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState
            icon="people"
            title="لا توجد طلبات كاترينق"
            subtitle="الطلبات التي ترسلها من التطبيق تظهر هنا"
            actionLabel="احجز كاترينق"
            onAction={() => router.push('/catering')}
          />
        ) : (
          items.map((it) => <CateringRequestCard key={it.key} item={it} />)
        )}
      </View>
    </ScreenContainer>
  );
}

function CateringRequestCard({ item }: { item: MyRequest }) {
  const [rec, setRec] = useState<CateringRecord | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [paying, setPaying] = useState(false);
  useEffect(() => subscribeCatering(item.key, setRec, () => setFailed(true)), [item.key]);

  if (rec === undefined) {
    return (
      <Card radiusKey="lg">
        <Txt size={14} weight="black" latin color={colors.ink}>
          {item.code}
        </Txt>
        <Txt size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
          {failed ? 'تعذّر تحميل الطلب' : 'جارٍ التحميل…'}
        </Txt>
      </Card>
    );
  }
  if (rec === null) {
    return (
      <Card radiusKey="lg">
        <Txt size={14} weight="black" latin color={colors.ink}>
          {item.code}
        </Txt>
        <Txt size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
          لم يعد هذا الطلب موجودًا
        </Txt>
      </Card>
    );
  }

  const status = rec.status ?? 'new';
  const cancelled = status === 'cancelled';
  const paid = paidHalalas(rec);
  const remain = remainderHalalas(rec);
  const paidFull = paid > 0 && remain <= 0;
  const ev = rec.eventDetails ?? {};
  const left = ev.date ? daysUntil(ev.date) : null;
  const total = Number(rec.finance?.total) || 0;

  const tone = cancelled ? 'muted' : paidFull || status === 'confirmed' || status === 'delivered' || status === 'closed' ? 'ok' : 'warn';
  const label = paidFull && !cancelled && status !== 'delivered' && status !== 'closed' ? 'مؤكد ومدفوع' : CATERING_STATUS_AR[status] ?? status;

  // Steps the account page shows: under review → confirmed → delivered.
  const at = cancelled ? -1 : status === 'delivered' || status === 'closed' ? 2 : status === 'confirmed' ? 1 : 0;

  return (
    <Card radiusKey="lg">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="black" latin color={colors.ink}>
            {rec.code ?? item.code}
          </Txt>
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 2 }}>
            {[ev.occasion, formatEventDate(ev.date), formatTime12(ev.time)].filter(Boolean).join(' · ')}
          </Txt>
          {left != null && !cancelled && left >= 0 ? (
            <Txt size={12} weight="extraBold" color={colors.ink} style={{ marginTop: 2 }}>
              {left === 0 ? 'اليوم' : `بعد ${toArabicDigits(left)} يوم`}
            </Txt>
          ) : null}
        </View>
        <StatusPill label={label} tone={tone} />
      </View>

      {!cancelled ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
          {['قيد المراجعة', 'مؤكّد', 'تم التسليم'].map((s, i) => (
            <View key={s} style={{ flex: 1 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= at ? colors.gold : colors.border }} />
              <Txt size={11} color={i <= at ? colors.ink : colors.textFaint} style={{ marginTop: 4 }}>
                {s}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md, gap: 2 }}>
        {total > 0 ? (
          <Txt size={12} color={colors.textMuted}>
            الإجمالي {formatRiyal(total)} + التأمين {formatRiyal(Number(rec.finance?.insurance ?? 300))}
          </Txt>
        ) : null}
        {paid > 0 ? (
          <Txt size={12} color={colors.textMuted}>
            المدفوع {formatRiyal(paid / 100)}
            {remain > 0 ? ` · المتبقّي ${formatRiyal(remain / 100)}` : ''}
          </Txt>
        ) : null}
      </View>

      {!cancelled && remain > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          {paying ? (
            <CateringPayPanel
              cateringKey={item.key}
              code={rec.code ?? item.code}
              paidBefore={paid}
              options={
                paid > 0
                  ? [{ mode: 'remainder', label: 'إكمال الدفع', estimateSar: remain / 100, primary: true }]
                  : [
                      { mode: 'deposit', label: 'دفع العربون + التأمين', estimateSar: total ? quote(total).depositDue : undefined, primary: true },
                      { mode: 'full', label: 'دفع كامل المبلغ', estimateSar: total ? quote(total).fullDue : undefined },
                    ]
              }
              onSettled={(o) => {
                setPaying(false);
                toast(o === 'timeout' ? 'نؤكّد دفعتك — تتحدّث حالة الطلب بعد قليل' : 'تم استلام دفعتك');
              }}
            />
          ) : (
            <Button
              label={paid > 0 ? 'إكمال الدفع' : 'إكمال الدفع لتثبيت الحجز'}
              trailing={paid > 0 ? formatRiyal(remain / 100) : undefined}
              size="sm"
              onPress={() => setPaying(true)}
            />
          )}
        </View>
      ) : paidFull && !cancelled ? (
        <Txt size={12} weight="bold" color={colors.success} style={{ marginTop: spacing.md }}>
          مدفوع بالكامل
        </Txt>
      ) : null}
    </Card>
  );
}
