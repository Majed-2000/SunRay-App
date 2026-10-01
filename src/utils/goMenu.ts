/**
 * The Sun Ray Go (drive-thru) menu, built the way sunray.sa builds it.
 *
 * Ported from the website's `go-menu.js`. Go has no menu of its own: the items
 * are `menu/products` — the same Foodics-synced rows the Halqa menu reads, so a
 * price changed there changes here at once — filtered and ordered by
 * `menu/driveThru`, a list of product ids the menu team edits from the
 * dashboard. Nothing is marked on the product itself because the Foodics sync
 * overwrites products.
 *
 * Every rule below is a display decision the owner made on the website (dates in
 * the website's comments), copied so the app shows the customer at the window
 * the same thing the website does. They are hard-coded there too; when one
 * changes on the website it must change here.
 *
 * This is a browsing menu: Go takes orders at the car window only, never online,
 * and the store's order path and arrival geofence are tied to the Halqa branch.
 *
 * Pure: no Firebase, no React. `services/storeGoMenu.ts` feeds it.
 */
import type { IconName } from '@/components/icons/glyphs';
import { formatRiyal } from './numerals';
import {
  arTime,
  dailyGate,
  nextOpenText,
  type SiteBranch,
  type WeekGate,
  weekGate,
} from './branchStatus';

/** A `menu/products` row, only the fields this menu reads. */
export interface GoProduct {
  name?: string;
  nameEn?: string;
  desc?: string;
  section?: string;
  tier?: string;
  active?: boolean;
  isNew?: boolean;
  newSince?: number;
  createdAt?: number;
  image?: string | null;
  price?: number;
  priceHalalas?: number | null;
  methodPriceHalalas?: Record<string, number> | null;
  calories?: number | { min?: number; max?: number } | null;
  crop?: { nameAr?: string; nameEn?: string } | null;
}

/** A `menu/driveThru/<id>` row. */
export interface GoEntry {
  order?: number;
  /** `false` hides the item at Go only. Absent is NOT hidden. */
  avail?: boolean;
  /** A Go-only price, published by the sync only when it differs. */
  priceHalalas?: number | null;
}

/** `store/config/goMenu`. */
export interface GoConfig {
  /** Closed to customers while the menu is being edited. Beats every schedule. */
  closed?: boolean;
  note?: string;
  /** Old daily hours; a fallback only when the weekly schedule is missing. */
  hours?: { from?: string; to?: string };
}

export interface GoMenuInput {
  products: Record<string, GoProduct>;
  driveThru: Record<string, GoEntry>;
  config: GoConfig | null;
  /** `sunray/siteConfig/branches/go`. */
  branch: Partial<SiteBranch> | null;
  /** True once the branch read answered (or failed). Before it, never close on hours. */
  branchReady: boolean;
  /** `menu/sections/_new/order`. */
  newOrder: string[];
}

export interface GoItem {
  id: string;
  name: string;
  desc: string;
  image: string | null;
  icon: IconName;
  /** Formatted price line, or '' when the price depends on the bean chosen. */
  price: string;
  calories: string;
  isNew: boolean;
}

export interface GoSection {
  title?: string;
  items: GoItem[];
}

export interface GoTab {
  key: string;
  title: string;
  icon: IconName;
  sections: GoSection[];
}

export type GoGate =
  | { kind: 'updating'; note: string }
  | { kind: 'closed'; msg: string; next: string; hours: string }
  | { kind: 'open'; until: string | null };

const TODAY_IDS = ['cod_small', 'cod_large'];

interface TabDef {
  key: string;
  title: string;
  icon: IconName;
  secs?: string[];
  ids?: string[];
}

