import { View } from 'react-native';

import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Text } from '@/components/text';
import type { BacklogEntry } from '@/features/reading-plan/domain/backlog';
import { formatReference } from '@/features/reading-plan/domain/reference';
import { formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';

interface BacklogCardProps {
  entries: readonly BacklogEntry[];
  /** Opens today's sheet with this chapter selected, so it is recorded as read now. */
  onOpen: (entry: BacklogEntry) => void;
}

/** Chapters shown before the list is collapsed behind a summary line. */
const VISIBLE_LIMIT = 3;

/** Neutral wording on purpose: a backlog is a to-do list, not a reprimand. */
function describe(entry: BacklogEntry): string {
  return entry.kind === 'unfinished'
    ? `${formatVerseRanges(entry.progress.remaining)} left`
    : 'not read';
}

/**
 * Everything still owed: chapters left part-read, and chapters the plan scheduled on
 * a day that came and went.
 *
 * Both kinds are lost the same way. The schedule is pure arithmetic on the date, so
 * a day that passes takes its chapter with it — the calendar moves on whether or not
 * anyone read. Without this list those chapters are unreachable.
 */
export function BacklogCard({ entries, onOpen }: BacklogCardProps) {
  const theme = useTheme();
  if (entries.length === 0) return null;

  const visible = entries.slice(0, VISIBLE_LIMIT);
  const hidden = entries.length - visible.length;

  return (
    <View accessible={false}>
      <Text variant="overline" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
        {entries.length === 1 ? 'STILL TO READ' : `STILL TO READ · ${entries.length}`}
      </Text>

      <Card padded={false}>
        {visible.map((entry, index) => (
          <FieldRow
            key={`${entry.reference.bookId}:${entry.reference.chapter}`}
            label={formatReference(entry.reference)}
            value={describe(entry)}
            onPress={() => onOpen(entry)}
            last={index === visible.length - 1}
            testID={`backlog-${entry.reference.bookId}-${entry.reference.chapter}`}
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
