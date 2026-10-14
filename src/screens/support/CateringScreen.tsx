import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Header,
  Icon,
  OptionChip,
  PhoneField,
  PriceRow,
  ScreenContainer,
  Spinner,
  TextField,
  Txt,
} from '@/components';
import { toast, useAuthStore } from '@/store';
import { hasRealName } from '@/store/authStore';
import { formatRiyal, toArabicDigits, toWesternDigits } from '@/utils/numerals';
import { isValidSaudiMobile } from '@/utils/validators';
import {
  CATERING_DRINKS,
  CATERING_PACKS,
  MORE_CUPS_MAX,
  MORE_CUPS_MIN,
  PACK_MORE,
  bookableDates,
  daysUntil,
  isUrgent,
  packTotal,
  quote,
  type CateringPack,
} from '@/services/requestRules';
import {
  createCateringRequest,
  isDateBlocked,
  subscribeCateringSystem,
  type CateringSystem,
  type CreatedCatering,
} from '@/services/storeCatering';
import { CateringPayPanel } from './CateringPayPanel';
import { DateChips, FormSection, TimeChips, formatEventDate, formatTime12 } from './parts';

/** Published on the sunray.sa footer and used by the catering page itself. */
const WHATSAPP = '966549177174';

/**
 * The site's WhatsApp bot recognises a catering customer by the phrase
 * «من صفحة الكاترينق» in the first message and starts collecting event
 * details instead of a generic greeting — so the phrase stays verbatim.
 */
