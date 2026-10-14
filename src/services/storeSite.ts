/**
 * The website's public configuration — branches and the customer photo strip.
 *
 * `sunray/siteConfig/*` is what the dashboard's «مركز التحكّم» edits: which
 * branches show, their hours and emergency closures, and the «لقطاتكم» photos.
 * It is world-readable on purpose (the homepage reads it before anyone signs
 * in), so the app reads it the same way and never needs a session for it.
 *
 * Both reads are **live listeners**, like the website's `.on('value')`, not
 * one-off gets. The owner asked for changes to reach open screens at once
 * («علطول التحديث يكون فوري»): a branch force-closed from the dashboard must stop
 * saying «نستقبلكم الآن» to someone already looking at it. The nodes are small
 * (three branches, ten photo links) and only travel again when they change.
 *
 * Each subscriber listens to its own child path, not to `sunray/siteConfig` as
 * the homepage does — the app has no use for the analytics counters and button
 * flags that live beside them.
 */
import { onValue, ref } from 'firebase/database';
import { db } from './firebase';
import type { SiteBranch } from '@/utils/branchStatus';

/**
 * Fallback when the read fails, copied from the homepage's `DEFAULT_BRANCHES`.
 *
 * The names stay in English by the owner's decision («Sun Ray Halqa», «Sun Ray
 * Go», «Sun Ray Grove») — do not translate them.
 */
export const DEFAULT_BRANCHES: SiteBranch[] = [
  {
    id: 'main',
    name: 'Sun Ray Halqa',
    lat: 21.3425149,
    lng: 40.4401308,
    hours: '٢٤ ساعة يومياً · صيانة ٢–٣ فجراً · الجمعة مغلق ١١ص–١:٣٠م',
    visible: true,
  },
  {
    id: 'sail',
    name: 'Sun Ray Grove',
    lat: 21.4086,
    lng: 40.4435,
    hours: 'تُعلَن أوقات العمل قريباً',
    visible: true,
    comingSoon: true,
  },
  {
    id: 'go',
    name: 'Sun Ray Go',
    lat: 21.2311437,
    lng: 40.3781914,
    hours: 'السبت–الخميس ٦ص–٢ص · الجمعة ١م–٢ص',
    visible: true,
    hoursMode: 'auto',
    week: {
      '0': [{ f: '06:00', t: '02:00' }],
      '1': [{ f: '06:00', t: '02:00' }],
      '2': [{ f: '06:00', t: '02:00' }],
      '3': [{ f: '06:00', t: '02:00' }],
      '4': [{ f: '06:00', t: '02:00' }],
      '5': [{ f: '13:00', t: '02:00' }],
      '6': [{ f: '06:00', t: '02:00' }],
    },
  },
];

/**
 * Short area line under each name. Lives in code on the website too
 * (`BRANCH_DESC`); a `desc` written in the database replaces it.
 */
const BRANCH_DESC: Record<string, string> = {
  main: 'الطائف — الحلقة الغربية',
  go: 'الطائف — حي الوسام · الطريق الدائري · ساحة درب',
  sail: 'الطائف — السيل',
};

/** Service chips under each branch, from the homepage's `BRANCH_CHIPS`. */
export const BRANCH_SERVICES: Record<string, string[]> = {
  main: ['جلسات داخل المقهى', 'استلام', 'خدمة السيارة'],
  go: ['درايف ثرو', 'الطلب من نافذة السيارة'],
};

/** The Google Maps place page (name, rating, photos) where we have one. */
const BRANCH_PLACE: Record<string, string> = {
  go: 'https://maps.google.com/?cid=12497428300964078629',
};

/**
 * The database may still hold the main branch's old Arabic name. The homepage
 * rewrites **only that legacy name** at display time and respects any other
 * name the dashboard writes; this is the same pattern.
 */
const LEGACY_MAIN_NAME_RX =
  /^\s*(sun\s*ray\s*[—-]\s*)?(الفرع\s*(الأساسي|الرئيسي)(\s*\(\s*الحلقة\s*\))?|فرع\s*الحلقة(\s*الغربية)?)\s*$/i;

export function branchDesc(b: SiteBranch): string {
  return b.desc || BRANCH_DESC[b.id] || '';
}

/** Turn-by-turn directions to the branch, in the Maps app or the browser. */
export function directionsUrl(b: Pick<SiteBranch, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
}

/** The branch's page on Google Maps, falling back to a pin on its coordinates. */
export function placeUrl(b: SiteBranch): string {
  return b.placeUrl || BRANCH_PLACE[b.id] || `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
}

function normalise(raw: unknown): SiteBranch[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((v, i) => [String(i), v])
    : Object.entries(raw as Record<string, unknown>);
  const list = entries
    .filter(([, v]) => v && typeof v === 'object')
    .map(([k, v]) => {
      const b = { ...(v as SiteBranch) };
      b.id = b.id || k;
      b.lat = Number(b.lat);
      b.lng = Number(b.lng);
      if (b.id === 'main' && LEGACY_MAIN_NAME_RX.test(String(b.name ?? ''))) b.name = 'Sun Ray Halqa';
      return b;
    });
  /**
   * The database list **replaces** the defaults rather than merging, so a
   * coming-soon branch announced only in code would vanish the moment the
   * config arrived. The homepage appends it back when missing; so do we.
   */
  for (const d of DEFAULT_BRANCHES) {
    if (d.comingSoon && !list.some((b) => b.id === d.id)) list.push(d);
  }
  return list.length ? list : null;
}

/**
 * Live branches. `onChange` gets the full list (hidden ones included — the
 * screen filters `visible === false`), or the defaults when the read fails, so
 * the screen always has something true-ish to show.
 */
export function subscribeBranches(onChange: (branches: SiteBranch[], live: boolean) => void): () => void {
  return onValue(
    ref(db(), 'sunray/siteConfig/branches'),
    (snap) => {
      const list = normalise(snap.val());
      onChange(list ?? DEFAULT_BRANCHES, list != null);
    },
    () => onChange(DEFAULT_BRANCHES, false),
  );
}

/** One customer photo from the dashboard. */
export interface SitePhoto {
  url: string;
  caption?: string;
  at?: number;
}

/** The homepage shows at most ten; more would be a long scroll of thumbnails. */
const MAX_PHOTOS = 10;

/** Live «لقطاتكم» photos. An empty list on failure — the strip then hides. */
export function subscribePhotos(onChange: (photos: SitePhoto[]) => void): () => void {
  return onValue(
    ref(db(), 'sunray/siteConfig/photos'),
    (snap) => {
      const v = snap.val();
      const list = (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []) as SitePhoto[];
      onChange(
        list
          // Only https: the strip loads these straight into <Image>, and the
          // dashboard is a free-text field.
          .filter((p) => p && typeof p.url === 'string' && /^https:\/\//.test(p.url))
          .slice(0, MAX_PHOTOS),
      );
    },
    () => onChange([]),
  );
}
