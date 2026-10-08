import type { BibleReference } from '@/data/bible/canon';
import { type CanonIndex, getCanonIndex } from '@/data/bible/canon-index';
import { compareDateKeys, type DateKey } from '@/utils/date-key';

import { selectPlanReadings } from './reading-kind';
import { getCanonFinishedOn, getCompletedChapterKeys, isCanonFullyRead } from './reading-position';
import { isSameReference } from './reference';
import { createScheduleContext } from './schedule';
import type { ReadingCompletion, ReadingPlan, ReadingPlanDraft } from './types';

/**
 * Read-throughs (spec: bibletrackerweb#18).
 *
 * Every plan segment belongs to a numbered time through the Bible. Plan progress (the
 * queue, what is finished, "still to finish") counts the current read-through only, so
 * once the Bible is finished it can be read again from Genesis without deleting
 * anything. The calendar and streaks keep counting every reading.
 */

/** The read-through a segment belongs to. Without one, it is the first. */
export function getReadThrough(plan: ReadingPlan): number {
  return plan.readThrough ?? 1;
}

/** The read-through in progress: the active plan's, else the latest one, else 1. */
export function getCurrentReadThrough(
  plans: readonly ReadingPlan[],
  activePlan: ReadingPlan | null,
): number {
  if (activePlan !== null) return getReadThrough(activePlan);
  return plans.reduce((latest, plan) => Math.max(latest, getReadThrough(plan)), 1);
}

/**
 * The rows that count toward `readThrough`'s progress: its plan readings. A row belongs
 * to the read-through of the segment it was recorded against.
 */
export function selectProgressCompletions(
  plans: readonly ReadingPlan[],
  completions: readonly ReadingCompletion[],
  readThrough: number,
): ReadingCompletion[] {
  const readThroughOf = new Map(plans.map((plan) => [plan.id, getReadThrough(plan)]));
  return selectPlanReadings(completions).filter(
    (completion) => (readThroughOf.get(completion.readingPlanId) ?? 1) === readThrough,
  );
}

/**
 * The read-through a chapter recorded on a day counts toward, from that day's plan
 * readings, or null when the day holds no plan reading of it.
 *
 * The day sheet measures such a chapter there rather than in the read-through governing
 * the day: on the day a new read-through starts, the chapter that finished the last one
 * is finished, not unread in the new one. Extra readings are skipped: they never count
 * toward plan progress, whichever segment they are attached to.
 */
export function getRecordedReadThrough(
  plans: readonly ReadingPlan[],
  dayReadings: readonly ReadingCompletion[],
  reference: BibleReference,
): number | null {
  const recorded = dayReadings.find((row) => row.isExtra !== true && isSameReference(row, reference));
  if (recorded === undefined) return null;
  const plan = plans.find((each) => each.id === recorded.readingPlanId);
  return plan === undefined ? 1 : getReadThrough(plan);
}

/**
 * The day each finished read-through finished, by number. A read-through is finished
 * by the same rule as the app's "You have finished the Bible": its latest segment has
 * nothing left to read from where it starts.
 */
export function getReadThroughFinishDates(
  plans: readonly ReadingPlan[],
  completions: readonly ReadingCompletion[],
  index?: CanonIndex,
): Map<number, DateKey> {
  const finished = new Map<number, DateKey>();
  for (const [readThrough, latest] of latestSegments(plans)) {
    const canon = index ?? getCanonIndex(latest.canonId);
    const rows = selectProgressCompletions(plans, completions, readThrough);
    const read = getCompletedChapterKeys(rows, canon);
    if (!isCanonFullyRead(latest, read, canon, rows)) continue;
    const finishedOn = getCanonFinishedOn(latest, rows, canon);
    if (finishedOn !== null) finished.set(readThrough, finishedOn);
  }
  return finished;
}

/**
 * The canon finish date of every plan segment, each measured against the plan readings
 * of its own read-through. The provider puts this on the schedule context.
 *
 * `createScheduleContext` measures every segment against the rows it is given, which the
 * provider passes as the current read-through's. An earlier read-through's segments would
 * then look unfinished, and the days between finishing it and starting the next would
 * turn into missed ones. Measuring per segment, not per read-through, also keeps a finished
 * segment finished when a position change in the same read-through opens a new one.
 */
export function getSegmentFinishDates(
  plans: readonly ReadingPlan[],
  completions: readonly ReadingCompletion[],
  today: DateKey,
): Map<string, DateKey | null> {
  const finished = new Map<string, DateKey | null>();
  for (const readThrough of new Set(plans.map(getReadThrough))) {
    const rows = selectProgressCompletions(plans, completions, readThrough);
    // The context's own per-segment rule, so it is not written out twice.
    const context = createScheduleContext(plans, completions, today, undefined, rows);
    for (const plan of plans) {
      if (getReadThrough(plan) !== readThrough) continue;
      finished.set(plan.id, context.canonFinishedOnByPlan.get(plan.id) ?? null);
    }
  }
  return finished;
}

/** Whether a new read-through may start: the one in progress is finished. */
export function isCurrentReadThroughFinished(
  plans: readonly ReadingPlan[],
  activePlan: ReadingPlan | null,
  completions: readonly ReadingCompletion[],
): boolean {
  if (activePlan === null) return false;
  return getReadThroughFinishDates(plans, completions).has(getReadThrough(activePlan));
}

/**
 * The first segment of the next read-through: the canon's first chapter (Genesis 1),
 * from `startDate`, at the finished plan's pace.
 */
export function buildNextReadThroughDraft(plan: ReadingPlan, startDate: DateKey): ReadingPlanDraft {
  const first = getCanonIndex(plan.canonId).firstReference;
  return {
    canonId: plan.canonId,
    startDate,
    startBookId: first.bookId,
    startChapter: first.chapter,
    chaptersPerDay: plan.chaptersPerDay,
  };
}

/**
 * Each read-through's latest segment: the one it would carry on from.
 *
 * A segment replaced before the day it would have begun (a continuation set for
 * tomorrow, then a position change today) ends before it starts and governs no day, so
 * it is passed over, though its start date is the latest. A read-through made only of
 * such segments still has one.
 */
function latestSegments(plans: readonly ReadingPlan[]): Map<number, ReadingPlan> {
  const latest = latestByStart(plans.filter(governsAnyDay));
  for (const [readThrough, plan] of latestByStart(plans)) {
    if (!latest.has(readThrough)) latest.set(readThrough, plan);
  }
  return latest;
}

/** False for a segment closed before it began, which governs no date. */
function governsAnyDay(plan: ReadingPlan): boolean {
  return plan.endDate === null || compareDateKeys(plan.endDate, plan.startDate) >= 0;
}

function latestByStart(plans: readonly ReadingPlan[]): Map<number, ReadingPlan> {
  const latest = new Map<number, ReadingPlan>();
  for (const plan of plans) {
    const readThrough = getReadThrough(plan);
    const current = latest.get(readThrough);
    if (
      current === undefined ||
      compareDateKeys(plan.startDate, current.startDate) > 0 ||
      (plan.startDate === current.startDate && plan.createdAt > current.createdAt)
    ) {
      latest.set(readThrough, plan);
    }
  }
  return latest;
}
