import { useCallback, useMemo } from 'react';

import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { getCanonIndex } from '@/data/bible/canon-index';
import type { DayDetailProps } from '@/features/progress/components/day-detail';
import { getChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import {
  getReadThrough,
  getRecordedReadThrough,
  selectProgressCompletions,
} from '@/features/reading-plan/domain/read-through';
import { classifyCustomReading } from '@/features/reading-plan/domain/reading-kind';
import { getChapterCompletionDate } from '@/features/reading-plan/domain/reading-position';
import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { ReadingCompletion, ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { isValidDateKey, type DateKey } from '@/utils/date-key';
import { completionHaptic, settingChangedHaptic, undoHaptic } from '@/utils/haptics';

const NO_ROWS: readonly ReadingCompletion[] = [];

/**
 * Everything the day detail shows for `date`, or null when the date is not a real day.
 *
 * The sheet works from the plan's view, so a day holding only an extra reading still
 * offers its plan reading; the extras are listed on their own (`extraRows`).
 */
export function useDayDetail(date: string | undefined, book?: string, chapter?: string): DayDetailProps | null {
  const data = useReadingData();
  const { plans, completions, progressReadings, planCompletionLookup, planScheduleContext } = data;
  const isValid = typeof date === 'string' && isValidDateKey(date);

  const day = useMemo(
    () => (isValid ? getDayReading(plans, date, planScheduleContext) : null),
    [isValid, date, plans, planScheduleContext],
  );
  const canonId = day?.plan?.canonId ?? 'protestant';
  const index = getCanonIndex(canonId);
  const rows = day === null ? NO_ROWS : (planCompletionLookup.get(day.date) ?? NO_ROWS);
  const handlers = useDayHandlers(day?.date ?? null);

  /**
   * The readings a chapter's progress is measured against: those of the read-through it
   * was recorded in on this day, else the viewed day's. A day from an earlier time
   * through the Bible still reads as completed once a new read-through has begun, and on
   * the day one starts, the chapter that finished the last one is not unread in it.
   */
  const completionsFor = useCallback(
    (reference: BibleReference) => {
      const readThrough =
        getRecordedReadThrough(plans, rows, reference) ??
        (day === null || day.plan === null ? null : getReadThrough(day.plan));
      return readThrough === null ? progressReadings : selectProgressCompletions(plans, completions, readThrough);
    },
    [day, rows, plans, completions, progressReadings],
  );

  /**
   * Progress on the day's single scheduled chapter, across every day it was touched.
   * Verse tracking is offered only for a one-chapter day.
   */
  const progress = useMemo(() => {
    if (day === null || day.scheduled.kind !== 'scheduled') return null;
    const only = day.scheduled.chapters.length === 1 ? day.scheduled.chapters[0] : undefined;
    return only === undefined ? null : getChapterProgress(completionsFor(only), only, getCanonIndex(canonId));
  }, [day, completionsFor, canonId]);

  /**
   * Arriving from the unfinished list: open Custom with that chapter selected, so the
   * remaining verses are recorded against the day being viewed rather than back-dated
   * to whenever the chapter was started.
   */
  const focusChapter = useMemo(() => {
    if (book === undefined || chapter === undefined) return null;
    const parsed = Number(chapter);
    if (!Number.isInteger(parsed)) return null;
    const reference = { bookId: book, chapter: parsed };
    return getCanonIndex(canonId).isValidReference(reference) ? reference : null;
  }, [book, chapter, canonId]);

  if (day === null) return null;
  // A day from an earlier read-through stores its readings there, so a Custom reading on
  // it is classified there too. That read-through was finished when the next one began,
  // so it has no queue: a new chapter on such a day is an extra.
  const earlier = day.plan !== null && getReadThrough(day.plan) !== data.currentReadThrough ? day.plan : null;

  return {
    ...handlers,
    day,
    today: data.today,
    completions: planCompletionLookup,
    rows,
    extraRows: (data.completionLookup.get(day.date) ?? NO_ROWS).filter((row) => row.isExtra === true),
    classifyReading: (reference: BibleReference) =>
      classifyCustomReading(
        earlier === null
          ? { reference, planReadings: progressReadings, unread: planScheduleContext.unread, plan: data.activePlan, index }
          : {
              reference,
              planReadings: selectProgressCompletions(plans, completions, getReadThrough(earlier)),
              unread: [],
              plan: earlier,
              index,
            },
      ),
    progress,
    getProgressFor: (reference: BibleReference) => getChapterProgress(completionsFor(reference), reference, index),
    getCompletedOnFor: (reference: BibleReference) =>
      getChapterCompletionDate(completionsFor(reference), reference, index),
    // The head of the unread queue: where the reader actually is. Without it the Custom
    // tab and the catch-up action would fall back to Genesis 1 and record the wrong
    // chapter. A day from an earlier read-through has none, so it offers no catching up
    // and no moving on.
    currentPosition: earlier === null ? (planScheduleContext.unread[0] ?? null) : null,
    canMovePlan: earlier === null,
    focusChapter,
  };
}

/** The day detail's writes, each with its haptic. */
function useDayHandlers(date: DateKey | null) {
  const { completeReading, undoReading, undoReadingEntry, changePlan, setReadingExtra, countTowardPlan } =
    useReadingData();

  const onComplete = useCallback(
    (chapters: readonly BibleReference[], verses?: VerseRange): boolean => {
      const logged = date !== null && completeReading(date, chapters, verses).length > 0;
      if (logged) completionHaptic();
      return logged;
    },
    [date, completeReading],
  );
  const onLogExtra = useCallback(
    (reference: BibleReference, verses?: VerseRange): string | null => {
      const id = date === null ? null : (completeReading(date, [reference], verses, true)[0] ?? null);
      if (id !== null) completionHaptic();
      return id;
    },
    [date, completeReading],
  );
  const onUndo = useCallback(() => {
    if (date === null) return;
    undoReading(date);
    undoHaptic();
  }, [date, undoReading]);
  const onUndoEntry = useCallback(
    (id: string) => {
      undoReadingEntry(id);
      undoHaptic();
    },
    [undoReadingEntry],
  );
  const onChangePlan = useCallback(
    (draft: ReadingPlanDraft) => {
      changePlan(draft);
      settingChangedHaptic();
    },
    [changePlan],
  );
  const onSetExtra = useCallback(
    (id: string, isExtra: boolean) => {
      setReadingExtra(id, isExtra);
      settingChangedHaptic();
    },
    [setReadingExtra],
  );
  const onCountTowardPlan = useCallback(
    (id: string, draft: ReadingPlanDraft | null) => {
      countTowardPlan(id, draft);
      settingChangedHaptic();
    },
    [countTowardPlan],
  );

  return { onComplete, onLogExtra, onUndo, onUndoEntry, onChangePlan, onSetExtra, onCountTowardPlan };
}
