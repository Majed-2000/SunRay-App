import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Header, Icon, ScreenContainer, Spinner, Txt } from '@/components';
import { toast } from '@/store';
import { toArabicDigits } from '@/utils/numerals';
import {
  branchStatusOf,
  nearestBranch,
  sortBranches,
  todayHours,
  type SiteBranch,
} from '@/utils/branchStatus';
import {
  BRANCH_SERVICES,
  DEFAULT_BRANCHES,
  branchDesc,
  directionsUrl,
  placeUrl,
  subscribeBranches,
} from '@/services/storeSite';

/** How long to wait for a GPS fix before giving up and saying so. */
const LOCATION_TIMEOUT_MS = 10_000;

/**
 * «فروعنا» — every branch with its live status, today's hours and directions.
 *
 * The list and the rules come from the website (`sunray/siteConfig/branches`
 * and `branchStatusOf`, ported in `utils/branchStatus.ts`), so this screen and
 * sunray.sa always agree on whether a branch is open.
 *
 * Status changes with the clock, not with the data — a branch that closes at
 * 02:00 sends no update at 02:00 — so the screen re-evaluates every minute while
 * it is open, as the homepage does.
 *
 * ## Location is asked for only on the button
 *
 * «أقرب فرع» is the one thing here that needs the customer's position, so the
 * permission prompt appears when they press it and at no other time. Opening a
 * list of branches is not a reason to ask where someone is.
 */
