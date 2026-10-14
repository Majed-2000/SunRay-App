/**
 * Branch hours and open/closed status, ported from sunray.sa.
 *
 * The website decides whether each branch is open with `branchStatusOf` in its
 * homepage script, and the admin dashboard runs a mirror of the same function
 * (`ctrl_store_dashboard.js`). The app has to give the same answer as both: a
 * customer who sees «مغلق» on the website and «نستقبلكم الآن» in the app stops
 * trusting either, and the person who drives to a shut window blames us, not
 * the screen. So this is a faithful port, rule for rule, not a re-think.
 *
 * Pure functions only — no Firebase, no React — so the rules are unit-tested
 * (`__tests__/branchStatus.test.ts`) rather than checked by eye on a device.
 *
 * ## Riyadh time without Intl
 *
 * The website asks `Intl.DateTimeFormat` for the Asia/Riyadh wall clock. Hermes'
 * `Intl` time-zone support differs by platform and engine version, and a failed
 * lookup there falls back to the *device* clock — so a customer travelling with
 * a phone set to another zone would see the wrong status. Saudi Arabia is UTC+3
 * all year with no daylight saving, so adding three hours to UTC is exact and
 * needs nothing from the engine.
 */
import { toArabicDigits } from './numerals';

/** One opening window, "HH:MM" to "HH:MM". `t <= f` means it crosses midnight. */
export interface HoursWindow {
  f: string;
  t: string;
}

export interface BranchBreak extends HoursWindow {
  label?: string;
}

/**
 * A branch as `sunray/siteConfig/branches/<id>` stores it. Field names are the
 * website's, unchanged.
 */
export interface SiteBranch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Free text the dashboard writes, e.g. «السبت–الخميس ٦ص–٢ص · الجمعة ١م–٢ص». */
  hours?: string;
  visible?: boolean;
  comingSoon?: boolean;
  /** Absent = the legacy shared schedule. */
  hoursMode?: 'auto' | 'manual';
  /** Day 0 (Sunday) .. 6 (Saturday). Arrives as an array or an object keyed "0".."6". */
  week?: unknown;
  breaks?: BranchBreak[];
  manualOpen?: boolean;
  closedMsg?: string;
  /** Emergency close from the dashboard; beats every schedule until `until`. */
  force?: { on?: boolean; until?: number; msg?: string };
  order?: number;
  placeUrl?: string;
  desc?: string;
}

export interface BranchStatus {
  open: boolean;
  /** Not opened yet — no hours, no status, never a "nearest" candidate. */
  soon?: boolean;
  msg: string;
}

/** Riyadh wall clock: weekday (0 = Sunday) and minutes since midnight. */
export interface KsaNow {
  day: number;
  min: number;
}