/** The tabs, names and order as the website shows them at the car window. */
const TABS: TabDef[] = [
  { key: 'pourover', title: 'القهوة المقطرة', icon: 'pourover', secs: ['pouroverSection'] },
  {
    key: 'espresso',
    title: 'الإسبريسو',
    icon: 'cup-hot',
    secs: ['beans_espresso_premium', 'beans_espresso_classic'],
    ids: ['espresso_classic', 'espresso_freddo'],
  },
  { key: 'today', title: 'قهوة اليوم', icon: 'cup-hot', ids: TODAY_IDS },
  { key: 'drinks', title: 'مشروبات باردة وحارة', icon: 'cup-iced', secs: ['hotDrinks', 'coldDrinks'] },
  { key: 'matcha', title: 'ماتشا', icon: 'matcha', secs: ['matchaSection'] },
  /**
   * Breakfast at Go is these five items by id, no section: the rest of
   * `healthyBreakfast` stays off the drive-thru.
   */
  {
    key: 'breakfast',
    title: 'الفطور',
    icon: 'sandwich',
    ids: ['sandwich_halloumi', 'sandwich_tuna', 'sandwich_turkey', 'juice_orange', 'juice_beetroot'],
  },
  { key: 'desserts', title: 'حلويات', icon: 'dessert', secs: ['desserts'] },
  { key: 'crops', title: 'منتجات إضافية', icon: 'beans', secs: ['extras'] },
];

const NEW_TAB = { key: 'new', title: 'جديدنا', icon: 'sparkle' as IconName };
/** «جديد» at Go only — an `isNew` flag on the product would show it at Halqa too. */
const GO_NEW_EXTRA = ['قولدن_راي_قطعتين'];

/** Which beans each cup offers at the window: classic, plus two premium ones for V60. */
const GO_CROP_RULE: Record<string, { tiers: string[]; ids: string[] }> = {
  pourover: { tiers: ['classic'], ids: ['po_yem', 'po_col_redwine'] },
  espresso: { tiers: ['classic'], ids: [] },
};

/** The only desserts sold at Go. A new dessert in Foodics stays hidden until added here. */
const GO_DESSERTS_ALLOW = [
  'berry_cheesecake__desserts',
  'pudding_hot_cold',
  'cookies_classic',
  'تربل_شوكلت_كوكيز',
  'crunchy_bites',
  'mini_cookies',
  'قولدن_راي_قطعتين',
];

/** Go-only display prices in riyals. Never written back to `menu/products` or Foodics. */
const GO_PRICE_OVERRIDE: Record<string, number> = { cod_small: 7, cod_large: 9, 'قولدن_راي_قطعتين': 7 };

/** Cup names from the website's `v60.html` / `espresso.html`. */
const CUP_NAME: Record<string, string> = {
  v60_hot: 'قهوة مقطرة (حار)',
  v60_cold: 'قهوة مقطرة (بارد)',
  espresso_classic: 'إسبريسو',
  espresso_freddo: 'إسبريسو فريدو',
  creamy_espresso: 'إسبريسو كريمي',
};
const CUP_METHOD: Record<string, string> = {
  v60_hot: 'hot',
  v60_cold: 'cold',
  espresso_classic: 'classic',
  espresso_freddo: 'freddo',
};

const SECTION_ICON: Record<string, IconName> = {
  pouroverSection: 'pourover',
  beans_espresso_premium: 'beans',
  beans_espresso_classic: 'beans',
  matchaSection: 'matcha',
  healthyBreakfast: 'sandwich',
  hotDrinks: 'cup-hot',
  coldDrinks: 'cup-iced',
  desserts: 'dessert',
  extras: 'beans',
};

