import type { BibleReference } from '@/data/bible/canon';
import { getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';

import { getChapterProgress } from './chapter-progress';
import type { ReadingCompletion, ReadingPlan } from './types';

/**
 * How far ahead the unread queue is built.
 *
 * The calendar previews at most a few months, so this is generous. It also bounds
 * the walk when a reader is thousands of chapters from the end of the canon.
 */
export const UNREAD_HORIZON = 400;

const key = (reference: BibleReference) => `${reference.bookId}:${reference.chapter}`;

/**
 * Chapters that have been read all the way through.
 *
 * A chapter left part-read is deliberately absent: it is still owed, so it stays at
 * the head of the queue rather than being stepped over.
 */
export function getCompletedChapterKeys(
  completions: readonly ReadingCompletion[],
  index: CanonIndex = getCanonIndex('protestant'),
): ReadonlySet<string> {
  const complete = new Set<string>();
  const checked = new Set<string>();

  for (const completion of completions) {
    const reference = { bookId: completion.bookId, chapter: completion.chapter };
    const id = key(reference);
    if (checked.has(id)) continue;
    checked.add(id);

    if (getChapterProgress(completions, reference, index)?.isComplete === true) {
      complete.add(id);
    }
  }

  return complete;
}

/**
 * The chapters still owed, in canon order, starting from where the plan begins.
 *
 * This is the reading position: it moves when you read, not when the date changes.
 * Chapters already finished are stepped over, so logging ahead of yourself is never
 * undone and a part-read chapter is never abandoned.
 */
export function getUnreadSequence(
  plan: ReadingPlan,
  completed: ReadonlySet<string>,
  index: CanonIndex = getCanonIndex(plan.canonId),
  limit: number = UNREAD_HORIZON,
): readonly BibleReference[] {
  const start = index.toAbsoluteIndex({ bookId: plan.startBookId, chapter: plan.startChapter });
  if (start === null) return [];

  const unread: BibleReference[] = [];
  for (let absolute = start; absolute < index.totalChapters && unread.length < limit; absolute += 1) {
    const reference = index.fromAbsoluteIndex(absolute);
    if (reference === null) break;
    if (!completed.has(key(reference))) unread.push(reference);
  }
  return unread;
}

/** True once every chapter from the plan's start to the end of the canon is read. */
export function isCanonFullyRead(
  plan: ReadingPlan,
  completed: ReadonlySet<string>,
  index: CanonIndex = getCanonIndex(plan.canonId),
): boolean {
  return getUnreadSequence(plan, completed, index, 1).length === 0;
}
