import type { BibleReference } from '@/data/bible/canon';
import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import { addDaysToDateKey, maxDateKey, type DateKey } from '@/utils/date-key';

import { getNextChapter } from './reference';
import type { CompletionLookup } from './schedule';
import type { ReadingPlan, ReadingPlanDraft } from './types';

/** Guards the forward scan against a pathological run of completed days. */
const MAX_SCAN_DAYS = 400;

export interface ContinuationInput {
  readonly loggedChapter: BibleReference;
  readonly loggedDate: DateKey;
  readonly today: DateKey;
  /** Supplies canon and chapters-per-day; falls back to defaults when absent. */
  readonly plan: ReadingPlan | null;
  /** Days already recorded, so the next chapter is not scheduled onto a finished day. */
  readonly completions: CompletionLookup;
}

/**
 * Builds the plan segment that continues on from a chapter the user logged by hand.
 *
 * The new segment begins at the chapter *after* the one logged, on the first day
 * that is both undecided and not already read:
 *
 * - never before the day after the logged date, so the logged day keeps its own
 *   history and the calendar does not shift underneath it;
 * - never in the past, so days that have already elapsed are not rewritten;
 * - never on a day that already has a completion. Skipping that last case would
 *   park the next chapter on a day the user has already ticked off, and the day
 *   after would advance past it — silently consuming a chapter they never read.
 *
 * Returns `null` when there is nothing to continue to, i.e. the user logged the
 * final chapter of the canon.
 */
export function buildContinuationDraft(options: ContinuationInput): ReadingPlanDraft | null {
  const canonId = options.plan?.canonId ?? DEFAULT_CANON_ID;
  const index = getCanonIndex(canonId);

  const next = getNextChapter(options.loggedChapter, index);
  if (next === null) return null;

  let startDate = maxDateKey(options.today, addDaysToDateKey(options.loggedDate, 1));
  for (let scanned = 0; scanned < MAX_SCAN_DAYS && options.completions.has(startDate); scanned += 1) {
    startDate = addDaysToDateKey(startDate, 1);
  }

  return {
    canonId,
    startDate,
    startBookId: next.bookId,
    startChapter: next.chapter,
    chaptersPerDay: options.plan?.chaptersPerDay ?? 1,
  };
}
