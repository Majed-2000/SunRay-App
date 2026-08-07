// ============================================================
// VENDORED COPY — DO NOT EDIT.
//
// Source of truth:  SUNRAY_OS_V2/functions/plate_core.js
// Regenerate with:  node scripts/gen_shared_core.cjs   (in the store repo)
//
// The Saudi plate mapping is deliberately kept in ONE place, and the source
// file says so outright: other surfaces receive a GENERATED copy and must
// never hand-write a second one. Retyping these 17 letters here would be
// exactly the drift it warns about — the app would disagree with the server
// about which car the barista is looking for.
//
// ⚠️ The generator writes to two targets today (the store client and the
//    branch print agent). This app is a THIRD consumer it does not know
//    about, so a change to the mapping will NOT reach here automatically.
//    Adding this path to the generator TARGETS list is the proper fix and
//    belongs in the store repo.
//
// The mapping is non-phonetic on purpose: ع is E, م is Z, ص is X, ح is J,
// ق is G, و is U, ى is V. Anything that looks wrong here is right.
// ============================================================
// ============================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source:     functions/plate_core.js
// Regenerate: node scripts/gen_shared_core.cjs
// Target:     _public_access/web_main/store/js/plate_core.js
//
// Editing this file directly will be silently overwritten on the next
// generator run, and will make this surface disagree with the server about
// a plate or a price. Change the source instead.
// ============================================================
// ============================================================
// plate_core.js — Saudi license plate: THE single source of truth
// ------------------------------------------------------------
// This file is the ONLY place the Arabic->Latin plate mapping is defined.
// Every other surface (store client, print agent) receives a GENERATED copy
// produced by `node scripts/gen_shared_core.cjs`. Never hand-write a second copy.
//
// Generated artefacts (do not edit them directly):
//   _public_access/web_main/store/js/plate_core.js   (ES module, store client)
//   print_agent/vendor/plate_core.js                 (CommonJS, branch PC agent)
//
// No dependencies — plain CommonJS so it can be required by Cloud Functions,
// by the print agent, and executed by the plain-node test runner.
// ============================================================

// ── The official mapping — exactly 17 letters ──────────────────────────────
// Saudi plates use a NON-PHONETIC transliteration. Do not "correct" it:
//   ع is E (not A/aa), م is Z (not M), ص is X (not S), ح is J, ق is G,
//   و is U, ى is V. Anything that looks phonetically wrong here is right.
const PLATE_MAP = Object.freeze({
    "ا": "A",   // ا
    "ب": "B",   // ب
    "ح": "J",   // ح
    "د": "D",   // د
    "ر": "R",   // ر
    "س": "S",   // س
    "ص": "X",   // ص
    "ط": "T",   // ط
    "ع": "E",   // ع
    "ق": "G",   // ق
    "ك": "K",   // ك
    "ل": "L",   // ل
    "م": "Z",   // م
    "ن": "N",   // ن
    "ه": "H",   // ه
    "و": "U",   // و
    "ى": "V",   // ى
});

const PLATE_MAPPING_VERSION = 1;

// Letters that do NOT appear on Saudi plates. Present for documentation and
// for the error path; a character here that survives normalization is rejected
// by name.
//
// NOTE on ي (U+064A): it is listed as banned, but normalization step 6 converts
// it to ى (U+0649) BEFORE validation runs, so in practice a customer typing ي
// gets V and never sees an error. That asymmetry is deliberate — see
// normalizeArabicPlate().
const BANNED_AR = Object.freeze([
    "ت", // ت
    "ث", // ث
    "ج", // ج
    "ذ", // ذ
    "ز", // ز
    "ش", // ش
    "ض", // ض
    "ظ", // ظ
    "غ", // غ
    "ف", // ف
    "ي", // ي  (silently normalized to ى — never actually reaches the error path)
]);

const MAX_LETTERS = 3;
const MAX_NUMBERS = 4;