const KSA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function ksaNow(at: number = Date.now()): KsaNow {
  const d = new Date(at + KSA_OFFSET_MS);
  return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** "06:30" → 390. Null for anything malformed, exactly as the website rejects it. */
export function hmToMin(s: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Whether `min` falls inside a window that may cross midnight (22:00 → 02:00).
 * The naive `min >= f && min < t` is false for every minute of such a window.
 */
export function inWindow(min: number, f: unknown, t: unknown): boolean {
  const a = hmToMin(f);
  const z = hmToMin(t);
  if (a == null || z == null) return false;
  if (z <= a) return min >= a || min < z;
  return min >= a && min < z;
}

/** «٦ص» · «١:٣٠م» — the shape the dashboard's own hours text uses. */
export function arTime(hm: unknown): string {
  const m = hmToMin(hm);
  if (m == null) return String(hm ?? '');
  if (m >= 1440) return 'منتصف الليل';
  const h = Math.floor(m / 60);
  const mi = m % 60;
  const h12 = h % 12 || 12;
  return toArabicDigits(`${h12}${mi ? `:${String(mi).padStart(2, '0')}` : ''}`) + (h < 12 ? 'ص' : 'م');
}

/**
 * The windows for one weekday. `week` comes back from RTDB as an array when its
 * keys are 0..6 and as an object otherwise, and each day's list can be either
 * too — `[String(d)]` indexes both.
 */
export function windowsOf(b: Pick<SiteBranch, 'week'>, day: number): HoursWindow[] {
  const week = (b.week ?? {}) as Record<string, unknown>;
  const w = week[String(day)];
  const list = Array.isArray(w) ? w : w && typeof w === 'object' ? Object.values(w) : [];
  return (list as HoursWindow[]).filter((x) => x && hmToMin(x.f) != null && hmToMin(x.t) != null);
}

/**
 * The legacy shared schedule — what every branch used before per-branch hours,
 * and what a branch with no `hoursMode` still uses: open around the clock except
 * daily maintenance (2:40–3:10) and Friday prayer (11:00–13:30).
 *
 * The minutes mirror `store-hours.js` maintenance on the website; change both.
 */
export function legacyStatus(now: KsaNow): BranchStatus {
  if (now.min >= 160 && now.min < 190) return { open: false, msg: 'مغلق للصيانة مؤقتاً (2:40–3:10 ص)' };
  if (now.day === 5 && now.min >= 660 && now.min < 810) return { open: false, msg: 'مغلق لصلاة الجمعة (11ص–1:30م)' };
  return { open: true, msg: 'نستقبلكم الآن' };
}

/**
 * `branchStatusOf` from the homepage, rule for rule, in the same precedence:
 * comingSoon → force → auto (week windows, then breaks) → manual → legacy.
 *
 * Note the auto branch checks **today's** windows only, wrapping past midnight
 * inside the same day — that is the homepage's behaviour, kept as is. (The Go
 * menu page uses a variant that also checks yesterday's tail; see `weekGate`.)
 */
export function branchStatusOf(b: Partial<SiteBranch> | null | undefined, at: number = Date.now()): BranchStatus {
  const br = b ?? {};
  if (br.comingSoon) return { open: false, soon: true, msg: 'لم يُفتَح بعد' };
  const f = br.force ?? {};
  if (f.on && (!f.until || Number(f.until) > at)) return { open: false, msg: f.msg || 'مغلق مؤقتاً' };
  const now = ksaNow(at);
  if (br.hoursMode === 'auto') {
    const wins = windowsOf(br, now.day);
    if (!wins.some((w) => inWindow(now.min, w.f, w.t))) return { open: false, msg: 'مغلق الآن' };
    for (const x of br.breaks ?? []) {
      if (x && inWindow(now.min, x.f, x.t)) {
        return { open: false, msg: `${x.label || 'إغلاق مؤقت'} (${arTime(x.f)}–${arTime(x.t)})` };
      }
    }
    return { open: true, msg: 'نستقبلكم الآن' };
  }
  if (br.hoursMode === 'manual') {
    if (br.manualOpen === false) return { open: false, msg: br.closedMsg || 'مغلق حالياً' };
    return { open: true, msg: 'نستقبلكم الآن' };
  }
  return legacyStatus(now);
}

/**
 * Today's hours as one line, e.g. «اليوم ٦ص–٢ص», or null when the branch has no
 * weekly schedule (the dashboard's `hours` text is then the only source).
 */
export function todayHours(b: Partial<SiteBranch>, at: number = Date.now()): string | null {
  if (b.comingSoon || b.hoursMode !== 'auto') return null;
  const wins = windowsOf(b, ksaNow(at).day);
  if (!wins.length) return 'اليوم: مغلق';
  return `اليوم ${wins.map((w) => `${arTime(w.f)}–${arTime(w.t)}`).join('، ')}`;
}

/**
 * Display order, from the homepage: the main branch first, then open branches,
 * then «coming soon» last. RTDB returns the branches as an object whose keys
 * read alphabetically (go, main, sail), which put a coming-soon branch at the
 * top of the website once — so never rely on key order. `order` breaks ties.
 */
export function sortBranches<T extends Pick<SiteBranch, 'id' | 'comingSoon' | 'order'>>(list: T[]): T[] {
  const rank = (b: T) => (b.id === 'main' ? 0 : b.comingSoon ? 2 : 1);
  return list.slice().sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d) return d;
    return (a.order != null ? Number(a.order) : 99) - (b.order != null ? Number(b.order) : 99);
  });
}

