import type { BibleReference } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';

import { getChapterProgress } from './chapter-progress';
import { isSameReference } from './reference';
import type { ReadingCompletion, ReadingPlan } from './types';

/**
 * Extra readings (spec: bibletrackerweb#18).
 *
 * A plan reading moves the plan. An extra reading (a devotional passage, a jump far from
 * where the plan is) is recorded on its day and counts toward the streak, but never
 * touches the plan's chapter progress: it is not "still to finish", and the queue does
 * not skip its chapter later.
 */
export type ReadingKind = 'plan' | 'extra';

/** How far ahead of the position a Custom reading still counts as the plan: a week. */
export const PLAN_WINDOW_DAYS = 7;

/** Rows that count toward the plan. Rows written before extra readings (no flag) do. */
export function selectPlanReadings(completions: readonly ReadingCompletion[]): ReadingCompletion[] {
  return completions.filter((completion) => completion.isExtra !== true);
}

export interface ClassifyReadingInput {
  readonly reference: BibleReference;
  /** Plan readings only (see {@link selectPlanReadings}). */
  readonly planReadings: readonly ReadingCompletion[];
  /** The schedule's unread queue, built from the same plan readings. */
  readonly unread: readonly BibleReference[];
  /** The active plan, for its start and pace. */
  readonly plan: ReadingPlan | null;
  readonly index: CanonIndex;
}

/**
 * Whether a chapter logged from the Custom tab belongs to the plan.
 *
 * It does when it finishes a part-read chapter, fills a gap behind the reading position,
 * or sits within the next week of the queue. Anything else is extra: a chapter already
 * finished (a re-read) or one further ahead than a week of reading, such as Revelation
 * while the plan is in Leviticus.
 */
export function classifyCustomReading({
  reference,
  planReadings,
  unread,
  plan,
  index,
}: ClassifyReadingInput): ReadingKind {
  // Without a plan the write is refused anyway; there is nothing to be extra to.
  if (plan === null) return 'plan';

  const progress = getChapterProgress(planReadings, reference, index);
  if (progress?.isComplete === true) return 'extra';
  if (progress?.isPartial === true) return 'plan';

  const logged = index.toAbsoluteIndex(reference);
  const position = readingPosition(unread, plan, index);
  if (logged === null || position === null) return 'extra';

  const positionIndex = index.toAbsoluteIndex(position);
  if (positionIndex !== null && logged < positionIndex) return 'plan';

  const window = unread.slice(0, plan.chaptersPerDay * PLAN_WINDOW_DAYS);
  return window.some((upcoming) => isSameReference(upcoming, reference)) ? 'plan' : 'extra';
}

/**
 * Where the reader is: the first unread chapter at or after the plan's start. The queue
 * can open with part-read chapters from behind the start, which are not the position.
 * Null once nothing is left to read.
 */
function readingPosition(
  unread: readonly BibleReference[],
  plan: ReadingPlan,
  index: CanonIndex,
): BibleReference | null {
  const start = index.toAbsoluteIndex({
    bookId: plan.startBookId,
    chapter: plan.startChapter,
  });
  if (start === null) return unread[0] ?? null;
  return (
    unread.find((reference) => {
      const at = index.toAbsoluteIndex(reference);
      return at !== null && at >= start;
    }) ?? null
  );
}