// ── Normalization ─────────────────────────────────────────────────────────
// Steps are applied in EXACTLY this order. Steps 5-9 are SILENT corrections of
// near-certain typos: a customer who types ة means ه, and one who types ي means
// ى. We convert rather than reject, because a rejected form on a phone at a
// drive-through is worse than a confidently-correct guess on characters that
// have no other plausible reading.
function normalizeArabicPlate(input) {
    let s = String(input == null ? "" : input);

    // The character classes below hold LITERAL characters (repo convention — see
    // latinizeDigits in store/js/store-core.js). Several of them are invisible in
    // an editor, so each line states its code points and `tests/plate.test.js`
    // asserts them by \u escape. If you edit a class here, re-run the tests; a
    // silently corrupted zero-width class will not look wrong on screen.
    // 1) Arabic diacritics (U+064B-U+0652, U+0670, U+06D6-U+06ED)
    s = s.replace(/[ً-ْٰۖ-ۭ]/g, "");
    // 2) tatweel U+0640
    s = s.replace(/ـ/g, "");
    // 3) zero-width + bidi marks (U+200B..U+200F, U+FEFF)
    s = s.replace(/[​‌‍‎‏﻿]/g, "");
    // 4) alef variants -> ا (U+0627)
    s = s.replace(/[أإآٱ]/g, "ا");
    // 5) ة (U+0629) -> ه (U+0647)
    s = s.replace(/ة/g, "ه");
    // 6) ي (U+064A) -> ى (U+0649)
    //    Yeh is not a plate letter, but the customer almost certainly means alef
    //    maksura -> V. Convert silently; do NOT error.
    s = s.replace(/ي/g, "ى");
    // 7) ئ (U+0626) -> ى (U+0649)
    s = s.replace(/ئ/g, "ى");
    // 8) Persian ک (U+06A9) -> ك (U+0643)
    s = s.replace(/ک/g, "ك");
    // 9) Persian ی (U+06CC) -> ى (U+0649)
    s = s.replace(/ی/g, "ى");
    // 10) Arabic-Indic digits ٠-٩ (U+0660-U+0669) -> 0-9
    s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    // 11) Eastern Arabic-Indic digits ۰-۹ (U+06F0-U+06F9) -> 0-9
    s = s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
    // 12) collapse whitespace runs, trim
    s = s.replace(/\s+/g, " ").trim();

    return s;
}

// Digits-only normalization for the numbers field (same digit rules, no spaces).
function normalizePlateNumbers(input) {
    return normalizeArabicPlate(input).replace(/\s+/g, "");
}

// ── Transliteration ───────────────────────────────────────────────────────
//
// DIRECTION — read this before touching anything below.
//
// Arabic reads RIGHT-TO-LEFT. Latin reads LEFT-TO-RIGHT. The Latin line on a
// Saudi plate is therefore the REVERSE of the transliterated Arabic sequence:
//
//     Arabic input:  ا ب ح
//     Transliterate: A B J
//     Reverse:       J B A     <- this is what goes on the Latin line
//
// A customer holding their phone next to the car must see J B A to match the
// plate. Getting this backwards means staff walks to the wrong car, which is
// the entire bug this module exists to fix.
//
// Input MUST already be normalized (normalizeArabicPlate) and validated.
function transliterate(arabicLetters) {
    const chars = Array.from(String(arabicLetters || ""));
    const latin = chars.map((ch) => PLATE_MAP[ch]);
    return latin.reverse().join("");
}

// ── Validation ────────────────────────────────────────────────────────────
// Returns { ok: true, lettersAr, numbers, lettersEn, plate, mappingVersion }
//      or { ok: false, code, field, message }  (message is Arabic, customer-facing)
//
// Never maps an unknown character to "?" or "_", and never silently drops one.
function validatePlate(rawLetters, rawNumbers) {
    const lettersAr = normalizeArabicPlate(rawLetters).replace(/\s+/g, "");
    const numbers = normalizePlateNumbers(rawNumbers);

    if (!lettersAr) {
        return fail("letters_empty", "letters",
            "أدخل حروف اللوحة (من حرف إلى ثلاثة أحرف).");
    }

    // Character check comes BEFORE the length check: naming the bad character is
    // more useful than "too many letters" when the customer typed a banned one.
    const chars = Array.from(lettersAr);
    for (const ch of chars) {
        if (!PLATE_MAP[ch]) {
            return fail("letters_unknown_char", "letters",
                "حرف (" + ch + ") غير مستخدم في لوحات السيارات السعودية. تأكد من اللوحة.",
                { char: ch });
        }
    }

    if (chars.length > MAX_LETTERS) {
        return fail("letters_too_many", "letters",
            "حروف اللوحة السعودية من حرف إلى ثلاثة أحرف فقط.");
    }

    if (!numbers) {
        return fail("numbers_empty", "numbers",
            "أدخل أرقام اللوحة (من رقم إلى أربعة أرقام).");
    }
    if (!/^[0-9]+$/.test(numbers)) {
        return fail("numbers_invalid", "numbers",
            "أرقام اللوحة يجب أن تكون أرقاماً فقط.");
    }
    if (numbers.length > MAX_NUMBERS) {
        return fail("numbers_too_many", "numbers",
            "أرقام اللوحة من رقم إلى أربعة أرقام فقط.");
    }

    const lettersEn = transliterate(lettersAr);
    return {
        ok: true,
        plateType: PLATE_TYPES.SAUDI,
        lettersAr,
        numbers,                                  // exactly as entered — never zero-padded
        lettersEn,
        plate: formatLegacyPlate(lettersEn, numbers),
        mappingVersion: PLATE_MAPPING_VERSION,
    };
}

