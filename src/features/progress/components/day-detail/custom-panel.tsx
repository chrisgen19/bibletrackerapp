import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FieldRow } from '@/components/field-row';
import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import { BookPicker } from '@/features/reading-plan/components/book-picker';
import { ChapterPicker } from '@/features/reading-plan/components/chapter-picker';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { buildContinuationDraft } from '@/features/reading-plan/domain/continuation';
import type { ReadingKind } from '@/features/reading-plan/domain/reading-kind';
import { formatReference, isSameReference } from '@/features/reading-plan/domain/reference';
import type { CompletionLookup } from '@/features/reading-plan/domain/schedule';
import type { DayReading, ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';

import { offerExtraReading } from './extra-reading-alert';
import { VerseControl } from './verse-control';

interface CustomPanelProps {
  day: DayReading;
  today: DateKey;
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  onLogExtra: (reference: BibleReference, verses?: VerseRange) => string | null;
  onChangePlan: (draft: ReadingPlanDraft) => void;
  onCountTowardPlan: (id: string, draft: ReadingPlanDraft | null) => void;
  classifyReading: (reference: BibleReference) => ReadingKind;
  completions: CompletionLookup;
  getProgressFor: (reference: BibleReference) => ChapterProgress | null;
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  currentPosition: BibleReference | null;
  canMovePlan: boolean;
  focusChapter: BibleReference | null;
}

/**
 * Records a chapter the user actually read, which need not be the scheduled one.
 *
 * After logging, it offers to move the reading position so the next unread day
 * continues on from there — the schedule and the log stay independent unless the
 * user explicitly links them.
 *
 * A chapter far from the plan (a re-read, or Revelation while the plan is in
 * Leviticus) is recorded as an extra reading straight away, and the offer becomes
 * whether to bring it into the plan instead.
 */
export function CustomPanel({
  day,
  today,
  onComplete,
  onLogExtra,
  onChangePlan,
  onCountTowardPlan,
  classifyReading,
  completions,
  getProgressFor,
  getCompletedOnFor,
  currentPosition,
  canMovePlan,
  focusChapter,
}: CustomPanelProps) {
  const theme = useTheme();
  const canonId = day.plan?.canonId ?? DEFAULT_CANON_ID;
  const index = getCanonIndex(canonId);

  /**
   * What the picker opens on.
   *
   * Order matters. A day that already has a record edits that record; a scheduled
   * day offers its own chapter; anything else — a missed day above all — offers
   * where the reader actually is. `firstReference` is a last resort for a reader
   * with no position at all, never a default: it looks like a real choice, and
   * silently records Genesis 1 for anyone who only changes the verse.
   */
  const [reference, setReference] = useState<BibleReference>(
    () =>
      focusChapter ??
      day.completedChapters[0] ??
      (day.scheduled.kind === 'scheduled' ? day.scheduled.chapters[0] : undefined) ??
      currentPosition ??
      index.firstReference,
  );
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const book = index.getBook(reference.bookId);

  // Progress on whichever chapter is selected, so resuming an unfinished one starts
  // at the right verse instead of re-recording what has already been read.
  const progress = getProgressFor(reference);
  const resuming = progress?.isPartial === true;

  /** After a successful log, the plan change to offer, or null for none. */
  const continuationAfter = (span?: VerseRange): ReadingPlanDraft | null => {
    // Continuation starts at the chapter *after* this one, so offering it while
    // verses remain unread would advance the plan straight past them. Only a
    // finished chapter may move the position; a partial read stays in the backlog.
    if (span !== undefined && progress !== null && span.to < progress.verseCount) return null;

    // Logging the chapter you were already on needs no plan change: the unread queue
    // steps over what is finished by itself. Offering to move the plan start here
    // would be worse than noise — chapters left unread *before* the new start are
    // dropped from the queue, so accepting it silently abandons them.
    if (currentPosition !== null && isSameReference(reference, currentPosition)) return null;

    return buildContinuationDraft({
      loggedChapter: reference,
      loggedDate: day.date,
      today,
      plan: day.plan,
      completions,
    });
  };

  const handleLog = (span?: VerseRange): boolean => {
    if (classifyReading(reference) === 'extra') {
      const id = onLogExtra(reference, span);
      // A refused write must not produce the notice.
      if (id === null) return false;
      const draft = canMovePlan ? continuationAfter(span) : null;
      offerExtraReading({
        reference,
        currentPosition,
        draft,
        index,
        onAccept: () => onCountTowardPlan(id, draft),
      });
      return true;
    }

    // A failed write must not produce a success alert or a continuation offer.
    if (!onComplete([reference], span)) return false;

    const draft = continuationAfter(span);
    if (draft === null) return true;

    Alert.alert(
      'Continue from here?',
      `${formatReference(reference, index)} is logged. Would you like your reading plan to carry on from ${formatReference(
        { bookId: draft.startBookId, chapter: draft.startChapter },
        index,
      )}?\n\nDays you have already completed stay exactly as they are.`,
      [
        { text: 'Keep my plan', style: 'cancel' },
        { text: 'Continue from here', onPress: () => onChangePlan(draft) },
      ],
    );
    return true;
  };

  return (
    <View>
      <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.lg }}>
        Record what you actually read on this day.
      </Text>

      <View
        style={[
          styles.fields,
          {
            marginTop: theme.spacing.md,
            backgroundColor: theme.colors.surfaceSubtle,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <FieldRow
          label="Book"
          value={book?.name ?? reference.bookId}
          onPress={() => setBookPickerOpen(true)}
          testID="custom-field-book"
        />
        <FieldRow
          label="Chapter"
          value={String(reference.chapter)}
          onPress={() => setChapterPickerOpen(true)}
          last
          testID="custom-field-chapter"
        />
      </View>

      {resuming && progress !== null ? (
        <View
          style={{
            marginTop: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.accentSoft,
          }}
        >
          <Text variant="footnote" color="accent">
            {`You’ve read verses ${formatVerseRanges(progress.read)}. This continues from verse ${
              progress.remaining[0]?.from ?? 1
            }.`}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        {progress === null ? (
          // Without verse counts there is no span to record. Sending one anyway would
          // write `1-1` and claim a whole chapter had been read from a single verse.
          <Button
            label={`Log ${formatReference(reference, index)} as Read`}
            onPress={() => handleLog()}
            accessibilityHint={`Records ${formatReference(reference, index)} for this day`}
            testID="log-custom-reading"
          />
        ) : (
          <VerseControl
            key={`${reference.bookId}:${reference.chapter}`}
            reference={reference}
            progress={progress}
            index={index}
            verb="Log"
            onSubmit={(span) => handleLog(span)}
            getCompletedOnFor={getCompletedOnFor}
            viewedDate={day.date}
            fieldTestID="custom-field-to-verse"
            submitTestID="log-custom-reading"
          />
        )}
      </View>

      <BookPicker
        visible={bookPickerOpen}
        canonId={canonId}
        selectedBookId={reference.bookId}
        onClose={() => setBookPickerOpen(false)}
        onSelect={(selected) => {
          setReference((current) => ({
            bookId: selected.id,
            chapter: Math.min(current.chapter, selected.chapterCount),
          }));
        }}
      />
      <ChapterPicker
        visible={chapterPickerOpen}
        canonId={canonId}
        bookId={reference.bookId}
        selectedChapter={reference.chapter}
        onClose={() => setChapterPickerOpen(false)}
        onSelect={(chapter) => {
          setReference((current) => ({ ...current, chapter }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { overflow: 'hidden' },
});
