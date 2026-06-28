import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, EmptyState, Header, ScreenContainer, Txt } from '@/components';
import { useAddressStore, toast } from '@/store';

const LABEL_ICON = { home: 'home', work: 'briefcase', other: 'location' } as const;

export function AddressesScreen() {
  const addresses = useAddressStore((s) => s.addresses);
  const setDefault = useAddressStore((s) => s.setDefault);
  const remove = useAddressStore((s) => s.remove);

  return (
    <ScreenContainer
      header={<Header showBack title="عناويني" />}
      footer={<Button label="+ إضافة عنوان جديد" variant="gold" onPress={() => router.push('/address-new')} />}
    >
      <View style={{ paddingTop: spacing.lg, gap: 12 }}>
        {addresses.length === 0 ? (
          <EmptyState emoji="📍" title="لا توجد عناوين" subtitle="أضف عنوانك لتسهيل التوصيل" />
        ) : (
          addresses.map((a) => (
            <Card key={a.id} radiusKey="lg">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={LABEL_ICON[a.label]} size={20} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt size={15} weight="extraBold" color={colors.ink}>
                      {a.titleAr}
                    </Txt>
                    {a.isDefault ? (
                      <View style={{ backgroundColor: colors.chipGold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Txt size={10} weight="extraBold" color={colors.terracotta}>
                          الافتراضي
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                  <Txt size={12} color={colors.textFaint} style={{ marginTop: 2 }}>
                    {a.detailsAr}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
                {!a.isDefault ? (
                  <Txt size={13} weight="bold" color={colors.terracotta} onPress={() => setDefault(a.id)}>
                    تعيين كافتراضي
                  </Txt>
                ) : null}
                <Txt
                  size={13}
                  weight="bold"
                  color={colors.danger}
                  onPress={() => {
                    remove(a.id);
                    toast('تم حذف العنوان');
                  }}
                >
                  حذف
                </Txt>
              </View>
            </Card>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}