function fail(code, field, message, extra) {
    return Object.assign({ ok: false, code, field, message }, extra || {});
}

// ══════════════════════════════════════════════════════════════════════════
// NON-SAUDI PLATES (Part 5B)
// ------------------------------------------------------------------------
// The 17-letter rule is right for Saudi plates and wrong for everyone else.
// GCC-registered cars, diplomatic and transit plates cannot be expressed in it
// at all, so the validation that protects most customers locks the rest out of
// car delivery entirely.
//
// The escape hatch is a DELIBERATE, VISIBLE choice the customer makes up front —
// not a hidden fallback after validation fails — because they know their own
// plate better than any validator does. So validation here is minimal and
// permissive: safety only.
//
// Explicitly NOT done: no transliteration, no reversal, no case folding, no
// digit conversion, no separator insertion. Whatever the customer types is what
// staff needs to see. A best-effort parse would produce a plate that LOOKS
// authoritative and is wrong — the exact failure Part 1 exists to eliminate.
// ══════════════════════════════════════════════════════════════════════════

const PLATE_TYPES = Object.freeze({ SAUDI: "saudi", NON_SAUDI: "non_saudi" });
const MAX_FREEFORM = 20;   // generous — some plates are long

// Characters removed before anything else. Checked by CODE POINT rather than a
// regex literal: every one of these is invisible in an editor, so a literal
// character class here would be unreviewable and trivially corrupted on paste.
//
// The direction overrides are the ones that matter beyond tidiness: U+202A-U+202E
// and U+2066-U+2069 can make DISPLAYED text differ from STORED text, so a plate
// could read one way on the cashier screen and another on the printed slip. That
// is a genuine spoofing vector on a value that gets read aloud in a parking lot.
// Whitespace-ish controls are NOT unsafe — they are separators. A tab pasted
// between plate parts must become a space, not disappear: dropping it turns
// "AB<tab>12" into "AB12", which is a DIFFERENT plate string, and silently
// altering the customer's value is exactly what free-form mode must not do.
function isWhitespaceControl(cp) {
    return cp === 0x09 || cp === 0x0A || cp === 0x0B || cp === 0x0C || cp === 0x0D;
}
function isUnsafeCodePoint(cp) {
    if (isWhitespaceControl(cp)) return false;               // handled as a separator
    if (cp <= 0x1F || cp === 0x7F) return true;              // C0 controls + DEL
    if (cp >= 0x80 && cp <= 0x9F) return true;               // C1 controls
    if (cp === 0x200B || cp === 0x200C || cp === 0x200D) return true;  // zero-width
    if (cp === 0x200E || cp === 0x200F) return true;         // LRM / RLM
    if (cp >= 0x202A && cp <= 0x202E) return true;           // bidi embedding + OVERRIDE
    if (cp >= 0x2066 && cp <= 0x2069) return true;           // bidi isolates
    if (cp === 0xFEFF) return true;                          // BOM / ZWNBSP
    return false;
}

