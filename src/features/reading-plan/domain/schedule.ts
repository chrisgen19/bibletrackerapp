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

import {
  getCanonFinishedOn,
  getCompletedChapterKeys,
  getUnreadSequence,
  isCanonFullyRead,
} from './reading-position';
import { distinctReferences } from './reference';
import type { DayReading, ReadingCompletion, ReadingPlan, ReadingStatus, ScheduledReading } from './types';

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
 * Everything the schedule needs beyond a date.
 *
 * Readings are still derived rather than stored, but they are now derived from what
 * has been read as well as from the calendar. Build this once per render and pass it
 * down; the unread queue costs a canon walk.
 */
export interface ScheduleContext {
  readonly byDate: CompletionLookup;
  /** Chapters still owed, in canon order, from the active plan's start. */
  readonly unread: readonly BibleReference[];
  readonly today: DateKey;
  /** True when today already has a recorded reading, so it consumes no queue slot. */
  readonly todayRecorded: boolean;
  /**
   * The day the last chapter was read, once nothing is left owed.
   *
   * A date rather than a flag: days *after* the canon was finished expect no reading,
   * while the days leading up to it still counted.
   */
  readonly canonFinishedOn: DateKey | null;
  /** Chapters read in full, so slots past the cached queue can be derived on demand. */
  readonly completedKeys: ReadonlySet<string>;
  /** The plan governing today, whose canon and start reference define the queue. */
  readonly activePlan: ReadingPlan | null;
  readonly index: CanonIndex;
}

export function createScheduleContext(
  plans: readonly ReadingPlan[],
  completions: readonly ReadingCompletion[],
  today: DateKey = getTodayDateKey(),
  /** Injectable for tests; otherwise taken from the plan that governs today. */
  injectedIndex?: CanonIndex,
): ScheduleContext {
  const byDate = createCompletionLookup(completions);
  // Resolve the plan first: the canon belongs to the plan in force now, not to
  // whichever segment happens to be oldest.
  const active = resolvePlanForDate(plans, today) ?? plans[plans.length - 1] ?? null;
  const index = injectedIndex ?? getCanonIndex(active?.canonId ?? 'protestant');

  const completed = getCompletedChapterKeys(completions, index);
  const finished = active !== null && isCanonFullyRead(active, completed, index, completions);

  return {
    byDate,
    unread: active === null ? [] : getUnreadSequence(active, completed, index, undefined, completions),
    today,
    todayRecorded: byDate.has(today),
    canonFinishedOn: finished && active !== null ? getCanonFinishedOn(active, completions, index) : null,
    completedKeys: completed,
    activePlan: active,
    index,
  };
}

/**
 * The chapters at `slot` in the unread queue.
 *
 * The queue is cached only to the horizon, but the calendar pages forward without
 * limit. Past the cache the walk continues from where it stopped rather than
 * reporting the day as unscheduled — a plan with 789 chapters left must still show a
 * reading two years out.
 */
function readUnreadSlot(context: ScheduleContext, slot: number, count: number): readonly BibleReference[] {
  if (slot + count <= context.unread.length) return context.unread.slice(slot, slot + count);

  const plan = context.activePlan;
  const last = context.unread[context.unread.length - 1];
  if (plan === null || last === undefined) return context.unread.slice(slot, slot + count);

  const resumeFrom = context.index.toAbsoluteIndex(last);
  if (resumeFrom === null) return context.unread.slice(slot, slot + count);

  const extended = [...context.unread];
  for (
    let absolute = resumeFrom + 1;
    absolute < context.index.totalChapters && extended.length < slot + count;
    absolute += 1
  ) {
    const reference = context.index.fromAbsoluteIndex(absolute);
    if (reference === null) break;
    if (!context.completedKeys.has(`${reference.bookId}:${reference.chapter}`)) extended.push(reference);
  }
  return extended.slice(slot, slot + count);
}

/**
 * What a given day shows.
 *
 * - A day with a recording shows exactly what was recorded, permanently.
 * - A past day without one shows nothing: the position never moved, so no chapter
 *   was lost and none can be named.
 * - Today and future days draw from the unread queue in order.
 */
