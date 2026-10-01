import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  CategoryPill,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  MenuSkeleton,
  ProductImage,
  ScreenContainer,
  Txt,
} from '@/components';
import { subscribeGoMenu, type GoMenuState } from '@/services/storeGoMenu';
import { buildGoMenu, goGate, type GoItem } from '@/utils/goMenu';

/**
 * «منيو Sun Ray Go» — the drive-thru menu, to browse.
 *
 * There is no ordering here, deliberately. Go takes orders at the car window
 * only («فقط طلبات سيارة… مو عن طريق المتجر الإلكتروني»); the online store and
 * its arrival check are tied to the Halqa branch, so an «add to cart» on this
 * screen would send a Go customer's order to a different branch.
 *
 * Grouping, prices and the open/closed gate are the website's, ported in
 * `utils/goMenu.ts`. When the menu is closed — switched off while being edited,
 * or outside Go's hours — the items are not shown at all, only the reason and
 * when it opens, as on sunray.sa: a customer reading a menu at 4 a.m. should
 * not plan a drive to a shut window.
 */
export function GoMenuScreen() {
  const [state, setState] = useState<GoMenuState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => subscribeGoMenu(setState), []);
  // The gate turns with the clock, not with the data.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const tabs = useMemo(() => (state?.ready ? buildGoMenu(state) : []), [state]);
  const gate = useMemo(() => (state ? goGate(state, now) : null), [state, now]);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  const header = <Header showBack title="منيو Sun Ray Go" subtitle="درايف ثرو — الطلب من نافذة السيارة" />;

  if (gate?.kind === 'updating') {
    return (
      <ScreenContainer header={header}>
        <ClosedPanel title="منيو Sun Ray Go قيد التحديث" lines={[gate.note]} />
      </ScreenContainer>
    );
  }
  if (gate?.kind === 'closed') {
    return (
      <ScreenContainer header={header}>
        <ClosedPanel
          title="Sun Ray Go مغلقٌ الآن"
          lines={[gate.msg, gate.next, gate.hours ? `أوقات العمل: ${gate.hours}` : ''].filter(Boolean)}
        />
      </ScreenContainer>
    );
  }

  if (!state || (!state.ready && !state.failed)) {
    return (
      <ScreenContainer header={header}>
        <MenuSkeleton />
      </ScreenContainer>
    );
  }
  if (!state.ready && state.failed) {
    return (
      <ScreenContainer header={header}>
        <ErrorState message="تعذّر تحميل المنيو، تحقّق من الاتصال وحاول مجدداً" />
      </ScreenContainer>
    );
  }
  if (!tabs.length || !current) {
    return (
      <ScreenContainer header={header}>
        <EmptyState icon="car" title="المنيو قيد التجهيز" subtitle="نراكم قريباً في Sun Ray Go" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      header={
        <View>
          {header}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
          >
            {tabs.map((t) => (
              <CategoryPill
                key={t.key}
                label={t.title}
                icon={t.icon}
                active={t.key === current.key}
                goldActive
                onPress={() => setActive(t.key)}
              />
            ))}
          </ScrollView>
        </View>
      }
    >
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing['4xl'], gap: spacing.md }}>
        {gate?.kind === 'open' && gate.until ? (
          <View
            style={{
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.successSoft,
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
            <Txt size={12} weight="extraBold" color={colors.success}>
              {`مفتوح الآن · حتى ${gate.until}`}
            </Txt>
          </View>
        ) : null}

        {current.sections.map((s, i) => (
          <View key={`${current.key}-${i}`} style={{ gap: 10 }}>
            {s.title ? (
              <Txt size={16} weight="black" color={colors.ink} style={{ marginTop: i ? spacing.sm : 0 }}>
                {s.title}
              </Txt>
            ) : null}
            {s.items.map((item) => (
              <GoRow key={item.id} item={item} />
            ))}
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

function GoRow({ item }: { item: GoItem }) {
  return (
    <Card radiusKey="md" padding={10}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <View style={{ width: 72 }}>
          <ProductImage icon={item.icon} image={item.image} height={72} iconSize={34} radiusKey="sm" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Txt size={14} weight="extraBold" color={colors.ink}>
              {item.name}
            </Txt>
            {item.isNew ? (
              <View style={{ backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 }}>
                <Txt size={10} weight="extraBold" color={colors.inkDeep}>
                  جديد
                </Txt>
              </View>
            ) : null}
          </View>
          {item.desc ? (
            <Txt size={12} color={colors.textMuted} numberOfLines={2} style={{ marginTop: 2, lineHeight: 18 }}>
              {item.desc}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
            <Txt size={13} weight="black" color={colors.goldDeep}>
              {item.price || 'يختلف السعر حسب نوع المحصول'}
            </Txt>
            {item.calories ? (
              <Txt size={11} color={colors.textFaint}>
                {item.calories}
              </Txt>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

function ClosedPanel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View style={{ paddingTop: spacing['3xl'] }}>
      <Card radiusKey="xl" padding={spacing['2xl']} style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.chipGold,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="car" size={44} />
        </View>
        <Txt size={18} weight="black" color={colors.ink} center style={{ marginTop: spacing.md }}>
          {title}
        </Txt>
        {lines.map((l) => (
          <Txt key={l} size={13} color={colors.textMuted} center style={{ marginTop: 6, lineHeight: 21 }}>
            {l}
          </Txt>
        ))}
        <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>
          <Button label="تصفّح منيو الحلقة" variant="outline" onPress={() => router.push('/(tabs)/menu')} />
        </View>
      </Card>
    </View>
  );
}