function whatsappUrl(details: string[]): string {
  const lines = ['مرحباً سن راي', 'أتواصل معكم من صفحة الكاترينق في التطبيق، وأرغب بالاستفسار عن حجز ركن قهوة لمناسبة.'];
  if (details.length) lines.push('', ...details);
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/** Start the hour list at 6 am: events are daytime and evening. */
const HOURS = [...Array.from({ length: 18 }, (_, i) => i + 6), ...Array.from({ length: 6 }, (_, i) => i)];

type Stage =
  | { step: 'form' }
  | { step: 'pay'; created: CreatedCatering; total: number }
  | { step: 'done'; created: CreatedCatering; outcome: 'paid' | 'timeout' | 'free' };

/**
 * «حجز كاترينق» — a mobile coffee corner for an event, as on sunray.sa/catering.
 *
 * The request is written in the website's exact record shape (see
 * `storeCatering.ts`) and then paid by card: deposit + insurance, or the full
 * amount. Card is the only method in the app, which also satisfies the site's
 * rule that events three days away or less must be paid electronically.
 *
 * The site refuses a date once two bookings exist on it by reading every
 * customer's booking. The app cannot and should not; it offers only dates the
 * dashboard has not closed and says plainly that the team confirms each one.
 */
export function CateringScreen() {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const signedIn = !!user && !isGuest;

  const [system, setSystem] = useState<CateringSystem | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(
    () =>
      subscribeCateringSystem(
        (s) => {
          setSystem(s);
          setLoadError(false);
        },
        () => setLoadError(true),
      ),
    [],
  );

  const [stage, setStage] = useState<Stage>({ step: 'form' });

  const [name, setName] = useState(() => (hasRealName(user) ? user!.name : ''));
  const [phone, setPhone] = useState(() => user?.phone ?? '');
  const [occasion, setOccasion] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locDesc, setLocDesc] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pack, setPack] = useState<CateringPack | null>(null);
  const [moreCupsText, setMoreCupsText] = useState('');
  const [drink1, setDrink1] = useState('');
  const [drink2, setDrink2] = useState('');
  const [notes, setNotes] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dates = useMemo(() => bookableDates(system?.blockedDates), [system?.blockedDates]);
  // A date the dashboard closes while the form is open is dropped at once.
  useEffect(() => {
    if (date && !dates.includes(date)) setDate('');
  }, [dates, date]);

  const moreCups = parseInt(toWesternDigits(moreCupsText), 10) || 0;
  const total = packTotal(pack, moreCups);
  const q = total != null ? quote(total) : null;

  const attachLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast('لم يُسمح بالوصول للموقع — اكتب وصف المكان بدلًا من ذلك');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      toast('تعذّر تحديد موقعك، اكتب وصف المكان');
    } finally {
      setLocating(false);
    }
  };

  /** First problem with the form, in the order the fields appear; null when complete. */
  const problem = (): string | null => {
    if (!name.trim()) return 'اكتب الاسم الكامل';
    if (!isValidSaudiMobile(phone)) return 'أدخل رقم جوال سعودي صحيح';
    if (!occasion.trim()) return 'اكتب نوع المناسبة';
    if (!date) return 'اختر تاريخ المناسبة';
    const d = daysUntil(date);
    if (d < 1 || d > 30) return 'اختر تاريخًا من الغد وحتى ٣٠ يومًا';
    if (!time) return 'اختر وقت بدء الخدمة';
    if (!coords && !locDesc.trim()) return 'حدّد موقعك أو اكتب وصف مكان المناسبة';
    if (!pack) return 'اختر الباقة';
    if (pack === PACK_MORE && (moreCups < MORE_CUPS_MIN || moreCups > MORE_CUPS_MAX))
      return `اكتب عدد الأكواب من ${toArabicDigits(MORE_CUPS_MIN)} إلى ${toArabicDigits(MORE_CUPS_MAX)}`;
    if (!drink1 || !drink2) return 'اختر المشروبين';
    if (!agreed) return 'وافق على الشروط والأحكام أولًا';
    return null;
  };

  const submit = async () => {
    if (submitting) return;
    const p = problem();
    if (p) {
      if (!agreed && p.startsWith('وافق')) setShowTerms(true);
      toast(p);
      return;
    }
    setSubmitting(true);
    try {
      // The dashboard may have closed this date since the form opened.
      if (await isDateBlocked(date)) {
        setDate('');
        toast('هذا التاريخ مغلق للحجز، اختر تاريخًا آخر');
        return;
      }
      const created = await createCateringRequest({
        name,
        phone: `0${phone}`,
        occasion,
        date,
        time,
        location: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, desc: locDesc },
        pack: pack as CateringPack,
        moreCups,
        drinks: [drink1, drink2],
        notes,
      });
      setStage({ step: 'pay', created, total: total as number });
    } catch {
      toast('تعذّر إرسال الطلب، تحقّق من اتصالك وحاول مجددًا');
    } finally {
      setSubmitting(false);
    }
  };

  const header = <Header showBack title="حجز كاترينق" />;

  if (!signedIn) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="people"
          title="سجّل دخولك لحجز الكاترينق"
          subtitle="نربط الحجز برقم جوالك لتتابعه وتدفع المتبقي لاحقًا"
          actionLabel="تسجيل الدخول"
          onAction={() => router.push('/(auth)/login')}
        />
      </ScreenContainer>
    );
  }

  if (!system) {
    return (
      <ScreenContainer header={header}>
        {loadError ? (
          <EmptyState icon="offline" title="تعذّر التحميل" subtitle="تحقّق من اتصالك بالإنترنت" />
        ) : (
          <Spinner />
        )}
      </ScreenContainer>
    );
  }

  // ---- after submit: pay, then done ----
  if (stage.step === 'pay' || stage.step === 'done') {
    const { created } = stage;
    return (
      <ScreenContainer header={header}>
        <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
          {stage.step === 'pay' ? (
            <>
              <Card radiusKey="xl" backgroundColor={colors.ink} style={{ marginBottom: spacing.xl }}>
                <Txt size={18} weight="black" color={colors.white}>
                  تم استلام طلبك
                </Txt>
                <Txt size={13} color={colors.textOnDarkMuted} style={{ marginTop: 6, lineHeight: 21 }}>
                  أكمل الدفع لتثبيت الحجز. بعد الدفع يراجع فريقنا التوفّر في {formatEventDate(date)} ويؤكّد معك.
                </Txt>
                {isUrgent(date) ? (
                  <Txt size={12} weight="bold" color={colors.goldText} style={{ marginTop: spacing.sm }}>
                    مناسبتك خلال ٣ أيام أو أقل — الدفع الإلكتروني مطلوب الآن.
                  </Txt>
                ) : null}
              </Card>
              <CateringPayPanel
                cateringKey={created.key}
                code={created.code}
                paidBefore={0}
                options={[
                  { mode: 'deposit', label: 'دفع العربون + التأمين', estimateSar: quote(stage.total).depositDue, primary: true },
                  { mode: 'full', label: 'دفع كامل المبلغ', estimateSar: quote(stage.total).fullDue },
                ]}
                onSettled={(outcome) => setStage({ step: 'done', created, outcome })}
              />
              <Txt size={12} color={colors.textMuted} center style={{ marginTop: spacing.lg, lineHeight: 19 }}>
                يمكنك إكمال الدفع لاحقًا من «طلبات الكاترينق».
              </Txt>
            </>
          ) : (
            <Card radiusKey="xl" style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
              <Icon name={stage.outcome === 'timeout' ? 'hourglass' : 'check'} size={44} />
              <Txt size={18} weight="black" color={colors.ink} center style={{ marginTop: spacing.md }}>
                {stage.outcome === 'timeout' ? 'نؤكّد دفعتك' : 'تم استلام دفعتك'}
              </Txt>
              <Txt size={13} color={colors.textMuted} center style={{ marginTop: 6, lineHeight: 21 }}>
                {stage.outcome === 'timeout'
                  ? 'قد يستغرق التأكيد دقائق. تابع حالة الحجز من «طلبات الكاترينق».'
                  : 'سيتواصل معك فريقنا لتأكيد تفاصيل المناسبة.'}
              </Txt>
              {stage.outcome !== 'timeout' ? (
                <Txt size={22} weight="black" latin color={colors.ink} style={{ marginTop: spacing.lg }}>
                  {created.code}
                </Txt>
              ) : null}
            </Card>
          )}
          <Button
            label="طلبات الكاترينق"
            variant="outline"
            onPress={() => router.replace('/catering/mine')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </ScreenContainer>
    );
  }

  // ---- closed ----
  if (!system.open) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="store"
          title="عذرًا، الخدمة مغلقة مؤقتًا"
          subtitle="تم إيقاف استقبال طلبات الكاترينق حاليًا. يرجى المحاولة لاحقًا، ونتشرف بخدمتك دائمًا."
          actionLabel="راسلنا على واتساب"
          onAction={() => Linking.openURL(whatsappUrl([])).catch(() => toast('تعذّر فتح الرابط'))}
        />
      </ScreenContainer>
    );
  }

  // ---- form ----
  const waDetails = [
    occasion.trim() ? `المناسبة: ${occasion.trim()}` : '',
    date ? `التاريخ: ${date}` : '',
    time ? `وقت البدء: ${time}` : '',
  ].filter(Boolean);

  return (
    <ScreenContainer header={header} scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Card radiusKey="xl" backgroundColor={colors.ink} style={{ marginBottom: spacing.lg }}>
          <Txt size={20} weight="black" color={colors.white}>
            كاترينق سن راي
          </Txt>
          <Txt size={13} color={colors.textOnDarkMuted} style={{ marginTop: 6, lineHeight: 21 }}>
            كورنر قهوة متنقّل لفعاليتك: التحضير في المكان، مشروبان من اختيارك، أكواب بعدد الطلب، ثلج للتقديم، والتركيب
            والتجهيز.
          </Txt>
        </Card>

        <Pressable
          onPress={() => Linking.openURL(whatsappUrl(waDetails)).catch(() => toast('تعذّر فتح الرابط'))}
          accessibilityRole="link"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.card,
            borderRadius: radius.md,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Ionicons name="logo-whatsapp" size={26} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="extraBold" color={colors.ink}>
              عندك سؤال قبل الحجز؟ راسلنا على واتساب
            </Txt>
            <Txt size={12} color={colors.textMuted} style={{ marginTop: 2 }}>
              نساعدك في اختيار الباقة والتاريخ والمشروبات
            </Txt>
          </View>
          <Ionicons name="chevron-back" size={18} color={colors.textFaint} />
        </Pressable>

        <FormSection title="بياناتك">
          <TextField label="الاسم الكامل" value={name} onChangeText={setName} maxLength={80} placeholder="مثال: محمد أحمد" />
          <View style={{ height: spacing.md }} />
          <PhoneField value={phone} onChangeText={setPhone} />
        </FormSection>

        <FormSection title="المناسبة">
          <TextField value={occasion} onChangeText={setOccasion} maxLength={80} placeholder="تخرّج / افتتاح / مناسبة خاصة" />
        </FormSection>

        <FormSection
          title="تاريخ المناسبة"
          hint="من الغد وحتى ٣٠ يومًا. يؤكّد فريقنا التوفّر بعد استلام طلبك."
        >
          {dates.length ? (
            <DateChips dates={dates} value={date} onChange={setDate} />
          ) : (
            <Txt size={13} color={colors.danger}>
              لا توجد تواريخ متاحة حاليًا — راسلنا على واتساب
            </Txt>
          )}
        </FormSection>

        <FormSection title="وقت بدء الخدمة" hint={time ? formatTime12(time) : undefined}>
          <TimeChips value={time} onChange={setTime} hours={HOURS} />
        </FormSection>

        <FormSection title="مكان المناسبة" hint="اكتب وصف المكان، ويمكنك إرفاق موقعك الحالي إن كنت فيه.">
          <TextField
            value={locDesc}
            onChangeText={setLocDesc}
            maxLength={160}
            placeholder="الحي، اسم القاعة أو الاستراحة، رقم المبنى"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm }}>
            <Button
              label={coords ? 'تم إرفاق موقعك' : 'استخدم موقعي الحالي'}
              variant="outline"
              size="sm"
              fullWidth={false}
              loading={locating}
              iconLeft={<Icon name="pin" size={18} />}
              onPress={() => void attachLocation()}
            />
            {coords ? (
              <Txt size={12} color={colors.textMuted} onPress={() => setCoords(null)}>
                إزالة
              </Txt>
            ) : null}
          </View>
        </FormSection>

        <FormSection title="الباقة" hint="عدد الأكواب وسعر الخدمة.">
          <View style={{ gap: 8 }}>
            {CATERING_PACKS.map((p) => (
              <OptionChip
                key={p.value}
                label={`${toArabicDigits(p.cups)} كوب`}
                sublabel={formatRiyal(p.priceSar)}
                selected={pack === p.value}
                variant="gold"
                onPress={() => setPack(p.value)}
              />
            ))}
            <OptionChip
              label="أكثر من ٢٠٠ كوب"
              sublabel={`${formatRiyal(15)} لكل كوب إضافي`}
              selected={pack === PACK_MORE}
              variant="gold"
              onPress={() => setPack(PACK_MORE)}
            />
          </View>
          {pack === PACK_MORE ? (
            <TextField
              value={moreCupsText}
              onChangeText={(t) => setMoreCupsText(toWesternDigits(t).replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="عدد الأكواب (أكثر من ٢٠٠)"
              containerStyle={{ marginTop: spacing.sm }}
            />
          ) : null}
        </FormSection>

        <FormSection title="المشروبات" hint="اختر مشروبين فقط.">
          <Txt size={12} weight="bold" color={colors.textMuted} style={{ marginBottom: 6 }}>
            المشروب الأول
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CATERING_DRINKS.map((d) => (
              <OptionChip key={d} block label={d} selected={drink1 === d} onPress={() => setDrink1(d)} />
            ))}
          </View>
          <Txt size={12} weight="bold" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: 6 }}>
            المشروب الثاني
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CATERING_DRINKS.map((d) => (
              <OptionChip key={d} block label={d} selected={drink2 === d} onPress={() => setDrink2(d)} />
            ))}
          </View>
        </FormSection>

        <FormSection title="ملاحظات (اختياري)">
          <TextField
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
            multiline
            placeholder="أي تفاصيل إضافية..."
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
        </FormSection>

        {/* summary — the site's calcPrice(), display only: the charge comes from the server */}
        <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
          <PriceRow label="الإجمالي" amount={q ? formatRiyal(q.total) : '—'} />
          <PriceRow label="العربون (٧٠٪) — غير مسترد" amount={q ? formatRiyal(q.deposit) : '—'} />
          <PriceRow label="التأمين — مسترد" amount={formatRiyal(300)} />
          <Divider dashed />
          <PriceRow label="العربون + التأمين" amount={q ? formatRiyal(q.depositDue) : '—'} />
          <PriceRow label="المتبقّي عند التسليم" amount={q ? formatRiyal(q.remain) : '—'} muted />
          <PriceRow label="أو كامل المبلغ الآن" amount={q ? formatRiyal(q.fullDue) : '—'} emphasize />
          <Txt size={11} color={colors.textFaint} style={{ marginTop: spacing.sm, lineHeight: 17 }}>
            رسوم التوصيل يحددها المندوب حسب موقعك وتُحصَّل على حدة. الدفع بالبطاقة (مدى، فيزا، ماستركارد).
          </Txt>
        </Card>

        <Card radiusKey="lg" style={{ marginBottom: spacing.lg }}>
          <Pressable
            onPress={() => setAgreed((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
          >
            <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? colors.ink : colors.textFaint} />
            <Txt size={13} color={colors.ink} style={{ flex: 1, lineHeight: 21 }}>
              أقررتُ بقراءتي والموافقة على الشروط والأحكام — العربون غير مسترد ولا يوجد إلغاء بعد التأكيد.
            </Txt>
          </Pressable>
          <Txt size={13} weight="bold" color={colors.goldDeep} onPress={() => setShowTerms((v) => !v)} style={{ marginTop: spacing.sm }}>
            {showTerms ? 'إخفاء الشروط' : 'اقرأ الشروط والأحكام'}
          </Txt>
          {showTerms ? <CateringTerms /> : null}
        </Card>

        <Button
          label="إرسال الطلب والمتابعة للدفع"
          trailing={q ? formatRiyal(q.depositDue) : undefined}
          onPress={() => void submit()}
          loading={submitting}
        />
        <Txt size={11} color={colors.textFaint} center style={{ marginTop: spacing.sm, lineHeight: 17 }}>
          يُثبَّت الحجز بعد الدفع وتأكيد فريقنا للتوفّر في التاريخ المختار.
        </Txt>
      </View>
    </ScreenContainer>
  );
}

