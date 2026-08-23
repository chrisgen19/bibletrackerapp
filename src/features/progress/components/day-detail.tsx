import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FieldRow } from '@/components/field-row';
import { Icon } from '@/components/icon';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { Text } from '@/components/text';
import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import { BookPicker } from '@/features/reading-plan/components/book-picker';
import { ChapterPicker } from '@/features/reading-plan/components/chapter-picker';
import { VersePicker } from '@/features/reading-plan/components/verse-picker';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { buildContinuationDraft } from '@/features/reading-plan/domain/continuation';
import {
  distinctReferences,
  formatReference,
  formatReferenceSpan,
} from '@/features/reading-plan/domain/reference';
import type { CompletionLookup } from '@/features/reading-plan/domain/schedule';
import type { DayReading, ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { formatVerseRange, formatVerseRanges } from '@/features/reading-plan/domain/verse-range';
import { useTheme } from '@/theme/theme-provider';
import { compareDateKeys, fromDateKey, type DateKey } from '@/utils/date-key';

type Tab = 'plan' | 'custom';

const TABS: readonly SegmentOption<Tab>[] = [
  { value: 'plan', label: 'Reading plan' },
  { value: 'custom', label: 'Custom' },
];

interface DayDetailProps {
  day: DayReading;
  today: DateKey;
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  onUndo: () => void;
  /** Moves the reading position so the next unread day follows on from a logged chapter. */
  onChangePlan: (draft: ReadingPlanDraft) => void;
  /** Lets a continuation skip days that are already recorded. */
  completions: CompletionLookup;
  /**
   * Progress on the scheduled chapter across every day it was touched, or `null`
   * when the day schedules no single chapter.
   */
  progress: ChapterProgress | null;
}

export function DayDetail({
  day,
  today,
  onComplete,
  onUndo,
  onChangePlan,
  completions,
  progress,
}: DayDetailProps) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('plan');

  const isFuture = compareDateKeys(day.date, today) > 0;
  const isCompleted = day.status === 'completed';

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
          isCompleted={isCompleted}
          onComplete={onComplete}
          onUndo={onUndo}
          progress={progress}
        />
      ) : (
        <CustomPanel
          day={day}
          today={today}
          onComplete={onComplete}
          onChangePlan={onChangePlan}
          completions={completions}
        />
      )}
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
  isCompleted: boolean;
  onComplete: (chapters: readonly BibleReference[], verses?: VerseRange) => boolean;
  onUndo: () => void;
  progress: ChapterProgress | null;
}

