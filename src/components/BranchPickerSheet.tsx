import { Pressable, ScrollView, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { useBranchStore } from '@/store';
import { Txt } from './Txt';
import { Icon } from './icons/Icon';
import { Sheet } from './Sheet';

export interface BranchPickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function BranchPickerSheet({ visible, onClose }: BranchPickerSheetProps) {
  const branches = useBranchStore((s) => s.branches);
  const selectedId = useBranchStore((s) => s.selectedBranchId);
  const selectBranch = useBranchStore((s) => s.selectBranch);
  const closedReason = useBranchStore((s) => s.closedReason);

  return (
    <Sheet visible={visible} onClose={onClose} title="اختر الفرع">
      {/*
        No «nearest branch» row and no distance: the app reads no location, and
        the only distance it had was a hardcoded 0 shown to everyone as «٠.٠ كم».
      */}
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
                backgroundColor: selected ? colors.bgWarm : 'transparent',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: selected ? colors.chipGoldStrong : colors.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="store" size={22} />
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
                {!b.isOpen && closedReason ? (
                  // Say why here, not first at checkout after a whole cart.
                  <Txt size={10} color={colors.textFaint} style={{ maxWidth: 160 }}>
                    {closedReason}
                  </Txt>
                ) : null}
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
