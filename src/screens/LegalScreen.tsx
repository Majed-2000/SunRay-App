import { Linking, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Card, EmptyState, Header, ScreenContainer, Txt } from '@/components';
import { toast } from '@/store';
import { isLegalDocId, legalDocs, type LegalBlock } from '@/data/legal';
import { LEGAL_WEB_URLS } from '@/constants/legal';

/**
 * Privacy policy, terms and refund policy, rendered from `data/legal.ts`.
 *
 * Native text rather than a web view: it reads offline, follows the app's type
 * and RTL, and cannot break when a host changes. The link at the foot opens the
 * public copy — the one the stores record — for anyone who wants it in a browser.
 */
export function LegalScreen({ doc: docId }: { doc: string }) {
  if (!isLegalDocId(docId)) {
    return (
      <ScreenContainer header={<Header showBack title="" />}>
        <EmptyState title="الصفحة غير موجودة" />
      </ScreenContainer>
    );
  }
  const doc = legalDocs[docId];
  const webUrl = LEGAL_WEB_URLS[docId];

  return (
    <ScreenContainer header={<Header showBack title={doc.title} />}>
      <View style={{ paddingTop: spacing.lg, paddingBottom: spacing['4xl'] }}>
        <Txt size={12} color={colors.textMuted}>
          آخر تحديث: {doc.updated}
        </Txt>
        <Txt size={14} color={colors.textSecondary} style={{ marginTop: spacing.md, lineHeight: 24 }}>
          {doc.intro}
        </Txt>

        {doc.sections.map((section) => (
          <View key={section.title} style={{ marginTop: spacing.xl }}>
            <Txt size={16} weight="black" color={colors.ink} style={{ marginBottom: spacing.sm }}>
              {section.title}
            </Txt>
            <View style={{ gap: spacing.sm }}>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </View>
          </View>
        ))}

        {webUrl ? (
          <Txt
            size={13}
            weight="bold"
            color={colors.goldDeep}
            style={{ marginTop: spacing['2xl'], textAlign: 'center' }}
            onPress={() => Linking.openURL(webUrl).catch(() => toast('تعذّر فتح الرابط'))}
          >
            النسخة المنشورة على sunray.sa
          </Txt>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'note') {
    return (
      <Card radiusKey="lg" style={{ backgroundColor: colors.chipGold }}>
        <Txt size={14} color={colors.ink} style={{ lineHeight: 24 }}>
          {block.text}
        </Txt>
      </Card>
    );
  }
  if (block.kind === 'list') {
    return (
      <View style={{ gap: 6 }}>
        {block.items.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.goldDeep, marginTop: 10 }} />
            <Txt size={14} color={colors.textSecondary} style={{ flex: 1, lineHeight: 24 }}>
              {item}
            </Txt>
          </View>
        ))}
      </View>
    );
  }
  return (
    <Txt size={14} color={colors.textSecondary} style={{ lineHeight: 24 }}>
      {block.text}
    </Txt>
  );
}