function PlanPanel({ day, isFuture, isCompleted, onComplete, onUndo, progress }: PlanPanelProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [versePickerOpen, setVersePickerOpen] = useState(false);
  const [toVerse, setToVerse] = useState<number | null>(null);

  if (day.scheduled.kind !== 'scheduled') {
    return (
      <View style={{ marginTop: theme.spacing.xl }}>
        <Text variant="body" color="secondary">
          {day.scheduled.kind === 'canon-complete'
            ? 'You had already finished the entire Bible by this day, so nothing was scheduled.'
            : 'Your reading plan hadn’t started yet on this day.'}
        </Text>
        {isCompleted ? (
          <CompletedBlock
            chapters={distinctReferences(day.completedChapters)}
            onUndo={onUndo}
            reducedMotion={reducedMotion}
          />
        ) : (
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.md }}>
            You can still record what you read using the Custom tab.
          </Text>
        )}
      </View>
    );
  }

  // A completed day shows exactly what was recorded, which can differ from the current
  // schedule after a plan change or a custom log. Duplicates collapse: a chapter read
  // in two sittings is one chapter, not two.
  const chapters = distinctReferences(
    isCompleted && day.completedChapters.length > 0 ? day.completedChapters : day.scheduled.chapters,
  );

  // Verse tracking only applies to a single scheduled chapter — reading part of
  // several at once is not a thing anyone does.
  const canTrackVerses = !isFuture && progress !== null && day.scheduled.chapters.length === 1;
  const chapterLabel = formatReferenceSpan(day.scheduled.chapters);

  const fromVerse = progress?.remaining[0]?.from ?? 1;
  const lastVerse = progress?.verseCount ?? 1;
  const endVerse = toVerse ?? lastVerse;
  const span: VerseRange = { from: fromVerse, to: endVerse };
  const finishesChapter = endVerse >= lastVerse;

  // The chapter is unfinished even though the day itself has a reading recorded:
  // this is the "read 1-10 yesterday" case, and it must still offer to continue.
  const showContinue = canTrackVerses && progress !== null && progress.isPartial;

  /**
   * What a press records. When tracking verses this must be the *scheduled* chapter
   * that `progress` describes — not everything logged that day. Passing several
   * chapters makes the repository drop the span and write whole-chapter sentinels,
   * which would falsely complete the scheduled chapter.
   */
  const chaptersToRecord = canTrackVerses ? day.scheduled.chapters : chapters;

  /**
   * Chapter-wide completion is not day completion. A chapter read on another date and
   * scheduled again after a plan change would otherwise show this day as done, with an
   * Undo that deletes nothing here.
   */
  const showCompleted = isCompleted && (progress === null || !progress.isPartial);

  return (
    <View>
      <ReferenceBlock label={isFuture ? 'SCHEDULED' : 'READING'} chapters={chapters} />

      {showContinue && progress !== null ? (
        <View
          style={{
            marginTop: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.accentSoft,
          }}
        >
          <Text variant="footnote" color="accent">
            {`Read ${formatVerseRanges(progress.read)} · ${formatVerseRanges(progress.remaining)} to go`}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        {showCompleted ? (
          <CompletedBlock chapters={chapters} onUndo={onUndo} reducedMotion={reducedMotion} />
        ) : isFuture ? (
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
        ) : (
          <>
            {canTrackVerses ? (
              <View style={{ marginBottom: theme.spacing.md }}>
                <Card padded={false}>
                  <FieldRow
                    label="Read to verse"
                    value={finishesChapter ? `${lastVerse} — the end` : String(endVerse)}
                    onPress={() => setVersePickerOpen(true)}
                    last
                    testID="field-to-verse"
                  />
                </Card>
                <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
                  {finishesChapter
                    ? 'Stopping early? Set how far you got and finish the rest another day.'
                    : `Recording ${formatVerseRange(span)}. The rest stays waiting for you.`}
                </Text>
              </View>
            ) : null}

            <Button
              label={
                !canTrackVerses || (finishesChapter && fromVerse === 1)
                  ? 'Mark as Read'
                  : `Mark ${formatVerseRange(span)} as Read`
              }
              onPress={() => {
                const recorded = onComplete(chaptersToRecord, canTrackVerses ? span : undefined);
                if (recorded) setToVerse(null);
              }}
              accessibilityHint={
                canTrackVerses
                  ? `Records ${chapterLabel} verses ${formatVerseRange(span)} as read`
                  : `Marks ${formatReferenceSpan(chapters)} as read`
              }
              testID="mark-day-read"
            />
          </>
        )}
      </View>

      {canTrackVerses && progress !== null ? (
        <VersePicker
          visible={versePickerOpen}
          chapterLabel={chapterLabel}
          fromVerse={fromVerse}
          verseCount={progress.verseCount}
          selectedTo={endVerse}
          onSelect={setToVerse}
          onClose={() => setVersePickerOpen(false)}
        />
      ) : null}
    </View>
  );
}

interface CustomPanelProps {
  day: DayReading;
  today: DateKey;
  onComplete: (chapters: readonly BibleReference[]) => boolean;
  onChangePlan: (draft: ReadingPlanDraft) => void;
  completions: CompletionLookup;
}

/**
 * Records a chapter the user actually read, which need not be the scheduled one.
 *
 * After logging, it offers to move the reading position so the next unread day
 * continues on from there — the schedule and the log stay independent unless the
 * user explicitly links them.
 */
function CustomPanel({ day, today, onComplete, onChangePlan, completions }: CustomPanelProps) {
  const theme = useTheme();
  const canonId = day.plan?.canonId ?? DEFAULT_CANON_ID;
  const index = getCanonIndex(canonId);

  const [reference, setReference] = useState<BibleReference>(
    () => day.completedChapters[0] ?? (day.scheduled.kind === 'scheduled'
      ? day.scheduled.chapters[0] ?? index.firstReference
      : index.firstReference),
  );
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const book = index.getBook(reference.bookId);

  const handleLog = useCallback(() => {
    // A failed write must not produce a success alert or a continuation offer.
    if (!onComplete([reference])) return;

    const draft = buildContinuationDraft({
      loggedChapter: reference,
      loggedDate: day.date,
      today,
      plan: day.plan,
      completions,
    });

    if (draft === null) return;

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
  }, [reference, day.date, day.plan, today, onComplete, onChangePlan, index, completions]);

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

      <Button
        label="Log as Read"
        onPress={handleLog}
        accessibilityHint={`Records ${formatReference(reference, index)} for this day`}
        style={{ marginTop: theme.spacing.xl }}
        testID="log-custom-reading"
      />

      <BookPicker
        visible={bookPickerOpen}
        canonId={canonId}
        selectedBookId={reference.bookId}
        onClose={() => setBookPickerOpen(false)}
        onSelect={(selected) =>
          setReference((current) => ({
            bookId: selected.id,
            chapter: Math.min(current.chapter, selected.chapterCount),
          }))
        }
      />
      <ChapterPicker
        visible={chapterPickerOpen}
        canonId={canonId}
        bookId={reference.bookId}
        selectedChapter={reference.chapter}
        onClose={() => setChapterPickerOpen(false)}
        onSelect={(chapter) => setReference((current) => ({ ...current, chapter }))}
      />
    </View>
  );
}

function ReferenceBlock({ label, chapters }: { label: string; chapters: readonly BibleReference[] }) {
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
        {formatReferenceSpan(chapters)}
      </Text>
    </View>
  );
}

function CompletedBlock({
  chapters,
  onUndo,
  reducedMotion,
}: {
  /** Already deduplicated — two spans of one chapter must not read "Genesis 21–21". */
  chapters: readonly BibleReference[];
  onUndo: () => void;
  reducedMotion: boolean;
}) {
  const theme = useTheme();

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.base)}>
      <View style={styles.completedRow}>
        <Icon name="checkmark" size={15} color={theme.colors.accent} />
        <Text variant="headline" color="accent" style={{ marginLeft: theme.spacing.sm }}>
          {chapters.length > 0 ? `${formatReferenceSpan(chapters)} completed` : 'Completed'}
        </Text>
      </View>
      <Button
        label="Undo Completion"
        variant="secondary"
        onPress={onUndo}
        accessibilityHint="Removes this day's reading from your progress"
        style={{ marginTop: theme.spacing.lg }}
        testID="undo-completion"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fields: { overflow: 'hidden' },
  completedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
