import type { BibleReference } from '@/data/bible/canon';
import { getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';
import {
  addDaysToDateKey,
  compareDateKeys,
  daysBetweenDateKeys,
  getTodayDateKey,
  isDateKeyWithin,
  maxDateKey,
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
   * The day the last chapter was read, once nothing is left owed, for the active plan.
   *
   * A date rather than a flag: days *after* the canon was finished expect no reading,
   * while the days leading up to it still counted.
   */
  readonly canonFinishedOn: DateKey | null;
  /**
   * The same date for every plan segment, by plan id.
   *
   * Each segment finishes on its own terms. Applying the active plan's date to every
   * segment turned an earlier segment's finished days into missed ones once the reader
   * moved on, and lent a later segment's date to days an earlier one still owed.
   */
  readonly canonFinishedOnByPlan: ReadonlyMap<string, DateKey | null>;
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
  const canonFinishedOnByPlan = new Map<string, DateKey | null>();
  for (const plan of plans) {
    const finished = isCanonFullyRead(plan, completed, index, completions);
    canonFinishedOnByPlan.set(plan.id, finished ? getCanonFinishedOn(plan, completions, index) : null);
  }

  return {
    byDate,
    unread: active === null ? [] : getUnreadSequence(active, completed, index, undefined, completions),
    today,
    todayRecorded: byDate.has(today),
    canonFinishedOn: active === null ? null : canonFinishedOnByPlan.get(active.id) ?? null,
    canonFinishedOnByPlan,
    completedKeys: completed,
    activePlan: active,
    index,
  };
}

/** The canon finish date for the segment `plan`. See {@link ScheduleContext.canonFinishedOnByPlan}. */
function getCanonFinishedOnFor(plan: ReadingPlan, context: ScheduleContext): DateKey | null {
  const own = context.canonFinishedOnByPlan.get(plan.id);
  // A plan the context was not built from (a draft, say) falls back to the active one.
  return own === undefined ? context.canonFinishedOn : own;
}

/**
 * Where the unread walk continues past the cached queue, or `null` when it cannot.
 *
 * Never behind the plan start. The queue can end on a chapter part-read behind it
 * (those are owed first), and resuming after one of those walked into chapters the
 * plan never covered, scheduling them for the following days.
 */
function getResumeIndex(context: ScheduleContext): number | null {
  const plan = context.activePlan;
  const last = context.unread[context.unread.length - 1];
  if (plan === null || last === undefined) return null;

  const lastIndex = context.index.toAbsoluteIndex(last);
  const start = context.index.toAbsoluteIndex({ bookId: plan.startBookId, chapter: plan.startChapter });
  if (lastIndex === null || start === null) return null;
  return Math.max(lastIndex + 1, start);
}

/**
 * The day that reads the head of the unread queue.
 *
 * Today, unless today is already recorded (the queue has already moved past what was
 * read, so tomorrow starts at its head) or the plan starts later. Counting from today
 * for a future start let the days before it consume chapters, so the preview shifted
 * as the start date approached.
 */
function getFirstSlotDay(plan: ReadingPlan, context: ScheduleContext): DateKey {
  const from = context.todayRecorded ? addDaysToDateKey(context.today, 1) : context.today;
  return maxDateKey(from, plan.startDate);
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

  const resumeFrom = getResumeIndex(context);
  if (resumeFrom === null) return context.unread.slice(slot, slot + count);

  const extended = [...context.unread];
  for (
    let absolute = resumeFrom;
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

  // Once nothing is owed, every later day is finished rather than missed. The finish
  // belongs to the segment governing this date, not to whichever plan is active now.
  const finishedOn = getCanonFinishedOnFor(plan, context);
  if (finishedOn !== null && compareDateKeys(date, finishedOn) > 0) {
    return { kind: 'canon-complete' };
  }

  const daysAhead = daysBetweenDateKeys(context.today, date);
  if (daysAhead < 0) return { kind: 'not-scheduled' };

  const slot = daysBetweenDateKeys(getFirstSlotDay(plan, context), date) * plan.chaptersPerDay;
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

/**
 * Every chapter still owed, counting past the cached queue.
 *
 * `context.unread` stops at UNREAD_HORIZON, so its length undercounts any plan with
 * more than that left: a new Genesis 1 plan looked 400 chapters long instead of 1,189.
 */
function countUnread(context: ScheduleContext): number {
  let count = context.unread.length;
  const resumeFrom = getResumeIndex(context);
  if (resumeFrom === null) return count;

  for (let absolute = resumeFrom; absolute < context.index.totalChapters; absolute += 1) {
    const reference = context.index.fromAbsoluteIndex(absolute);
    if (reference === null) break;
    if (!context.completedKeys.has(`${reference.bookId}:${reference.chapter}`)) count += 1;
  }
  return count;
}

/**
 * The day the plan would finish, if the reader keeps to one day per scheduled slot.
 *
 * Counts from the same first day as {@link calculateReadingForDate}, so the estimate
 * and the calendar agree, including for a plan that has not begun yet.
 */
export function getPlanCompletionDate(
  plan: ReadingPlan,
  context: ScheduleContext,
): DateKey | null {
  const remaining = countUnread(context);
  if (remaining === 0) return null;
  const days = Math.ceil(remaining / plan.chaptersPerDay);
  return addDaysToDateKey(getFirstSlotDay(plan, context), days - 1);
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
  const plan = resolvePlanForDate(plans, date);
  if (plan === null) return false;
  if (context.byDate.has(date)) return true;
  const finishedOn = getCanonFinishedOnFor(plan, context);
  if (finishedOn === null) return true;
  return compareDateKeys(date, finishedOn) <= 0;
}
