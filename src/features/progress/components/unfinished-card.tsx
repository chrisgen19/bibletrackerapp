import { View } from 'react-native';

import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Text } from '@/components/text';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';

interface UnfinishedCardProps {
  chapters: readonly ChapterProgress[];
  /** Opens the day where the chapter was started, which holds the verse control. */
  onOpen: (progress: ChapterProgress) => void;
}

/** Chapters shown before the list is collapsed behind a summary line. */
const VISIBLE_LIMIT = 3;

/**
 * Chapters started but not finished.
 *
 * Without this the app can lose a reading: a part-read chapter marks its day
 * complete, the calendar fills, and tomorrow shows the next chapter — leaving the
 * remaining verses reachable only by remembering which day they were started on.
 */
export function UnfinishedCard({ chapters, onOpen }: UnfinishedCardProps) {
  const theme = useTheme();
  if (chapters.length === 0) return null;

  const visible = chapters.slice(0, VISIBLE_LIMIT);
  const hidden = chapters.length - visible.length;

  return (
    <View accessible={false}>
      <Text variant="overline" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
        {chapters.length === 1 ? 'STILL TO FINISH' : `STILL TO FINISH · ${chapters.length}`}
      </Text>

      <Card padded={false}>
        {visible.map((progress, index) => (
          <FieldRow
            key={`${progress.reference.bookId}:${progress.reference.chapter}`}
            label={formatReference(progress.reference)}
            value={`${formatVerseRanges(progress.remaining)} left`}
            onPress={() => onOpen(progress)}
            last={index === visible.length - 1}
            testID={`unfinished-${progress.reference.bookId}-${progress.reference.chapter}`}
          />
        ))}
      </Card>

      {hidden > 0 ? (
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
          {`and ${hidden} more`}
        </Text>
      ) : null}
    </View>
  );
}