export function BranchesScreen() {
  const [branches, setBranches] = useState<SiteBranch[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [locating, setLocating] = useState(false);
  const [nearest, setNearest] = useState<{ id: string; km: number } | null>(null);
  const [distances, setDistances] = useState<Record<string, number>>({});

  useEffect(() => subscribeBranches((list) => setBranches(list)), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const visible = useMemo(() => {
    const list = (branches ?? []).filter((b) => b.visible !== false);
    // An empty list from the dashboard would leave nothing to show; the
    // homepage falls back to its defaults in that case, and so does this.
    return sortBranches(list.length ? list : branches ? DEFAULT_BRANCHES : []);
  }, [branches]);

  const findNearest = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast('لم نتمكن من معرفة موقعك — اسمح بالوصول للموقع من الإعدادات');
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
      ]);
      if (!pos) {
        toast('تعذّر تحديد موقعك الآن، حاول مرة أخرى');
        return;
      }
      const { latitude, longitude } = pos.coords;
      const best = nearestBranch(visible, latitude, longitude);
      if (!best) {
        toast('لا يوجد فرع مفتوح للزيارة حالياً');
        return;
      }
      const d: Record<string, number> = {};
      for (const b of visible) {
        const one = nearestBranch([b], latitude, longitude);
        if (one) d[b.id] = one.km;
      }
      setDistances(d);
      setNearest({ id: best.branch.id, km: best.km });
    } catch {
      toast('تعذّر تحديد موقعك الآن، حاول مرة أخرى');
    } finally {
      setLocating(false);
    }
  };

  const nearestBranchObj = nearest ? visible.find((b) => b.id === nearest.id) : undefined;

  return (
    <ScreenContainer header={<Header showBack title="فروعنا" subtitle="الحالة والأوقات تتحدّث مباشرة" />}>
      <View style={{ paddingTop: spacing.md, paddingBottom: spacing['4xl'], gap: spacing.md }}>
        <Card radiusKey="lg">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.chipGold,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="pin" size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="extraBold" color={colors.ink}>
                {nearestBranchObj ? `الأقرب إليك: ${nearestBranchObj.name}` : 'أقرب فرع إليك'}
              </Txt>
              <Txt size={12} color={colors.textMuted} style={{ marginTop: 2 }}>
                {nearestBranchObj && nearest
                  ? `على بُعد ${formatKm(nearest.km)}`
                  : 'نستخدم موقعك مرة واحدة فقط عند الضغط'}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                label={nearestBranchObj ? 'حدّث موقعي' : 'حدّد أقرب فرع'}
                variant={nearestBranchObj ? 'outline' : 'gold'}
                size="sm"
                loading={locating}
                onPress={() => void findNearest()}
              />
            </View>
            {nearestBranchObj ? (
              <View style={{ flex: 1 }}>
                <Button
                  label="خذني إليه"
                  variant="gold"
                  size="sm"
                  onPress={() => void Linking.openURL(directionsUrl(nearestBranchObj))}
                />
              </View>
            ) : null}
          </View>
        </Card>

        {branches === null ? (
          <Spinner label="نجلب الفروع…" />
        ) : (
          visible.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              now={now}
              isNearest={nearest?.id === b.id}
              km={distances[b.id]}
            />
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

function BranchCard({
  branch: b,
  now,
  isNearest,
  km,
}: {
  branch: SiteBranch;
  now: number;
  isNearest: boolean;
  km?: number;
}) {
  const s = branchStatusOf(b, now);
  const today = todayHours(b, now);
  const dot = s.soon ? colors.textFaint : s.open ? colors.success : colors.danger;
  const services = BRANCH_SERVICES[b.id] ?? [];
  const desc = branchDesc(b);

  return (
    <Card
      radiusKey="lg"
      style={{
        borderWidth: isNearest ? 2 : 0,
        borderColor: colors.gold,
        opacity: s.soon ? 0.85 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.chipGold,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={b.id === 'go' ? 'car' : b.comingSoon ? 'sparkle' : 'sun'} size={28} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Txt size={16} weight="black" color={colors.ink}>
              {b.name}
            </Txt>
            {s.soon ? <Badge label="قريباً" /> : null}
            {isNearest ? <Badge label="الأقرب إليك" gold /> : null}
          </View>
          {desc ? (
            <Txt size={12} color={colors.textMuted} style={{ marginTop: 2 }}>
              {desc}
            </Txt>
          ) : null}
        </View>
        {km != null && !s.soon ? (
          <Txt size={12} weight="bold" color={colors.goldDeep}>
            {formatKm(km)}
          </Txt>
        ) : null}
      </View>

      {services.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
          {services.map((x) => (
            <View
              key={x}
              style={{
                backgroundColor: colors.chip,
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Txt size={11} weight="bold" color={colors.textSecondary}>
                {x}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} />
          <Txt size={13} weight="extraBold" color={s.soon ? colors.textMuted : s.open ? colors.success : colors.danger}>
            {s.msg}
          </Txt>
          {today ? (
            <Txt size={12} color={colors.textMuted}>
              {` · ${today}`}
            </Txt>
          ) : null}
        </View>
        {b.hours ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={colors.textFaint} />
            <Txt size={12} color={colors.textFaint} style={{ flex: 1, lineHeight: 18 }}>
              {b.hours}
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Pressable
          onPress={() => void Linking.openURL(s.soon ? placeUrl(b) : directionsUrl(b))}
          accessibilityRole="link"
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 44,
            borderRadius: radius.md,
            backgroundColor: s.soon ? colors.chip : colors.gold,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name={s.soon ? 'location-outline' : 'navigate'} size={16} color={colors.inkDeep} />
          <Txt size={14} weight="extraBold" color={colors.inkDeep}>
            {s.soon ? 'الموقع على الخريطة' : 'الاتجاهات'}
          </Txt>
        </Pressable>
        {!s.soon ? (
          <Pressable
            onPress={() => void Linking.openURL(placeUrl(b))}
            accessibilityRole="link"
            accessibilityLabel="افتح في خرائط قوقل"
            style={({ pressed }) => ({
              width: 48,
              minHeight: 44,
              borderRadius: radius.md,
              backgroundColor: colors.chip,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="map-outline" size={18} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function Badge({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: gold ? colors.gold : colors.chip,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Txt size={10} weight="extraBold" color={colors.inkDeep}>
        {label}
      </Txt>
    </View>
  );
}

function formatKm(km: number): string {
  if (km < 1) return `${toArabicDigits(Math.max(50, Math.round((km * 1000) / 50) * 50))} م`;
  return `${toArabicDigits(km < 10 ? km.toFixed(1) : Math.round(km))} كم`;
}
