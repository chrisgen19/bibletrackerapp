import { format } from 'date-fns';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { DEFAULT_CANON_ID, getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';
import { BookPicker } from '@/features/reading-plan/components/book-picker';
import { ChapterPicker } from '@/features/reading-plan/components/chapter-picker';
import { VersePicker } from '@/features/reading-plan/components/verse-picker';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { buildContinuationDraft } from '@/features/reading-plan/domain/continuation';
import type { ReadingKind } from '@/features/reading-plan/domain/reading-kind';
import {
  distinctReferences,
  formatReference,
  formatReferenceSpan,
  isSameReference,
} from '@/features/reading-plan/domain/reference';
import type { CompletionLookup } from '@/features/reading-plan/domain/schedule';
import type {
  DayReading,
  ReadingCompletion,
  ReadingPlanDraft,
} from '@/features/reading-plan/domain/types';
import { formatVerseRange, formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';
import { compareDateKeys, fromDateKey, type DateKey } from '@/utils/date-key';

import { describeRow } from './describe-row';
import { offerExtraReading } from './extra-reading-alert';
import { ExtraReadingsBlock } from './extra-readings-block';

type Tab = 'plan' | 'custom';

const TABS: readonly SegmentOption<Tab>[] = [
  { value: 'plan', label: 'Reading plan' },
  { value: 'custom', label: 'Custom' },
];

export interface DayDetailProps {
  day: DayReading;
  today: DateKey;
  /** Records plan readings. Returns false when nothing was written, so no success is shown. */
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  /** Records a Custom reading as an extra; the stored row, or null when nothing was written. */
  onLogExtra: (reference: BibleReference, verses?: VerseRange) => string | null;
  onUndo: () => void;
  /** Removes one recorded reading, so a day with several keeps the rest. */
  onUndoEntry: (id: string) => void;
  /** Moves the reading position so the next unread day follows on from a logged chapter. */
  onChangePlan: (draft: ReadingPlanDraft) => void;
  /** Lets a continuation skip days that are already recorded. */
  completions: CompletionLookup;
  /** The plan readings recorded on this day, so each can be described and removed on its own. */
  rows: readonly ReadingCompletion[];
  /** The extra readings recorded on this day, listed apart from the plan's. */
  extraRows: readonly ReadingCompletion[];
  /** Moves one recorded reading into or out of the plan. */
  onSetExtra: (id: string, isExtra: boolean) => void;
  /** Brings a just-logged extra into the plan, moving the plan on to `draft` first. */
  onCountTowardPlan: (id: string, draft: ReadingPlanDraft | null) => void;
  /** Whether a chapter logged from the Custom tab belongs to the plan (reading-kind.ts). */
  classifyReading: (reference: BibleReference) => ReadingKind;
  /**
   * Progress on the scheduled chapter across every day it was touched, or `null`
   * when the day schedules no single chapter.
   */
  progress: ChapterProgress | null;
  /** Progress for any chapter, so the Custom tab can resume an unfinished one. */
  getProgressFor: (reference: BibleReference) => ChapterProgress | null;
  /** When a chapter was finished, so an already-read one can say so rather than
   * presenting itself as untouched. */
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  /**
   * The chapter the reader is actually on — the head of the unread queue.
   *
   * Seeds the Custom tab and the catch-up action on a missed day. Without it both
   * fall back to Genesis 1, which is a valid-looking selection that is almost never
   * what the reader meant, and which silently records the wrong chapter.
   */
  currentPosition: BibleReference | null;
  /**
   * False on a day from an earlier read-through: a reading there stays in that
   * read-through, so moving the current plan on from it would skip a chapter the current
   * one never counted. Defaults to true.
   */
  canMovePlan?: boolean;
  /** Opens straight onto the Custom tab with this chapter selected. */
  focusChapter?: BibleReference | null;
}

export function DayDetail({
  day,
  today,
  onComplete,
  onLogExtra,
  onUndo,
  onUndoEntry,
  onChangePlan,
  completions,
  rows,
  extraRows,
  onSetExtra,
  onCountTowardPlan,
  classifyReading,
  progress,
  getProgressFor,
  getCompletedOnFor,
  currentPosition,
  canMovePlan = true,
  focusChapter = null,
}: DayDetailProps) {
  const theme = useTheme();
  // Arriving from the unfinished list lands directly on Custom with that chapter.
  const [tab, setTab] = useState<Tab>(focusChapter === null ? 'plan' : 'custom');

  const isFuture = compareDateKeys(day.date, today) > 0;

  return (
    <View>
      <DayHeader day={day} isToday={day.date === today} />

      {/* Future readings are view-only: you cannot log something you have not read. */}
      {isFuture ? null : (
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={setTab}
          accessibilityLabel="What to log for this day"
          testIDPrefix="day-tab"
          style={{ marginTop: theme.spacing.xl }}
        />
      )}

      {tab === 'plan' || isFuture ? (
        <PlanPanel
          day={day}
          isFuture={isFuture}
          onComplete={onComplete}
          onUndo={onUndo}
          onUndoEntry={onUndoEntry}
          onSetExtra={onSetExtra}
          rows={rows}
          hasExtras={extraRows.length > 0}
          progress={progress}
          getProgressFor={getProgressFor}
          getCompletedOnFor={getCompletedOnFor}
          currentPosition={currentPosition}
        />
      ) : (
        <CustomPanel
          day={day}
          today={today}
          onComplete={onComplete}
          onLogExtra={onLogExtra}
          onChangePlan={onChangePlan}
          onCountTowardPlan={onCountTowardPlan}
          classifyReading={classifyReading}
          completions={completions}
          getProgressFor={getProgressFor}
          getCompletedOnFor={getCompletedOnFor}
          currentPosition={currentPosition}
          canMovePlan={canMovePlan}
          focusChapter={focusChapter}
        />
      )}

      <ExtraReadingsBlock
        rows={extraRows}
        index={getCanonIndex(day.plan?.canonId ?? DEFAULT_CANON_ID)}
        onSetExtra={onSetExtra}
        onUndoEntry={onUndoEntry}
      />
    </View>
  );
}

function DayHeader({ day, isToday }: { day: DayReading; isToday: boolean }) {
  const theme = useTheme();
  const parsed = fromDateKey(day.date);

  return (
    <View>
      <Text variant="overline" color="tertiary">
        {isToday ? 'TODAY' : format(parsed, 'EEEE').toUpperCase()}
      </Text>
      <Text variant="title" style={{ marginTop: theme.spacing.xs }} accessibilityRole="header">
        {format(parsed, 'd MMMM yyyy')}
      </Text>
    </View>
  );
}

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

function PlanPanel({
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
function UnscheduledPanel({
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
function CustomPanel({
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

interface VerseControlProps {
  reference: BibleReference;
  progress: ChapterProgress;
  index: CanonIndex;
  /** "Mark" on the reading-plan side, "Log" when recording something by hand. */
  verb: 'Mark' | 'Log';
  /** Returns false when the write failed, so a stale selection is not cleared. */
  onSubmit: (span: VerseRange) => boolean;
  getCompletedOnFor: (reference: BibleReference) => DateKey | null;
  /** The day being viewed, to tell "recorded here" from "read on another day". */
  viewedDate: DateKey;
  fieldTestID: string;
  submitTestID: string;
}

/**
 * "I read up to verse N", and the button that records it.
 *
 * Shared by the plan tab, the catch-up block and the Custom tab so the three cannot
 * drift apart in wording or in what they write. Remount it with a `key` when the
 * chapter changes and the pending selection resets itself.
 */
function VerseControl({
  reference,
  progress,
  index,
  verb,
  onSubmit,
  getCompletedOnFor,
  viewedDate,
  fieldTestID,
  submitTestID,
}: VerseControlProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toVerse, setToVerse] = useState<number | null>(null);

  const fromVerse = progress.remaining[0]?.from ?? 1;
  const lastVerse = progress.verseCount;
  // A selection below `fromVerse` is stale: progress advanced past it while the sheet
  // stayed open. Treat it as unset rather than building a reversed span — normalise
  // would swap 11–10 into 10–11 and mark a verse read that never was.
  const endVerse = toVerse !== null && toVerse >= fromVerse ? toVerse : lastVerse;
  const span: VerseRange = { from: fromVerse, to: endVerse };
  const finishesChapter = endVerse >= lastVerse;
  const chapterLabel = formatReference(reference, index);

  // A finished chapter leaves `remaining` empty, so `fromVerse` falls back to 1 and
  // the control would otherwise present it as untouched — same field, same label,
  // no hint that logging again adds a second row and inflates the streak.
  const completedOn = progress.isComplete ? getCompletedOnFor(reference) : null;
  const alreadyHere = completedOn !== null && completedOn === viewedDate;

  return (
    <View>
      <View style={{ marginBottom: theme.spacing.md }}>
        <Card padded={false}>
          <FieldRow
            label="Read up to verse"
            value={
              progress.isComplete
                ? `${lastVerse} (whole chapter)`
                : finishesChapter
                  ? `${lastVerse} (finishes the chapter)`
                  : String(endVerse)
            }
            onPress={() => setPickerOpen(true)}
            last
            testID={fieldTestID}
          />
        </Card>
        {progress.isComplete ? null : (
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
            {finishesChapter
              ? 'Stopping early? Set how far you got and finish the rest another day.'
              : `Recording verses ${formatVerseRange(span)}. Verses ${formatVerseRange({
                  from: endVerse + 1,
                  to: lastVerse,
                })} stay waiting for you.`}
          </Text>
        )}
      </View>

      {progress.isComplete ? (
        <View
          style={{
            marginBottom: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.accentSoft,
          }}
        >
          <Text variant="footnote" color="accent" testID={`${submitTestID}-already-read`}>
            {alreadyHere
              ? `${chapterLabel} is already recorded on this day.`
              : completedOn === null
                ? `${chapterLabel} is already fully read.`
                : `${chapterLabel} is already fully read — completed on ${format(
                    fromDateKey(completedOn),
                    'd MMMM',
                  )}.`}
          </Text>
        </View>
      ) : null}

      <Button
        label={
          progress.isComplete
            ? `${verb} ${chapterLabel} Again`
            : finishesChapter && fromVerse === 1
              ? `${verb} ${chapterLabel} as Read`
              : `${verb} ${chapterLabel}:${formatVerseRange(span)} as Read`
        }
        variant={progress.isComplete ? 'secondary' : 'primary'}
        onPress={() => {
          if (onSubmit(span)) setToVerse(null);
        }}
        accessibilityHint={
          progress.isComplete
            ? `Records ${chapterLabel} again for this day, in addition to the reading already logged`
            : `Records ${chapterLabel} verses ${formatVerseRange(span)} as read`
        }
        testID={submitTestID}
      />

      <VersePicker
        visible={pickerOpen}
        chapterLabel={chapterLabel}
        fromVerse={fromVerse}
        verseCount={lastVerse}
        selectedTo={endVerse}
        onSelect={setToVerse}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function ReferenceBlock({
  label,
  chapters,
  index,
}: {
  label: string;
  chapters: readonly BibleReference[];
  index: CanonIndex;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        marginTop: theme.spacing.xl,
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
      }}
    >
      <Text variant="overline" color="tertiary">
        {label}
      </Text>
      <Text variant="title" style={{ marginTop: theme.spacing.xs }}>
        {formatReferenceSpan(chapters, index)}
      </Text>
    </View>
  );
}

/**
 * True when every chapter recorded on this day has no verses left.
 *
 * Taken from the rows rather than from the scheduled chapter's progress: a day can
 * hold a chapter the schedule never named, and a day holding two chapters has no
 * single progress at all. Both used to report a partial read as "completed".
 */
function areRowsComplete(
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
function RecordedBlock({
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
  fields: { overflow: 'hidden' },
  recordedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
