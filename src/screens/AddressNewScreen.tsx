import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { spacing } from '@/theme';
import { Button, Header, OptionChip, ScreenContainer, TextField, Txt } from '@/components';
import type { AddressLabel } from '@/types';
import { colors } from '@/theme';
import { useAddressStore, toast } from '@/store';

const LABELS: { id: AddressLabel; label: string }[] = [
  { id: 'home', label: 'المنزل' },
  { id: 'work', label: 'العمل' },
  { id: 'other', label: 'أخرى' },
];

export function AddressNewScreen() {
  const add = useAddressStore((s) => s.add);
  const [label, setLabel] = useState<AddressLabel>('home');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  const onSave = () => {
    if (!details.trim()) {
      toast('أدخل تفاصيل العنوان');
      return;
    }
    add({ label, titleAr: title || LABELS.find((l) => l.id === label)!.label, detailsAr: details });
    toast('تمت إضافة العنوان ☀');
    router.back();
  };

  return (
    <ScreenContainer
      header={<Header showBack title="إضافة عنوان" />}
      footer={<Button label="حفظ العنوان" variant="gold" onPress={onSave} />}
    >
      <View style={{ paddingTop: spacing.lg }}>
        <Txt size={14} weight="extraBold" color={colors.ink} style={{ marginBottom: spacing.md }}>
          نوع العنوان
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.xl }}>
          {LABELS.map((l) => (
            <OptionChip key={l.id} label={l.label} selected={label === l.id} onPress={() => setLabel(l.id)} block />
          ))}
        </View>

        <TextField label="اسم العنوان" placeholder="مثال: منزل العائلة" value={title} onChangeText={setTitle} containerStyle={{ marginBottom: spacing.lg }} />
        <TextField
          label="تفاصيل العنوان"
          placeholder="الحي، الشارع، رقم المبنى…"
          value={details}
          onChangeText={setDetails}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
      </View>
    </ScreenContainer>
  );
}