/** The site's terms modal, verbatim in substance (catering.html #termsOverlay). */
const TERMS: { title: string; items: string[] }[] = [
  {
    title: 'العربون (غير مسترد)',
    items: [
      'العربون (٧٠٪ من قيمة الطلب) غير قابل للاسترداد نهائيًا، تحت أي ظرف ولأي سبب كان، فور تأكيد الحجز.',
      'لا يوجد أي حالة أو سبب يُجيز استرداد العربون.',
    ],
  },
  {
    title: 'استرجاع المبالغ',
    items: [
      'في حال دفع كامل المبلغ ثم حدث ظرف ووافقت الإدارة (استثناءً) على الاسترجاع، يُعاد فقط المبلغ الزائد عن العربون — أمّا العربون فلا يُعاد إطلاقًا.',
      'مبلغ التأمين (٣٠٠ ر.س) يُعاد بالكامل بعد المناسبة عند إرجاع المعدّات والأدوات سليمة دون تلف أو نقص.',
    ],
  },
  {
    title: 'سياسة الإلغاء والتعديل',
    items: [
      'لا يوجد إلغاء بعد تأكيد الحجز.',
      'في الظروف القاهرة أو الأسباب المقنعة الخارجة عن إرادة العميل، يمكنه التواصل مع الإدارة قبل موعد التنفيذ بـ ٢٤ ساعة على الأقل، وتبقى الموافقة لتقدير الإدارة. وما عدا ذلك لا يُقبل الإلغاء.',
      'أي تعديل (التاريخ/الكمية/الموقع) يخضع لموافقة الإدارة والتوفّر، ويجب طلبه قبل الموعد بـ ٢٤ ساعة على الأقل.',
    ],
  },
  {
    title: 'شروط إضافية',
    items: [
      'رسوم التوصيل تُحدَّد حسب الموقع وتُحصَّل على حدة (غير مشمولة في الإجمالي).',
      'يلتزم العميل بتوفير مكان مناسب وآمن لتقديم الخدمة، ومدخل/كهرباء عند الحاجة.',
      'تأخّر العميل عن الوصول أو تعذّر الدخول لأسباب من جهته لا يُعدّ سببًا للاسترداد.',
      'الكميات والمنيو تُعتمد كما في الطلب؛ وأي زيادة يوم المناسبة تخضع للتوفّر وتُحتسب إضافةً.',
      'يُقرّ العميل بصحّة بياناته (الاسم/الجوال/التاريخ/الموقع) ويتحمّل مسؤولية دقّتها.',
      'تحتفظ الإدارة بحق رفض أو تعديل الطلب في حال مخالفة الشروط أو نقص البيانات.',
    ],
  },
];

function CateringTerms() {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Txt size={12} weight="bold" color={colors.danger} style={{ lineHeight: 19, marginBottom: spacing.sm }}>
        يُرجى قراءة الشروط بعناية. تأكيدك للطلب يعني موافقتك الكاملة عليها.
      </Txt>
      {TERMS.map((s, i) => (
        <View key={s.title} style={{ marginTop: spacing.sm }}>
          <Txt size={13} weight="black" color={colors.goldDeep}>
            {`${toArabicDigits(i + 1)}) ${s.title}`}
          </Txt>
          {s.items.map((it) => (
            <Txt key={it} size={12} color={colors.textSecondary} style={{ marginTop: 4, lineHeight: 20 }}>
              {`• ${it}`}
            </Txt>
          ))}
        </View>
      ))}
    </View>
  );
}