// What a plate may legitimately contain, again by code point.
function isAllowedFreeformCodePoint(cp) {
    if (cp === 0x20) return true;                            // space
    if (cp === 0x2D || cp === 0x2F) return true;             // - and /
    if (cp >= 0x30 && cp <= 0x39) return true;               // 0-9
    if (cp >= 0x41 && cp <= 0x5A) return true;               // A-Z
    if (cp >= 0x61 && cp <= 0x7A) return true;               // a-z
    if (cp >= 0x0621 && cp <= 0x064A) return true;           // Arabic letters
    if (cp >= 0x0660 && cp <= 0x0669) return true;           // Arabic-Indic digits (kept AS TYPED)
    if (cp >= 0x06F0 && cp <= 0x06F9) return true;           // Eastern Arabic-Indic digits
    if (cp === 0x0671 || cp === 0x06A9 || cp === 0x06CC) return true;  // alef wasla, Persian keheh/yeh
    return false;
}

// Safety normalization ONLY. Note what is absent: no toUpperCase, no digit
// folding, no reordering. Compare with normalizeArabicPlate above, which does a
// great deal — because there we know the target alphabet and here we do not.
function normalizeFreeformPlate(input) {
    let out = "";
    for (const ch of String(input == null ? "" : input)) {
        const cp = ch.codePointAt(0);
        if (isWhitespaceControl(cp)) { out += " "; continue; }   // separator, not noise
        if (isUnsafeCodePoint(cp)) continue;
        out += ch;
    }
    // Collapse any whitespace run (incl. NBSP and friends) to one ASCII space, then trim.
    return out.replace(/\s+/g, " ").trim();
}

function validateFreeformPlate(input) {
    const raw = normalizeFreeformPlate(input);

    if (!raw) {
        return fail("plate_empty", "plate", "أدخل رقم اللوحة كما هو مكتوب عليها.");
    }

    const chars = Array.from(raw);
    for (const ch of chars) {
        if (!isAllowedFreeformCodePoint(ch.codePointAt(0))) {
            return fail("plate_bad_char", "plate",
                "الرمز (" + ch + ") غير مسموح في رقم اللوحة. استخدم حروفاً أو أرقاماً أو - أو /.",
                { char: ch });
        }
    }

    if (chars.length > MAX_FREEFORM) {
        return fail("plate_too_long", "plate",
            "رقم اللوحة طويل جداً (الحد " + MAX_FREEFORM + " خانة).");
    }

    return {
        ok: true,
        plateType: PLATE_TYPES.NON_SAUDI,
        raw,                       // EXACTLY as typed, after safety stripping only
        plate: raw,                // legacy single-string field stays populated
        // Deliberately null — see the note above. A non-Saudi plate has no Arabic
        // letters, no derived Latin, and no separable number component.
        lettersAr: null, lettersEn: null, numbers: null,
        // null, NOT 0. Zero is the sentinel for legacy Saudi rows whose Arabic could
        // not be recovered (1.8); these are a different thing entirely and must never
        // be confused with them.
        mappingVersion: null,
    };
}

// ── one entry point the server calls, whichever mode the customer chose ──
// data: { plateType, plateLettersAr, plateNumbers, plateRaw }
function validatePlateInput(data) {
    const d = data || {};
    if (String(d.plateType || "") === PLATE_TYPES.NON_SAUDI) {
        return validateFreeformPlate(d.plateRaw);
    }
    return validatePlate(d.plateLettersAr, d.plateNumbers);
}

// Legacy single-string form kept in sync on the order (`plate`) so the existing
// renderers, quick-scan, the WhatsApp bot and both dashboards keep working.
function formatLegacyPlate(lettersEn, numbers) {
    return String(lettersEn || "") + " " + String(numbers || "");
}

// Ordered list for the 17-chip keypad. Kept in the natural Arabic alphabet order
// the customer expects to scan, not in map-insertion order.
const PLATE_LETTERS_AR = Object.freeze(Object.keys(PLATE_MAP));

export {
    PLATE_MAP,
    PLATE_LETTERS_AR,
    BANNED_AR,
    PLATE_MAPPING_VERSION,
    PLATE_TYPES,
    MAX_LETTERS,
    MAX_NUMBERS,
    MAX_FREEFORM,
    normalizeArabicPlate,
    normalizePlateNumbers,
    normalizeFreeformPlate,
    transliterate,
    validatePlate,
    validateFreeformPlate,
    validatePlateInput,
    isAllowedFreeformCodePoint,
    isUnsafeCodePoint,
    formatLegacyPlate,
};
