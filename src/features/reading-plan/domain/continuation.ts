import type { BibleReference } from '@/data/bible/canon';
import { getCanonIndex } from '@/data/bible/canon-index';
import { addDaysToDateKey, maxDateKey, type DateKey } from '@/utils/date-key';

import { getNextChapter } from './reference';
import type { ReadingPlan, ReadingPlanDraft } from './types';

/**
 * Builds the plan segment that continues on from a chapter the user logged by hand.
 *
 * The new segment begins at the chapter *after* the one logged, on the first day
 * that has not already been decided: the day after the logged date, or today if the
 * logged date is in the past. That leaves the logged day itself governed by whatever
 * plan governed it at the time — so the calendar's history does not move — while the
 * next unread day picks up where the user actually is.
 *
 * Returns `null` when there is nothing to continue to, i.e. the user logged the final
 * chapter of the canon.
 */
export function buildContinuationDraft(options: {
  readonly loggedChapter: BibleReference;
  readonly loggedDate: DateKey;
  readonly today: DateKey;
  /** Supplies canon and chapters-per-day; falls back to sensible defaults when absent. */
  readonly plan: ReadingPlan | null;
}): ReadingPlanDraft | null {
  const canonId = options.plan?.canonId ?? 'protestant';
  const index = getCanonIndex(canonId);

  const next = getNextChapter(options.loggedChapter, index);
  if (next === null) return null;

  return {
    canonId,
    startDate: maxDateKey(options.today, addDaysToDateKey(options.loggedDate, 1)),
    startBookId: next.bookId,
    startChapter: next.chapter,
    chaptersPerDay: options.plan?.chaptersPerDay ?? 1,
  };
}
