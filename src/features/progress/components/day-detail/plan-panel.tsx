import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { distinctReferences, formatReferenceSpan } from '@/features/reading-plan/domain/reference';
import type { DayReading, ReadingCompletion } from '@/features/reading-plan/domain/types';
import { formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';

import { areRowsComplete, RecordedBlock } from './recorded-block';
import { ReferenceBlock } from './reference-block';
import { UnscheduledPanel } from './unscheduled-panel';
import { VerseControl } from './verse-control';

interface PlanPanelProps {
  day: DayReading;
  isFuture: boolean;
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  onUndo: () => void;
  onUndoEntry: (id: string) => void;
  onSetExtra: (id: string, isExtra: boolean) => void;
  rows: readonly ReadingCompletion[];
  hasExtras: boolean;
  progress: ChapterProgress | null;
  getProgressFor: (reference: BibleReference) => ChapterProgress | null;
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  currentPosition: BibleReference | null;
}

export function PlanPanel({
  day,
  isFuture,
  onComplete,
  onUndo,
  onUndoEntry,
  onSetExtra,
  rows,
  hasExtras,
  progress,
  getProgressFor,
  getCompletedOnFor,
  currentPosition,
}: PlanPanelProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const index = getCanonIndex(day.plan?.canonId ?? DEFAULT_CANON_ID);
  const hasRecord = rows.length > 0;

  if (day.scheduled.kind !== 'scheduled') {
    return (
      <UnscheduledPanel
        day={day}
        index={index}
        rows={rows}
        hasExtras={hasExtras}
        onComplete={onComplete}
        onUndo={onUndo}
        onUndoEntry={onUndoEntry}
        onSetExtra={onSetExtra}
        getProgressFor={getProgressFor}
        getCompletedOnFor={getCompletedOnFor}
        currentPosition={currentPosition}
        reducedMotion={reducedMotion}
      />
    );
  }

  // A recorded day shows exactly what was recorded, which can differ from the current
  // schedule after a plan change or a custom log. Duplicates collapse: a chapter read
  // in two sittings is one chapter, not two.
  const chapters = distinctReferences(
    hasRecord && day.completedChapters.length > 0 ? day.completedChapters : day.scheduled.chapters,
  );

  // Verse tracking only applies to a single scheduled chapter — reading part of
  // several at once is not a thing anyone does. This must stay in step with the
  // chapter `progress` was computed for, which is `day.scheduled.chapters[0]`.
  const tracked = day.scheduled.chapters.length === 1 ? day.scheduled.chapters[0] : undefined;
  const canTrackVerses = !isFuture && progress !== null && tracked !== undefined;

  return (
    <View>
      <ReferenceBlock
        label={isFuture ? 'SCHEDULED' : hasRecord ? 'RECORDED' : 'READING'}
        chapters={chapters}
        index={index}
      />

      {progress !== null && progress.isPartial ? (
        <View
          style={{
            marginTop: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.accentSoft,
          }}
        >
          <Text variant="footnote" color="accent">
            {`You’ve read verses ${formatVerseRanges(progress.read)}. Verses ${formatVerseRanges(
              progress.remaining,
            )} still to go.`}
          </Text>
        </View>
      ) : null}

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
      ) : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        {isFuture ? (
          <View
            style={{
              backgroundColor: theme.colors.surfaceSubtle,
              borderRadius: theme.radius.md,
              padding: theme.spacing.lg,
            }}
          >
            <Text variant="callout" color="secondary" align="center">
              You can mark this reading once the day arrives.
            </Text>
          </View>
        ) : canTrackVerses && progress !== null && tracked !== undefined ? (
          // Nothing left to do only when this day holds the record *and* the chapter
          // is finished. A chapter completed on another date must still be markable
          // here, or a plan change would leave the day with no action at all.
          hasRecord && progress.isComplete ? null : (
            <VerseControl
              key={`${tracked.bookId}:${tracked.chapter}`}
              reference={tracked}
              progress={progress}
              index={index}
              verb="Mark"
              onSubmit={(span) => onComplete([tracked], span)}
              getCompletedOnFor={getCompletedOnFor}
              viewedDate={day.date}
              fieldTestID="field-to-verse"
              submitTestID="mark-day-read"
            />
          )
        ) : hasRecord ? null : (
          <Button
            label={`Mark ${formatReferenceSpan(chapters, index)} as Read`}
            onPress={() => onComplete(chapters, undefined)}
            accessibilityHint={`Marks ${formatReferenceSpan(chapters, index)} as read`}
            testID="mark-day-read"
          />
        )}
      </View>
    </View>
  );
}
