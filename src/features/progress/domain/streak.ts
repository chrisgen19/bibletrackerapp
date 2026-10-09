import {
  getEarliestPlanStart,
  isScheduledDay,
  type CompletionLookup,
  type ScheduleContext,
} from '@/features/reading-plan/domain/schedule';
import type { ReadingPlan } from '@/features/reading-plan/domain/types';
import {
  compareDateKeys,
  daysBetweenDateKeys,
  eachDateKeyInRange,
  getTodayDateKey,
  type DateKey,
} from '@/utils/date-key';

export interface StreakSummary {
  readonly current: number;
  readonly longest: number;
}

const EMPTY_STREAKS: StreakSummary = { current: 0, longest: 0 };

/** Hard stop so a corrupt `startDate` far in the past cannot lock up the UI thread. */
const MAX_TIMELINE_DAYS = 365 * 200;

export interface StreakInput {
  readonly plans: readonly ReadingPlan[];
  readonly completions: CompletionLookup;
  /** Supplies the reading position, so a finished canon stops expecting readings. */
  readonly context: ScheduleContext;
  readonly today?: DateKey;
}

/**
 * Streak rules:
 *
 * - A streak is consecutive *scheduled* days that were completed.
 * - Today counts when completed, and is skipped (not broken) while still pending —
 *   an unread today only breaks the streak once the day has passed.
 * - Future days never participate.
 * - Days that are not scheduled (before the plan began, or after the canon was
 *   finished) are neutral: they neither extend nor break a run.
 */
export function calculateStreaks({ plans, completions, context, today = getTodayDateKey() }: StreakInput): StreakSummary {
  const start = getEarliestPlanStart(plans);
  if (start === null) return EMPTY_STREAKS;
  if (compareDateKeys(start, today) > 0) return EMPTY_STREAKS;

  const totalDays = daysBetweenDateKeys(start, today) + 1;
  if (totalDays <= 0 || totalDays > MAX_TIMELINE_DAYS) return EMPTY_STREAKS;

  let longest = 0;
  let run = 0;

  for (const date of eachDateKeyInRange(start, today)) {
    if (!isScheduledDay(plans, date, context)) continue;

    if (completions.has(date)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (date !== today) {
      run = 0;
    }
    // A pending today leaves `run` untouched: not extended, not broken.
  }

  // The loop ends on `today`, so the open run *is* the current streak.
  return { current: run, longest };
}

/** Copy such as "12 day streak" / "Start your streak today". */
export function describeStreak(streak: number): string {
  if (streak <= 0) return 'Start your streak today';
  if (streak === 1) return '1 day streak';
  return `${streak} day streak`;
}
