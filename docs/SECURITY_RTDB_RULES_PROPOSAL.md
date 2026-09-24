# مقترح قواعد Realtime Database — عقد التطبيق

> **لا تنشر هذا كما هو.** هذا مقترح لجزء واحد من ملف القواعد، مكتوب من جانب
> التطبيق فقط. الملف الحي يغطي أيضًا لوحة العمليات الداخلية (موارد بشرية،
> رواتب، حضور، بصمة وجه، مالية) التي لم أفحص احتياجاتها، ونشر قواعد مشدَّدة
> عليها دون فهمها يوقف عمل المقهى.

## المشكلة

ملف `database.rules.json` في مستودع المتجر يبدأ بـ:

```json
{ "rules": {
    ".read": true,
    ".write": "auth != null",
```

وعقد التطبيق — `store/orders` و`store/config` — **غير مذكورة في الملف إطلاقًا**،
فترث الجذر. النتيجتان:

1. كل طلبات العملاء مقروءة لأي شخص على الإنترنت يعرف رابط قاعدة البيانات،
   والرابط مكتوب في `src/services/firebase.ts:67` داخل التطبيق المنشور.
2. أي مستخدم مسجَّل — بما في ذلك جلسة مجهولة، إذ يصدّر
   `_public_access/sunrayMenu/database/firebase-config.js` دالة `tryAnonymousSignIn`
   — يستطيع الكتابة على أي طلب، بما فيه ضبط `status: "paid"` بلا دفع.

## ما يحتاجه التطبيق فعلًا

قراءة فقط، من موضعين لا ثالث لهما:

| العقدة | المستدعي | الغرض |
|---|---|---|
| `store/config/open` | `storeConfig.ts:53` | حالة فتح/إغلاق المتجر |
| `store/config/giftPackages` | `storeConfig.ts:71` | باقات الإهداء |
| `store/config/closedSections` | `storeConfig.ts:72` | أقسام القائمة المغلقة مؤقتًا |
| `store/orders/$orderId` | `storePay.ts:70` | مراقبة تسوية الدفع بعد الشحن |

**التطبيق لا يكتب في RTDB إطلاقًا.** كل كتابة تمر عبر دالة Callable. لذا كل
قواعد الكتابة أدناه `false` — الخادم يستخدم Admin SDK الذي يتجاوز القواعد.

## المقترح

```json
"store": {
  ".read": false,
  ".write": false,

  "config": {
    "open":           { ".read": true, ".write": false },
    "giftPackages":   { ".read": true, ".write": false },
    "closedSections": { ".read": true, ".write": false }
  },

  "orders": {
    ".read": false,
    ".write": false,
    "$orderId": {
      ".read": "auth != null && auth.uid === data.child('OWNER_FIELD').val()",
      ".write": false
    }
  }
}
```

### `OWNER_FIELD` — يحتاج تأكيدًا منك

لا أعرف اسم الحقل الذي يكتب فيه `createStoreOrder` هوية صاحب الطلب، لأن التطبيق
لا يقرأه أبدًا: قائمة الطلبات تأتي من دالة `myOrders` التي تُرشِّح على الخادم،
والتطبيق لا يقرأ عقدة الطلب إلا بمعرّف يملكه لتوّه.

افتح أي عقدة تحت `store/orders` في Console وانظر اسم الحقل — غالبًا `uid` أو
`customerUid` أو `customer/uid` — وضعه مكان `OWNER_FIELD`. إن لم يكن هناك حقل
هوية أصلًا، فالخيار الآمن هو `".read": false` تمامًا، ونقل مراقبة التسوية من
RTDB إلى استقصاء دالة Callable — تعديل في `src/services/storePay.ts:65-98`.

### ثلاثة لا يغطيها هذا المقترح

1. **`sys_ops_secure` وما يتبعه** — 37 عقدة قابلة للكتابة بلا مصادقة، منها
   `audit_log` و`system_verification/admin_gate` و`sunray_menu_v3` (الأسعار).
   تحتاج جردًا مع من يملك لوحة العمليات قبل أي تشديد.
2. **المصادقة المجهولة** — ما دامت مفعَّلة، فـ`"auth != null"` لا يعني شيئًا في
   أي قاعدة. عطّلها أو استبدل كل `auth != null` بفحص دور من custom claims.
3. **App Check** — غير مفعَّل. بدونه تُستدعى الدوال مباشرة من خارج التطبيق.

## التحقق بعد النشر

```bash
# يجب أن يعيد Permission denied، لا بيانات
curl 'https://sunray-xx-default-rtdb.europe-west1.firebasedatabase.app/store/orders.json'

# يجب أن يبقى متاحًا (حالة الفتح ليست بيانات شخصية)
curl 'https://sunray-xx-default-rtdb.europe-west1.firebasedatabase.app/store/config/open.json'
```

ثم من التطبيق: افتح شاشة الرئيسية (تقرأ `config/open`)، وادفع طلبًا واحدًا
وتأكد أن شاشة التسوية ما زالت ترى تغيّر الحالة.
