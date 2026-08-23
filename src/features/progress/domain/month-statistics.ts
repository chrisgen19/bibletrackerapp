
import type { ScheduleContext } from '@/features/reading-plan/domain/schedule';
import {
  getEarliestPlanStart,
  isScheduledDay,
  type CompletionLookup,
} from '@/features/reading-plan/domain/schedule';
import type { ReadingPlan } from '@/features/reading-plan/domain/types';
import { compareDateKeys, minDateKey, type DateKey } from '@/utils/date-key';

/**
 * How a month should be summarised.
 *
 * The distinction matters for copy: a month before the plan began is not "0%
 * complete", and a future month is "scheduled", not "missed".
 */
export type MonthKind = 'no-plan' | 'before-plan' | 'past' | 'current' | 'future';

export interface MonthStatistics {
  readonly kind: MonthKind;
  /** Days in the month with a recorded completion. */
  readonly completedDays: number;
  /** Scheduled days that have already elapsed — the denominator for `percent`. */
  readonly expectedDays: number;
  /** Every scheduled day in the month, including days still to come. */
  readonly scheduledDays: number;
  /** 0–100, rounded. Zero when `expectedDays` is zero. */
  readonly percent: number;
}

export interface MonthStatisticsInput {
  readonly plans: readonly ReadingPlan[];
  readonly completions: CompletionLookup;
  /** Every day of the target month, in order. */
  readonly monthDates: readonly DateKey[];
  readonly today: DateKey;
  /** Supplies the reading position, so a finished canon stops expecting readings. */
  readonly context: ScheduleContext;
}

function emptyStatistics(kind: MonthKind): MonthStatistics {
  return { kind, completedDays: 0, expectedDays: 0, scheduledDays: 0, percent: 0 };
}

export function calculateMonthStatistics({
  plans,
  completions,
  monthDates,
  today,
  context,
}: MonthStatisticsInput): MonthStatistics {
  const firstDay = monthDates[0];
  const lastDay = monthDates[monthDates.length - 1];
  if (firstDay === undefined || lastDay === undefined) return emptyStatistics('no-plan');

  const planStart = getEarliestPlanStart(plans);
  if (planStart === null) return emptyStatistics('no-plan');

  // Entire month sits before the plan existed.
  if (compareDateKeys(lastDay, planStart) < 0) return emptyStatistics('before-plan');

  let completedDays = 0;
  let expectedDays = 0;
  let scheduledDays = 0;

  for (const date of monthDates) {
    if (!isScheduledDay(plans, date, context)) continue;
    scheduledDays += 1;

    const elapsed = compareDateKeys(date, today) <= 0;
    if (elapsed) expectedDays += 1;
    if (completions.has(date)) completedDays += 1;
  }

  const kind: MonthKind =
    compareDateKeys(firstDay, today) > 0 ? 'future' : compareDateKeys(lastDay, today) < 0 ? 'past' : 'current';

  const percent = expectedDays === 0 ? 0 : Math.round((completedDays / expectedDays) * 100);

  return { kind, completedDays, expectedDays, scheduledDays, percent };
}

/**
 * The last day of the month that counts toward "expected" progress.
 *
 * Exposed for copy such as "23 of 31 days" — the current month must compare
 * against days elapsed, never against days that have not happened yet.
 */
export function getProgressHorizon(monthLastDay: DateKey, today: DateKey): DateKey {
  return minDateKey(monthLastDay, today);
}

export function describeMonthProgress(stats: MonthStatistics): string {
  switch (stats.kind) {
    case 'no-plan':
      return 'No reading plan yet';
    case 'before-plan':
      return 'Before your plan began';
    case 'future':
      return `${stats.scheduledDays} ${stats.scheduledDays === 1 ? 'day' : 'days'} scheduled`;
    case 'past':
    case 'current':
      return `${stats.completedDays} of ${stats.expectedDays} ${stats.expectedDays === 1 ? 'day' : 'days'}`;
  }
}
