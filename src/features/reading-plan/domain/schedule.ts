import type { BibleReference } from '@/data/bible/canon';
import { getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';
import {
  addDaysToDateKey,
  compareDateKeys,
  daysBetweenDateKeys,
  getTodayDateKey,
  isDateKeyWithin,
  type DateKey,
} from '@/utils/date-key';

import { distinctReferences, getChapterSpan } from './reference';
import type { DayReading, ReadingCompletion, ReadingPlan, ReadingStatus, ScheduledReading } from './types';

/**
 * Scheduled readings are never persisted. They are derived from
 * `(startDate, startReference, chaptersPerDay, targetDate)` so that a plan of any
 * length costs one row, and so that future days can be previewed indefinitely.
 */
export function calculateReadingForDate(
  plan: ReadingPlan,
  date: DateKey,
  index: CanonIndex = getCanonIndex(plan.canonId),
): ScheduledReading {
  const dayOffset = daysBetweenDateKeys(plan.startDate, date);
  if (dayOffset < 0) return { kind: 'before-plan' };

  const startReference: BibleReference = { bookId: plan.startBookId, chapter: plan.startChapter };
  const chapterOffset = dayOffset * plan.chaptersPerDay;
  const startIndex = index.toAbsoluteIndex(startReference);
  if (startIndex === null) return { kind: 'before-plan' };

  const absolute = startIndex + chapterOffset;
  if (absolute >= index.totalChapters) return { kind: 'canon-complete' };

  const first = index.fromAbsoluteIndex(absolute);
  if (first === null) return { kind: 'canon-complete' };

  return { kind: 'scheduled', chapters: getChapterSpan(first, plan.chaptersPerDay, index) };
}

/** The last calendar day on which this plan still has chapters to read, if it terminates. */
export function getPlanCompletionDate(
  plan: ReadingPlan,
  index: CanonIndex = getCanonIndex(plan.canonId),
): DateKey | null {
  const startIndex = index.toAbsoluteIndex({ bookId: plan.startBookId, chapter: plan.startChapter });
  if (startIndex === null) return null;
  const remaining = index.totalChapters - startIndex;
  const days = Math.ceil(remaining / plan.chaptersPerDay);
  return addDaysToDateKey(plan.startDate, days - 1);
}

/**
 * Resolves which plan segment governs `date`.
 *
 * Segments are half-open on the right (`endDate` inclusive); the active segment
 * has `endDate === null`. Later segments win when ranges overlap, which cannot
 * happen through the repository but is cheap to make safe.
 */
export function resolvePlanForDate(plans: readonly ReadingPlan[], date: DateKey): ReadingPlan | null {
  let match: ReadingPlan | null = null;
  for (const plan of plans) {
    if (!isDateKeyWithin(date, plan.startDate, plan.endDate)) continue;
    if (match === null || compareDateKeys(plan.startDate, match.startDate) >= 0) {
      match = plan;
    }
  }
  return match;
}

export function getEarliestPlanStart(plans: readonly ReadingPlan[]): DateKey | null {
  let earliest: DateKey | null = null;
  for (const plan of plans) {
    if (earliest === null || compareDateKeys(plan.startDate, earliest) < 0) {
      earliest = plan.startDate;
    }
  }
  return earliest;
}

export interface CompletionLookup {
  has(date: DateKey): boolean;
  get(date: DateKey): ReadingCompletion[] | undefined;
}

/** Groups completion rows by local date. A day can hold several rows when `chaptersPerDay > 1`. */
export function createCompletionLookup(completions: readonly ReadingCompletion[]): CompletionLookup {
  const byDate = new Map<DateKey, ReadingCompletion[]>();
  for (const completion of completions) {
    const existing = byDate.get(completion.localDate);
    if (existing === undefined) {
      byDate.set(completion.localDate, [completion]);
    } else {
      existing.push(completion);
    }
  }
  return {
    has: (date) => byDate.has(date),
    get: (date) => byDate.get(date),
  };
}

/**
 * Presentation status for a single day.
 *
 * Today is never `missed` — an unread today stays `today-pending` until the day
 * has actually passed.
 */
export function calculateReadingStatus(
  plan: ReadingPlan | null,
  date: DateKey,
  completions: CompletionLookup,
  today: DateKey = getTodayDateKey(),
): ReadingStatus {
  if (plan === null) {
    return completions.has(date) ? 'completed' : 'no-plan';
  }

  const scheduled = calculateReadingForDate(plan, date);
  if (completions.has(date)) return 'completed';

  switch (scheduled.kind) {
    case 'before-plan':
      return 'before-plan';
    case 'canon-complete':
      return 'canon-complete';
    case 'scheduled': {
      const relativeToToday = compareDateKeys(date, today);
      if (relativeToToday > 0) return 'upcoming';
      if (relativeToToday === 0) return 'today-pending';
      return 'missed';
    }
  }
}

/** Everything a calendar cell or day-detail sheet needs about one date. */
export function getDayReading(
  plans: readonly ReadingPlan[],
  date: DateKey,
  completions: CompletionLookup,
  today: DateKey = getTodayDateKey(),
): DayReading {
  const plan = resolvePlanForDate(plans, date);
  const scheduled: ScheduledReading =
    plan === null ? { kind: 'before-plan' } : calculateReadingForDate(plan, date);
  const rows = completions.get(date) ?? [];

  return {
    date,
    status: resolveTimelineStatus(plans, plan, date, completions, today),
    scheduled,
    // Deduplicated at source: a chapter read in two sittings produces two rows, but
    // "chapters completed on this day" is a set. Leaving duplicates here made three
    // separate surfaces render "Genesis 21–21" and inflate counts.
    completedChapters: distinctReferences(
      rows.map((row) => ({ bookId: row.bookId, chapter: row.chapter })),
    ),
    plan,
  };
}

/**
 * Distinguishes "no plan has ever existed" from "this day predates the plan".
 *
 * {@link calculateReadingStatus} only sees one segment, so on its own it cannot
 * tell those apart — both arrive as a `null` plan. The calendar needs the
 * difference for its copy and its screen-reader labels.
 */
function resolveTimelineStatus(
  plans: readonly ReadingPlan[],
  plan: ReadingPlan | null,
  date: DateKey,
  completions: CompletionLookup,
  today: DateKey,
): ReadingStatus {
  if (plan !== null) return calculateReadingStatus(plan, date, completions, today);
  if (completions.has(date)) return 'completed';

  const earliest = getEarliestPlanStart(plans);
  if (earliest !== null && compareDateKeys(date, earliest) < 0) return 'before-plan';
  return 'no-plan';
}

/** True when the date is a day the user is expected to read (used by streaks and stats). */
export function isScheduledDay(plans: readonly ReadingPlan[], date: DateKey): boolean {
  const plan = resolvePlanForDate(plans, date);
  if (plan === null) return false;
  return calculateReadingForDate(plan, date).kind === 'scheduled';
}
