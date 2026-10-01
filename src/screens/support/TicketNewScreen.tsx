import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Button, Card, EmptyState, Header, OptionChip, ScreenContainer, TextField, Txt } from '@/components';
import { toast, useAuthStore } from '@/store';
import { toArabicDigits } from '@/utils/numerals';
import { MONTHS_AR_LIST } from '@/utils/date';
import { validateContact, ymd, type ContactType, type TicketType } from '@/services/requestRules';
import { createTicket } from '@/services/storeTickets';
import { FormSection, TimeChips } from './parts';

/** Copy per ticket type, from ticket.html's COPY table. */
const COPY: Record<TicketType, { hint: string; title: string; titlePh: string; body: string; bodyPh: string; incident: boolean }> = {
  complaint: {
    hint: 'اكتب لنا ما حدث، وسنراجعه ونردّ عليك برقم متابعة.',
    title: 'الموضوع',
    titlePh: 'مثال: تأخّر الطلب عن الوقت المحدّد',
    body: 'التفاصيل',
    bodyPh: 'اشرح لنا ما حدث بالتفصيل — الوقت، الفرع، وما الذي لم يكن كما توقّعت.',
    incident: true,
  },
  suggestion: {
    hint: 'فكرتك تهمّنا — اكتبها وسنراجعها ونردّ عليك برقم متابعة.',
    title: 'عنوان الاقتراح',
    titlePh: 'مثال: إضافة خيار حليب نباتي',
    body: 'فكرتك',
    bodyPh: 'اشرح فكرتك وكيف تتصوّر أنها تحسّن تجربتك معنا.',
    incident: false,
  },
};

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

/** The last seven days, today first — when a problem can have happened. */
function recentDays(now = new Date()): { value: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = i === 0 ? 'اليوم' : i === 1 ? 'أمس' : `${toArabicDigits(d.getDate())} ${MONTHS_AR_LIST[d.getMonth()]}`;
    return { value: ymd(d), label };
  });
}

/**
 * «افتح تذكرة» — a complaint or a suggestion, as on sunray.sa/ticket.
 *
 * Written in tickets.js's exact shape (`buildTicketRecord`). Two differences,
 * both forced by what the app does not have: no photo attachments (no image
 * picker), and a signed-in customer is required — the `shortIndex` entry needs
 * an auth session, and the app does not sign guests in anonymously because an
 * anonymous session would be restored on the next launch as if it were a
 * real account.
 */
export function TicketNewScreen() {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);

  const [type, setType] = useState<TicketType>('complaint');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [incidentDay, setIncidentDay] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [contactType, setContactType] = useState<ContactType>('phone');
  const [contact, setContact] = useState(() => (user?.phone ? `0${user.phone}` : ''));
  const [sending, setSending] = useState(false);
  const days = useMemo(() => recentDays(), []);
  const c = COPY[type];

  const header = <Header showBack title="افتح تذكرة" />;

  if (!user || isGuest) {
    return (
      <ScreenContainer header={header}>
        <EmptyState
          icon="ticket"
          title="سجّل دخولك لفتح تذكرة"
          subtitle="لنتابع معك ونردّ عليك على رقمك. ويمكنك مراسلتنا مباشرة من صفحة الدعم."
          actionLabel="تسجيل الدخول"
          onAction={() => router.push('/(auth)/login')}
        />
      </ScreenContainer>
    );
  }

  const switchType = (t: TicketType) => {
    setType(t);
    // A time picked for a complaint must not ride along on a suggestion.
    if (!COPY[t].incident) {
      setIncidentDay('');
      setIncidentTime('');
    }
  };

  const switchContact = (t: ContactType) => {
    setContactType(t);
    setContact(t === 'phone' && user.phone ? `0${user.phone}` : '');
  };

  const submit = async () => {
    if (sending) return;
    if (!title.trim() || !body.trim()) return toast('الرجاء تعبئة الحقول المطلوبة');
    const ct = validateContact(contactType, contact);
    if (!ct) {
      return toast(
        contactType === 'phone'
          ? 'الرجاء إدخال رقم جوال صحيح للتواصل والمتابعة'
          : 'الرجاء إدخال حساب إنستقرام صحيح للتواصل والمتابعة',
      );
    }
    setSending(true);
    try {
      // datetime-local's format, as the site stores it. A day without a time
      // is sent as noon rather than dropped — the day alone still helps staff.
      const incident = c.incident && incidentDay ? `${incidentDay}T${incidentTime || '12:00'}` : null;
      const { key, code } = await createTicket({ type, title, body, contact: ct, incidentTime: incident });
      toast(`تم رفع التذكرة ${code}`);
      router.replace({ pathname: '/ticket/[key]', params: { key } });
    } catch {
      toast('تعذّر رفع التذكرة، تحقّق من اتصالك وحاول مجددًا');
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer header={header} scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <FormSection title="نوع التذكرة">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <OptionChip block label="شكوى" selected={type === 'complaint'} onPress={() => switchType('complaint')} />
            <OptionChip block label="اقتراح" selected={type === 'suggestion'} onPress={() => switchType('suggestion')} />
          </View>
          <Txt size={12} color={colors.textMuted} style={{ marginTop: spacing.sm, lineHeight: 19 }}>
            {c.hint}
          </Txt>
        </FormSection>

        <FormSection title={c.title}>
          <TextField value={title} onChangeText={setTitle} maxLength={120} placeholder={c.titlePh} />
        </FormSection>

        <FormSection title={c.body}>
          <TextField
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            multiline
            placeholder={c.bodyPh}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
        </FormSection>

        {c.incident ? (
          <FormSection title="وقت حدوث المشكلة (اختياري)">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {days.map((d) => (
                <OptionChip
                  key={d.value}
                  label={d.label}
                  selected={incidentDay === d.value}
                  onPress={() => setIncidentDay(incidentDay === d.value ? '' : d.value)}
                  style={{ paddingHorizontal: spacing.md }}
                />
              ))}
            </View>
            {incidentDay ? (
              <View style={{ marginTop: spacing.md }}>
                <TimeChips value={incidentTime} onChange={setIncidentTime} hours={ALL_HOURS} />
              </View>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection title="وسيلة التواصل" hint="إجباري — للرد عليك والمتابعة.">
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
            <OptionChip block label="جوال" selected={contactType === 'phone'} onPress={() => switchContact('phone')} />
            <OptionChip block label="إنستقرام" selected={contactType === 'instagram'} onPress={() => switchContact('instagram')} />
          </View>
          <TextField
            value={contact}
            onChangeText={setContact}
            ltr
            maxLength={40}
            autoCapitalize="none"
            keyboardType={contactType === 'phone' ? 'phone-pad' : 'default'}
            placeholder={contactType === 'phone' ? '05xxxxxxxx' : '@username'}
          />
        </FormSection>

        <Card radiusKey="lg" backgroundColor={colors.chipCream} style={{ marginBottom: spacing.lg }}>
          <Txt size={12} color={colors.textSecondary} style={{ lineHeight: 19 }}>
            إرفاق الصور متاح حاليًا من موقع sunray.sa فقط. يصلك رقم متابعة فور الإرسال، وتجد الرد في «تذاكري».
          </Txt>
        </Card>

        <Button label="إرسال التذكرة" onPress={() => void submit()} loading={sending} />
      </View>
    </ScreenContainer>
  );
}