/** Great-circle distance in kilometres. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * The nearest branch a customer can actually go to.
 *
 * The website's «خذني للأقرب» filters out coming-soon branches first: it sends
 * the customer to their car, and without the filter someone south of Taif was
 * routed to a door that has never opened.
 */
export function nearestBranch<T extends Pick<SiteBranch, 'lat' | 'lng' | 'comingSoon'>>(
  list: T[],
  lat: number,
  lng: number,
): { branch: T; km: number } | null {
  let best: { branch: T; km: number } | null = null;
  for (const b of list) {
    if (b.comingSoon || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
    const km = distanceKm(lat, lng, b.lat, b.lng);
    if (!best || km < best.km) best = { branch: b, km };
  }
  return best;
}

// ── Sun Ray Go menu gate ────────────────────────────────────────────────────

export interface WeekGate {
  open: boolean;
  /** Closing time of the current window, when open. */
  until: string | null;
  /** A break or force-close reason, when there is one. */
  msg?: string;
  /** Next opening within a week, when closed. `k` = days from today. */
  next?: { k: number; day: number; f: string };
}

/**
 * `weekState` from the Go menu page. Unlike the homepage it checks yesterday's
 * windows for a tail past midnight: 01:00 on Saturday belongs to Friday's
 * 13:00–02:00 window, not Saturday's. It also works out when the window next
 * opens, so a closed menu can say «نفتح اليوم الساعة ٦ص» rather than just «مغلق».
 */
export function weekGate(b: Partial<SiteBranch>, at: number = Date.now()): WeekGate {
  const now = ksaNow(at);
  let until: string | null = null;
  for (const w of windowsOf(b, now.day)) {
    const a = hmToMin(w.f)!;
    const z = hmToMin(w.t)!;
    if (z > a ? now.min >= a && now.min < z : now.min >= a) {
      until = w.t;
      break;
    }
  }
  if (!until) {
    for (const w of windowsOf(b, (now.day + 6) % 7)) {
      const a = hmToMin(w.f)!;
      const z = hmToMin(w.t)!;
      if (z <= a && now.min < z) {
        until = w.t;
        break;
      }
    }
  }
  const st: WeekGate = { open: !!until, until };
  if (st.open) {
    for (const br of b.breaks ?? []) {
      if (br && inWindow(now.min, br.f, br.t)) {
        st.open = false;
        st.msg = `${br.label || 'إغلاقٌ مؤقّت'} (${arTime(br.f)}–${arTime(br.t)})`;
        st.next = { k: 0, day: now.day, f: br.t };
        break;
      }
    }
    return st;
  }
  let best = Infinity;
  for (let k = 0; k <= 7; k++) {
    const day = (now.day + k) % 7;
    for (const x of windowsOf(b, day)) {
      const rel = k * 1440 + hmToMin(x.f)! - now.min;
      if (rel > 0 && rel < best) {
        best = rel;
        st.next = { k, day, f: x.f };
      }
    }
  }
  return st;
}

/** Daily `{from, to}` fallback (`store/config/goMenu/hours`), crossing midnight. */
export function dailyGate(hours: { from?: string; to?: string } | null | undefined, at: number = Date.now()): WeekGate | null {
  const f = hmToMin(hours?.from);
  const t = hmToMin(hours?.to);
  if (f == null || t == null) return null;
  const { min } = ksaNow(at);
  const open = t > f ? min >= f && min < t : min >= f || min < t;
  return { open, until: open ? hours!.to! : null };
}

export const DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** «نفتح اليوم الساعة ٦ص» / «غداً» / «يوم الجمعة». */
export function nextOpenText(next: WeekGate['next']): string {
  if (!next) return '';
  const t = arTime(next.f);
  if (next.k === 0) return `نفتح اليوم الساعة ${t}`;
  if (next.k === 1) return `نفتح غداً الساعة ${t}`;
  return `نفتح يوم ${DAY_AR[next.day]} الساعة ${t}`;
}