/** «يمني (فاخر)» → «يمني». The window shows no premium/classic wording. */
const TIER_SUFFIX_RE = /\s*[(（]\s*(?:فاخر|كلاسيك|إسبريسو كلاسيك|اسبريسو كلاسيك)\s*[)）]\s*/g;
export function cleanName(n: unknown): string {
  return String(n ?? '').replace(TIER_SUFFIX_RE, ' ').replace(/\s+/g, ' ').trim();
}
const TIER_WORD_RE = /\s*(?:ال)?(?:فاخر(?:ة|ين)?|كلاسيك(?:ي|ية|يّة)?)(?=[\s،,.!؟:؛)\-—]|$)/g;
function cleanDesc(s: unknown): string {
  return String(s ?? '')
    .replace(TIER_WORD_RE, '')
    .replace(/\s+([،,.!؟:؛])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isMatcha(id: string, v: GoProduct): boolean {
  if (v.section === 'matchaSection') return true;
  // Only from the drinks sections — a matcha-flavoured breakfast item stays put.
  if (v.section !== 'hotDrinks' && v.section !== 'coldDrinks') return false;
  return /matcha/i.test(id) || /ماتشا/.test(String(v.name ?? ''));
}

/** The tab an item belongs to. Order matters: matcha, then explicit ids, then section. */
export function tabOf(id: string, v: GoProduct): string | null {
  if (isMatcha(id, v)) return 'matcha';
  if (TODAY_IDS.includes(id)) return 'today';
  for (const t of TABS) if (t.ids?.includes(id)) return t.key;
  for (const t of TABS) if (t.secs?.includes(v.section ?? '')) return t.key;
  return null;
}

/** A bean shown as a crop card (its own price per method), not as a cup. */
function isCrop(v: GoProduct): boolean {
  if (!v.crop || v.tier === 'base') return false;
  return ['pouroverSection', 'extras', 'beans_espresso_premium', 'beans_espresso_classic'].includes(v.section ?? '');
}

function finite(n: unknown): n is number {
  return n != null && Number.isFinite(Number(n));
}

/**
 * Price in riyals: Go override → Go branch price → product halalas → product
 * riyals. `!= null`, not truthiness: 0 is a real price.
 */
export function priceOf(id: string, v: GoProduct | undefined, dt: GoEntry | undefined): number | null {
  if (GO_PRICE_OVERRIDE[id] != null) return GO_PRICE_OVERRIDE[id];
  if (dt && finite(dt.priceHalalas)) return Number(dt.priceHalalas) / 100;
  if (!v) return null;
  if (finite(v.priceHalalas)) return Number(v.priceHalalas) / 100;
  if (finite(v.price)) return Number(v.price);
  return null;
}

function methodPrice(id: string, v: GoProduct, dt: GoEntry | undefined, m: string): number | null {
  if (dt && finite(dt.priceHalalas)) return Number(dt.priceHalalas) / 100;
  const mp = v.methodPriceHalalas?.[m];
  if (finite(mp)) return Number(mp) / 100;
  return priceOf(id, v, dt);
}

function caloriesOf(v: GoProduct): string {
  const c = v.calories;
  if (!c) return '';
  if (typeof c === 'number') return `${formatRiyal(c, false)} سعرة`;
  if (c.min != null && c.max != null && c.min !== c.max) {
    return `${formatRiyal(c.min, false)}–${formatRiyal(c.max, false)} سعرة`;
  }
  const one = c.max ?? c.min;
  return one != null ? `${formatRiyal(one, false)} سعرة` : '';
}

/** The gate: being updated, closed by schedule, or open (until when). */
export function goGate(input: Pick<GoMenuInput, 'config' | 'branch' | 'branchReady'>, at: number = Date.now()): GoGate {
  const { config, branch, branchReady } = input;
  if (config?.closed === true) {
    return {
      kind: 'updating',
      note: String(config.note ?? '').slice(0, 160) || 'نُجهّزه الآن ليكون أوضح وأسرع — نعود قريباً جداً',
    };
  }
  const hoursText = branch?.hours ? String(branch.hours) : '';
  const f = branch?.force;
  if (f?.on && (!f.until || Number(f.until) > at)) {
    return { kind: 'closed', msg: String(f.msg || 'مغلق مؤقتاً'), next: '', hours: hoursText };
  }
  let st: WeekGate | null = null;
  if (branch?.hoursMode === 'auto' && branch.week && typeof branch.week === 'object') st = weekGate(branch, at);
  // Until the weekly schedule has answered, never close on the old daily hours:
  // they said 16:00 and would flash «مغلق» every morning while the window is open.
  else if (branchReady) {
    st = dailyGate(config?.hours, at);
    if (st && !st.open && config?.hours?.from) {
      return {
        kind: 'closed',
        msg: '',
        next: `نفتح يومياً من ${arTime(config.hours.from)} إلى ${arTime(config.hours.to)}`,
        hours: '',
      };
    }
  }
  if (!st || st.open) return { kind: 'open', until: st?.until ? arTime(st.until) : null };
  return { kind: 'closed', msg: st.msg ?? '', next: nextOpenText(st.next), hours: hoursText };
}

/** The tabs with their items. Empty when nothing on the Go list is live. */
export function buildGoMenu(input: GoMenuInput): GoTab[] {
  const P = input.products ?? {};
  const DT = input.driveThru ?? {};

  const isOff = (id: string) => {
    if (DT[id]?.avail === false) return true;
    const v = P[id];
    return !!(v && v.section === 'desserts' && !GO_DESSERTS_ALLOW.includes(id));
  };

  const ids = Object.keys(DT)
    .sort((a, b) => (Number(DT[a]?.order) || 0) - (Number(DT[b]?.order) || 0))
    .filter((id) => P[id] && P[id].active !== false && !isOff(id));

  const newTs = (id: string) => Number(P[id]?.newSince) || Number(P[id]?.createdAt) || 0;
  const newFirst = (list: string[]) =>
    list
      .map((id, i) => ({ id, i, n: P[id]?.isNew === true }))
      .sort((a, b) => {
        if (a.n !== b.n) return a.n ? -1 : 1;
        if (a.n) {
          const d = newTs(b.id) - newTs(a.id);
          if (d) return d;
        }
        return a.i - b.i;
      })
      .map((x) => x.id);

  const byTab: Record<string, string[]> = {};
  for (const id of ids) {
    const k = tabOf(id, P[id]);
    if (k) (byTab[k] ??= []).push(id);
  }
  for (const k of Object.keys(byTab)) byTab[k] = newFirst(byTab[k]);

  const item = (id: string, over: Partial<GoItem> = {}): GoItem => {
    const v = P[id] ?? {};
    const p = priceOf(id, v, DT[id]);
    return {
      id,
      name: CUP_NAME[id] ?? (cleanName(v.name) || 'صنف'),
      desc: cleanDesc(v.desc),
      image: v.image ?? null,
      icon: /gathering|jug/i.test(id) ? 'jug' : (SECTION_ICON[v.section ?? ''] ?? 'cup-hot'),
      // The base cup has no single price: it follows the bean the customer picks.
      price: v.tier === 'base' ? '' : p != null ? formatRiyal(p) : '',
      calories: caloriesOf(v),
      isNew: v.isNew === true || GO_NEW_EXTRA.includes(id),
      ...over,
    };
  };

  /**
   * A cup with beans under it (V60, espresso): the cup shows «من X», the lowest
   * price among the beans allowed for that method, and each bean shows its own
   * price for each method.
   */
  const chooser = (cupIds: string[], crops: string[], methodLabels: [string, string][]): GoSection[] => {
    const cups = cupIds.map((id) => {
      const m = CUP_METHOD[id];
      if (m && crops.length) {
        let ps = crops.map((c) => methodPrice(c, P[c], DT[c], m)).filter((x): x is number => x != null);
        const own = priceOf(id, P[id], DT[id]);
        if (!ps.length && own != null) ps = [own];
        return item(id, { price: ps.length ? `من ${formatRiyal(Math.min(...ps))}` : '' });
      }
      return item(id);
    });
    const beans = crops.map((c) => {
      const parts = methodLabels
        .map(([m, label]) => {
          const p = methodPrice(c, P[c], DT[c], m);
          return p != null ? `${label} ${formatRiyal(p)}` : null;
        })
        .filter(Boolean);
      return item(c, { name: cleanName(P[c]?.crop?.nameAr || P[c]?.name), price: parts.join(' · ') });
    });
    const out: GoSection[] = [];
    if (cups.length) out.push({ items: cups });
    if (beans.length) out.push({ title: 'اختر محصولك', items: beans });
    return out;
  };

  const cropAllowed = (tab: string, id: string) => {
    const r = GO_CROP_RULE[tab];
    if (!r) return true;
    return r.tiers.includes(P[id]?.tier ?? '') || r.ids.includes(id);
  };

  const sectionsFor = (key: string, rows: string[]): GoSection[] => {
    switch (key) {
      case 'pourover': {
        const crops = rows.filter((id) => isCrop(P[id]) && cropAllowed('pourover', id));
        const other = rows.filter((id) => !isCrop(P[id]) && !P[id].tier);
        // The two cups are not on the Go list themselves; the website draws them from products.
        const cups = ['v60_hot', 'v60_cold'].filter((id) => P[id] && P[id].active !== false);
        const s = chooser(cups, crops, [
          ['hot', 'حار'],
          ['cold', 'بارد'],
        ]);
        if (other.length) s.push({ items: other.map((id) => item(id)) });
        return s;
      }
      case 'espresso': {
        const crops = rows.filter((id) => isCrop(P[id]) && cropAllowed('espresso', id));
        const cups = rows.filter((id) => !isCrop(P[id]) && !(P[id].tier && P[id].crop));
        return chooser(cups, crops, [
          ['classic', 'كلاسيك'],
          ['freddo', 'فريدو'],
        ]);
      }
      case 'today':
        return [
          {
            title: 'اختيار اليوم المميز',
            items: TODAY_IDS.filter((id) => rows.includes(id)).map((id) =>
              item(id, { name: id === 'cod_small' ? 'قهوة اليوم — صغير' : 'قهوة اليوم — كبير' }),
            ),
          },
        ];
      case 'drinks': {
        const hot = rows.filter((id) => P[id].section !== 'coldDrinks');
        const cold = rows.filter((id) => P[id].section === 'coldDrinks');
        const s: GoSection[] = [];
        if (hot.length) s.push({ title: 'المشروبات الحارة', items: hot.map((id) => item(id)) });
        if (cold.length) s.push({ title: 'المشروبات الباردة', items: cold.map((id) => item(id)) });
        return s;
      }
      case 'crops': {
        const cr = rows.filter((id) => isCrop(P[id]));
        const ex = rows.filter((id) => !isCrop(P[id]));
        const s: GoSection[] = [];
        if (cr.length) s.push({ title: 'محاصيلنا', items: cr.map((id) => item(id)) });
        if (ex.length) s.push({ title: 'منتجات إضافية', items: ex.map((id) => item(id)) });
        return s;
      }
      default:
        return [{ items: rows.map((id) => item(id)) }];
    }
  };

  const tabs: GoTab[] = [];

  // «جديدنا» first when it has anything: a tab on top of the others, not instead —
  // a new item also stays in its own section's tab.
  const fresh = ids.filter((id) => (P[id].isNew === true || GO_NEW_EXTRA.includes(id)) && tabOf(id, P[id]));
  if (fresh.length) {
    const order = input.newOrder ?? [];
    fresh.sort((a, b) => {
      const ia = order.indexOf(a) === -1 ? 1e6 + ids.indexOf(a) : order.indexOf(a);
      const ib = order.indexOf(b) === -1 ? 1e6 + ids.indexOf(b) : order.indexOf(b);
      return ia - ib;
    });
    tabs.push({ ...NEW_TAB, sections: [{ items: fresh.map((id) => item(id)) }] });
  }

  for (const t of TABS) {
    const rows = byTab[t.key];
    if (!rows?.length) continue;
    const sections = sectionsFor(t.key, rows).filter((s) => s.items.length);
    if (sections.length) tabs.push({ key: t.key, title: t.title, icon: t.icon, sections });
  }
  return tabs;
}