export function calculateReadingForDate(
  plan: ReadingPlan,
  date: DateKey,
  context: ScheduleContext,
): ScheduledReading {
  if (daysBetweenDateKeys(plan.startDate, date) < 0) return { kind: 'before-plan' };

  const recorded = context.byDate.get(date) ?? [];
  if (recorded.length > 0) {
    return {
      kind: 'scheduled',
      chapters: distinctReferences(recorded.map((row) => ({ bookId: row.bookId, chapter: row.chapter }))),
    };
  }

  // Once nothing is owed, every later day is finished rather than missed.
  if (context.canonFinishedOn !== null && compareDateKeys(date, context.canonFinishedOn) > 0) {
    return { kind: 'canon-complete' };
  }

  const daysAhead = daysBetweenDateKeys(context.today, date);
  if (daysAhead < 0) return { kind: 'not-scheduled' };

  // Today consumes the first slots unless it is already recorded, in which case the
  // queue has already skipped past what was read and tomorrow starts at its head.
  const slot = (daysAhead + (context.todayRecorded ? -1 : 0)) * plan.chaptersPerDay;
  if (slot < 0) return { kind: 'not-scheduled' };

  const chapters = readUnreadSlot(context, slot, plan.chaptersPerDay);
  // Empty now means the canon really is exhausted: the walk above runs to its end.
  if (chapters.length === 0) return { kind: 'canon-complete' };
  return { kind: 'scheduled', chapters };
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

/** The day the plan would finish, if the reader keeps to one day per scheduled slot. */
export function getPlanCompletionDate(
  plan: ReadingPlan,
  context: ScheduleContext,
): DateKey | null {
  if (context.unread.length === 0) return null;
  const days = Math.ceil(context.unread.length / plan.chaptersPerDay);
  const from = context.todayRecorded ? addDaysToDateKey(context.today, 1) : context.today;
  return addDaysToDateKey(from, days - 1);
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
  context: ScheduleContext,
): ReadingStatus {
  if (plan === null) {
    return context.byDate.has(date) ? 'completed' : 'no-plan';
  }
  if (context.byDate.has(date)) return 'completed';

  const scheduled = calculateReadingForDate(plan, date, context);
  switch (scheduled.kind) {
    case 'before-plan':
      return 'before-plan';
    case 'canon-complete':
      return 'canon-complete';
    case 'not-scheduled':
      return compareDateKeys(date, context.today) < 0 ? 'missed' : 'upcoming';
    case 'scheduled': {
      const relativeToToday = compareDateKeys(date, context.today);
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
  context: ScheduleContext,
): DayReading {
  const plan = resolvePlanForDate(plans, date);
  const scheduled: ScheduledReading =
    plan === null ? { kind: 'before-plan' } : calculateReadingForDate(plan, date, context);
  const rows = context.byDate.get(date) ?? [];

  return {
    date,
    status: resolveTimelineStatus(plans, plan, date, context),
    scheduled,
    // Deduplicated at source: a chapter read in two sittings produces two rows, but
    // "chapters completed on this day" is a set.
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
 * tell those apart — both arrive as a `null` plan.
 */
function resolveTimelineStatus(
  plans: readonly ReadingPlan[],
  plan: ReadingPlan | null,
  date: DateKey,
  context: ScheduleContext,
): ReadingStatus {
  if (plan !== null) return calculateReadingStatus(plan, date, context);
  if (context.byDate.has(date)) return 'completed';

  const earliest = getEarliestPlanStart(plans);
  if (earliest !== null && compareDateKeys(date, earliest) < 0) return 'before-plan';
  return 'no-plan';
}

/**
 * True when the reader was expected to read on this day.
 *
 * Every day from the plan's start counts, because the position no longer depends on
 * the date: you are expected to read daily until the canon is finished.
 */
export function isScheduledDay(
  plans: readonly ReadingPlan[],
  date: DateKey,
  context: ScheduleContext,
): boolean {
  if (resolvePlanForDate(plans, date) === null) return false;
  if (context.byDate.has(date)) return true;
  if (context.canonFinishedOn === null) return true;
  return compareDateKeys(date, context.canonFinishedOn) <= 0;
}
