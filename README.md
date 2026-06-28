# Sun Ray · سن راي ☀

تطبيق موبايل لمقهى **Sun Ray** (عربي RTL) مبني بـ Expo + React Native + TypeScript.
المرحلة الحالية: **MVP تفاعلي ببيانات تجريبية (Mock)** — بدون Backend أو دفع أو OTP حقيقي.

## التشغيل

```bash
npm install        # (.npmrc يفعّل legacy-peer-deps تلقائيًا)
npm start          # أو: npx expo start
```

ثم افتح على:
- **iOS / Android**: تطبيق Expo Go (امسح الـ QR).
- **iPad / Tablet**: نفس الأمر — التخطيط Responsive (شبكات أوسع).
- محاكي: اضغط `i` (iOS) أو `a` (Android) في الطرفية.

أوامر مفيدة:
```bash
npm run typecheck  # tsc --noEmit
npx expo export -p ios   # تجربة حزم الـ bundle
```

## التقنيات
- **Expo Router** (تنقل ملفّي) · **Zustand** (الحالة) · **TypeScript صارم**
- خطوط **Tajawal** + **Plus Jakarta Sans** · أيقونات **Ionicons**
- **RTL** مفعّل + أرقام عربية-هندية · بنية i18n جاهزة للإنجليزية

## البنية
```
app/                    مسارات Expo Router (رفيعة، تعيد تصدير الشاشات)
  (auth)/  splash · onboarding · language · login · otp
  (tabs)/  home · menu · orders · loyalty · account
  product/[id] · cart · checkout · order-success · orders/[id] · track/[id]
  wallet/ · gift/ · offers · reserve · waitlist · addresses · address-new
  edit-profile · settings · support · faq
src/
  components/  مكوّنات قابلة لإعادة الاستخدام (Button, Card, ProductCard, …)
  screens/     منطق كل شاشة
  store/        Zustand (auth, cart, wallet, loyalty, order, gift, branch, …)
  data/         بيانات تجريبية (المنيو، الفروع، الكوبونات، …)
  types/ theme/ hooks/ utils/ i18n/ constants/ services/ assets/
```

## ملاحظات
- لا توجد مفاتيح API أو بيانات حساسة. الدفع/الشحن/البطاقات كلها تجريبية.
- هياكل مستقبلية جاهزة في `src/services/` (auth · payments · foodics · api).
- اضبط قواعد العمل (الضريبة، رسوم التوصيل، عتبات الولاء) من `src/constants/config.ts`.
