import { View } from 'react-native';

import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { formatReference } from '@/features/reading-plan/domain/reference';
import type { DayReading, ReadingCompletion } from '@/features/reading-plan/domain/types';
import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';

import { areRowsComplete, RecordedBlock } from './recorded-block';
import { VerseControl } from './verse-control';

interface UnscheduledPanelProps {
  day: DayReading;
  index: CanonIndex;
  rows: readonly ReadingCompletion[];
  /** The day holds extra readings, so it is not empty: only the plan reading is missing. */
  hasExtras: boolean;
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  onUndo: () => void;
  onUndoEntry: (id: string) => void;
  onSetExtra: (id: string, isExtra: boolean) => void;
  getProgressFor: (reference: BibleReference) => ChapterProgress | null;
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  currentPosition: BibleReference | null;
  reducedMotion: boolean;
}

/**
 * A day the plan does not name a chapter for.
 *
 * A missed day is the interesting case. The reading position moves when you read,
 * not when the date passes, so nothing was lost and nothing needs recalculating —
 * but the reader cannot know that unless it is said, and the day is useless to them
 * without a way to record the catch-up. Both live here.
 */
export function UnscheduledPanel({
  day,
  index,
  rows,
  hasExtras,
  onComplete,
  onUndo,
  onUndoEntry,
  onSetExtra,
  getProgressFor,
  getCompletedOnFor,
  currentPosition,
  reducedMotion,
}: UnscheduledPanelProps) {
  const theme = useTheme();
  const hasRecord = rows.length > 0;
  const isMissed = day.scheduled.kind === 'not-scheduled';
  const catchUpProgress = currentPosition === null ? null : getProgressFor(currentPosition);

  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <Text variant="body" color="secondary">
        {day.scheduled.kind === 'canon-complete'
          ? 'You had already finished the entire Bible by this day, so nothing was scheduled.'
          : isMissed && hasExtras
            ? 'No plan reading was recorded on this day, only the extra reading below. Missing a day doesn’t cost you a chapter: your place in the plan moves as you read, not as days pass.'
            : isMissed
              ? // The position never moved, so this day cost nothing — there is no
                // chapter it was "supposed" to be, and naming one would be a fiction.
                'Nothing was recorded on this day. Missing a day doesn’t cost you a chapter — your place in the plan moves as you read, not as days pass.'
              : 'Your reading plan hadn’t started yet on this day.'}
      </Text>

      {hasRecord ? (
        <RecordedBlock
          rows={rows}
          index={index}
          isComplete={areRowsComplete(rows, getProgressFor)}
          onUndo={onUndo}
          onUndoEntry={onUndoEntry}
          onSetExtra={onSetExtra}
          reducedMotion={reducedMotion}
        />
      ) : isMissed && currentPosition !== null && catchUpProgress !== null ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <Text variant="overline" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
            CATCHING UP?
          </Text>
          <Text variant="footnote" color="secondary" style={{ marginBottom: theme.spacing.md }}>
            {`Record ${formatReference(currentPosition, index)} against this day — it is where you are now.`}
          </Text>
          <VerseControl
            key={`${currentPosition.bookId}:${currentPosition.chapter}`}
            reference={currentPosition}
            progress={catchUpProgress}
            index={index}
            verb="Mark"
            onSubmit={(span) => onComplete([currentPosition], span)}
            getCompletedOnFor={getCompletedOnFor}
            viewedDate={day.date}
            fieldTestID="catch-up-field-to-verse"
            submitTestID="catch-up-submit"
          />
        </View>
      ) : (
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.md }}>
          You can still record what you read using the Custom tab.
        </Text>
      )}
    </View>
  );
}
