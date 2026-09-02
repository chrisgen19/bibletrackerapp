import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import type { BibleReference } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';

interface UnfinishedListProps {
  /** Chapters started but not finished, oldest in canon order first. */
  chapters: readonly ChapterProgress[];
  index: CanonIndex;
  onSelect: (reference: BibleReference) => void;
}

/**
 * The chapters left half-read.
 *
 * A part-read chapter stays at the head of the unread queue, so without a list of
 * them the only clue anything is outstanding is today's card — and a chapter logged
 * against the wrong reference never surfaces there at all. This is the backlog the
 * reader can act on directly.
 */
export function UnfinishedList({ chapters, index, onSelect }: UnfinishedListProps) {
  const theme = useTheme();
  if (chapters.length === 0) return null;

  return (
    <View>
      <SectionHeader title="Still to finish" />
      <Card padded={false}>
        {chapters.map((progress, position) => {
          const label = formatReference(progress.reference, index);
          return (
            <Pressable
              key={`${progress.reference.bookId}:${progress.reference.chapter}`}
              accessibilityRole="button"
              accessibilityLabel={`${label}, verses ${formatVerseRanges(progress.remaining)} left`}
              accessibilityHint="Opens today so you can record the rest"
              testID={`unfinished-${progress.reference.bookId}-${progress.reference.chapter}`}
              onPress={() => onSelect(progress.reference)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingHorizontal: theme.spacing.xl,
                  backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
                  borderTopWidth: position === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: theme.colors.separator,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{label}</Text>
                <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
                  {`Verses ${formatVerseRanges(progress.remaining)} left`}
                </Text>
              </View>
              <Icon name="chevron.right" size={14} color={theme.colors.textTertiary} />
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET, paddingVertical: 12 },
});
