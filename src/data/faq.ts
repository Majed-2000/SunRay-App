export interface FaqItem {
  id: string;
  questionAr: string;
  answerAr: string;
}

/**
 * Written from what the app and the store actually do. The previous set
 * promised instant points, paying from a wallet, gift codes sent to the
 * recipient and delivery per branch — none of which existed.
 */
export const faqItems: FaqItem[] = [
  {
    id: 'types',
    questionAr: 'كيف أستلم طلبي؟',
    answerAr: 'بطريقتين: استلام من الفرع، أو خدمة السيارة حيث نوصل الطلب لسيارتك. لا يوجد توصيل للمنازل حاليًا.',
  },
  {
    id: 'car',
    questionAr: 'كيف تعمل خدمة السيارة؟',
    answerAr: 'اختر «سيارتي» وأدخل رقم لوحتك عند الطلب. عند وصولك للفرع افتح الطلب من «طلباتي» واضغط «وصلت»، ويخرج لك الباريستا بالطلب.',
  },
  {
    id: 'pay',
    questionAr: 'ما طرق الدفع؟',
    answerAr: 'الدفع بالبطاقة (مدى، فيزا، ماستركارد) عبر بوابة ميسّر الآمنة. لا نحفظ بيانات بطاقتك.',
  },
  {
    id: 'status',
    questionAr: 'كيف أتابع طلبي؟',
    answerAr: 'من «طلباتي»: تظهر حالة الطلب من التحضير حتى الجاهزية، ومعها رقم الطلب الذي تذكره عند الاستلام.',
  },
  {
    id: 'points',
    questionAr: 'كيف أجمع النقاط؟',
    answerAr: 'تُضاف النقاط بعد اكتمال دفع طلبك، وتظهر في صفحة الولاء مع المكافآت التي يمكنك استبدالها.',
  },
  {
    id: 'cancel',
    questionAr: 'هل أستطيع إلغاء طلبي؟',
    answerAr: 'يمكنك إلغاء الطلب من صفحته ما دام غير مدفوع. بعد الدفع تواصل معنا من «الدعم والمساعدة» واذكر رقم الطلب.',
  },
  {
    id: 'hotcold',
    questionAr: 'لماذا يطلب مني التطبيق اختيار حار أو بارد؟',
    answerAr: 'لأن المشروب نفسه يُحضَّر بطريقتين، ولا نريد أن نختار عنك. اختيارك يصل للباريستا كما هو.',
  },
  {
    id: 'delete',
    questionAr: 'كيف أحذف حسابي؟',
    answerAr: 'من الإعدادات ← حذف الحساب. تُحذف بياناتك الشخصية ونقاطك، ونحتفظ بفواتير الطلبات مفصولة عن هويتك لأن النظام الضريبي يُلزمنا بها.',
  },
];
