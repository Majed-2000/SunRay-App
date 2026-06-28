import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { branches } from '@/data';
import { toArabicDigits } from '@/utils/numerals';
import { useBranchStore } from '@/store';
import { Txt } from './Txt';
import { Sheet } from './Sheet';

export interface BranchPickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function BranchPickerSheet({ visible, onClose }: BranchPickerSheetProps) {
  const selectedId = useBranchStore((s) => s.selectedBranchId);
  const selectBranch = useBranchStore((s) => s.selectBranch);
  const selectNearest = useBranchStore((s) => s.selectNearest);

  return (
    <Sheet visible={visible} onClose={onClose} title="اختر الفرع">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: spacing['2xl'],
          paddingVertical: spacing.md,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            backgroundColor: '#e7f4ec',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="locate" size={16} color={colors.success} />
        </View>
        <Txt size={13} weight="bold" color={colors.success} style={{ flex: 1 }}>
          تحديد أقرب فرع تلقائيًا
        </Txt>
        <Pressable
          onPress={() => {
            selectNearest();
            onClose();
          }}
          style={{ backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 }}
        >
          <Txt size={12} weight="extraBold" color={colors.inkDeep}>
            تحديد
          </Txt>
        </Pressable>
      </View>

      <View style={{ height: 1, backgroundColor: colors.borderSoft, marginHorizontal: spacing['2xl'] }} />

      <ScrollView style={{ maxHeight: 340 }}>
        {branches.map((b) => {
          const selected = b.id === selectedId;
          return (
            <Pressable
              key={b.id}
              onPress={() => {
                selectBranch(b.id);
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                paddingHorizontal: spacing['2xl'],
                paddingVertical: 13,
                backgroundColor: selected ? '#fdf6e8' : 'transparent',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: selected ? colors.chipGoldStrong : '#f0ebe1',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={17}>☕</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={14} weight="extraBold" color={colors.ink}>
                  {b.nameAr}
                </Txt>
                <Txt size={11} color={colors.textFaint} style={{ marginTop: 1 }}>
                  {b.addressAr}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Txt size={11} weight="bold" color={b.isOpen ? colors.success : colors.textFaint}>
                  {b.isOpen ? '● مفتوح' : '○ مغلق'}
                </Txt>
                <Txt size={10} color={colors.textFaint}>
                  {toArabicDigits(b.distanceKm.toFixed(1))} كم
                </Txt>
                {selected ? (
                  <Txt size={12} weight="black" color={colors.gold}>
                    ✦ محدد
                  </Txt>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
