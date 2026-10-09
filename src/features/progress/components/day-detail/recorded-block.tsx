import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import type { BibleReference } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { distinctReferences, formatReferenceSpan } from '@/features/reading-plan/domain/reference';
import type { ReadingCompletion } from '@/features/reading-plan/domain/types';
import { useTheme } from '@/theme/theme-provider';

import { describeRow } from './describe-row';

/**
 * True when every chapter recorded on this day has no verses left.
 *
 * Taken from the rows rather than from the scheduled chapter's progress: a day can
 * hold a chapter the schedule never named, and a day holding two chapters has no
 * single progress at all. Both used to report a partial read as "completed".
 */
export function areRowsComplete(
  rows: readonly ReadingCompletion[],
  getProgressFor: (reference: BibleReference) => ChapterProgress | null,
): boolean {
  return distinctReferences(
    rows.map((row) => ({ bookId: row.bookId, chapter: row.chapter })),
  ).every((reference) => {
    const progress = getProgressFor(reference);
    // No verse counts means the whole chapter was recorded, which is complete.
    return progress === null || !progress.isPartial;
  });
}

/**
 * What this day holds, and how to take it back.
 *
 * Rendered whenever the day has rows — including a part-read chapter. Gating removal
 * on the *chapter* being finished stranded anyone who logged the wrong reference:
 * the day showed as complete on the calendar while the sheet offered only to read
 * more of a chapter they had never opened.
 */
export function RecordedBlock({
  rows,
  index,
  isComplete,
  onUndo,
  onUndoEntry,
  onSetExtra,
  reducedMotion,
}: {
  rows: readonly ReadingCompletion[];
  index: CanonIndex;
  isComplete: boolean;
  onUndo: () => void;
  onUndoEntry: (id: string) => void;
  /** Moves a reading out of the plan. */
  onSetExtra: (id: string, isExtra: boolean) => void;
  reducedMotion: boolean;
}) {
  const theme = useTheme();
  const chapters = distinctReferences(
    rows.map((row) => ({ bookId: row.bookId, chapter: row.chapter })),
  );
  const single = rows.length === 1;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.base)}
      style={{ marginTop: theme.spacing.lg }}
    >
      <View style={styles.recordedRow}>
        {isComplete ? <Icon name="checkmark" size={15} color={theme.colors.accent} /> : null}
        <Text
          variant="headline"
          color="accent"
          style={{ marginLeft: isComplete ? theme.spacing.sm : 0 }}
        >
          {isComplete
            ? `${formatReferenceSpan(chapters, index)} completed`
            : `${rows.map((row) => describeRow(row, index)).join(', ')} recorded`}
        </Text>
      </View>

      {/* One entry needs no list; several do, so the wrong one can go on its own. */}
      {single ? (
        <Button
          label="Not part of your plan? Mark as extra"
          variant="ghost"
          size="medium"
          onPress={() => onSetExtra(rows[0]?.id ?? '', true)}
          accessibilityHint="Keeps this reading on its day but takes it out of your plan"
          style={{ marginTop: theme.spacing.sm }}
          testID="mark-extra"
        />
      ) : (
        <View style={{ marginTop: theme.spacing.md }}>
          {rows.map((row) => (
            <View key={row.id} style={styles.entryRow}>
              <Text variant="footnote" color="secondary" style={{ flex: 1 }}>
                {describeRow(row, index)}
              </Text>
              <Button
                label="Mark as extra"
                variant="ghost"
                size="medium"
                onPress={() => onSetExtra(row.id, true)}
                accessibilityHint={`Takes ${describeRow(row, index)} out of your plan`}
                testID={`mark-extra-${row.id}`}
              />
              <IconButton
                name="xmark"
                variant="plain"
                size={14}
                accessibilityLabel={`Remove ${describeRow(row, index)}`}
                onPress={() => onUndoEntry(row.id)}
                testID={`remove-entry-${row.id}`}
              />
            </View>
          ))}
        </View>
      )}

      <Button
        label={single ? 'Remove This Reading' : 'Remove All Readings'}
        variant="destructive"
        onPress={onUndo}
        accessibilityHint={
          single
            ? 'Removes this reading from your progress'
            : 'Removes every reading recorded on this day'
        }
        style={{ marginTop: theme.spacing.lg }}
        testID="undo-completion"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  recordedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
