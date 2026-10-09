import type { BibleReference } from '@/data/bible/canon';
import { getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';
import { compareDateKeys, type DateKey } from '@/utils/date-key';

import { getChapterProgress } from './chapter-progress';
import type { ReadingCompletion, ReadingPlan } from './types';
import { isChapterComplete, mergeVerseRanges, wholeChapter } from './verse-range';

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
 * Chapters that were started but not finished, wherever they sit in the canon.
 *
 * These are owed regardless of the plan's start reference: a chapter part-read
 * through the Custom tab can sit *behind* the plan, and walking forward from the
 * plan start would step over it forever.
 */
export function getPartialChaptersBefore(
  completions: readonly ReadingCompletion[],
  absoluteLimit: number,
  index: CanonIndex,
): readonly BibleReference[] {
  const found = new Map<number, BibleReference>();

  for (const completion of completions) {
    const reference = { bookId: completion.bookId, chapter: completion.chapter };
    const absolute = index.toAbsoluteIndex(reference);
    if (absolute === null || absolute >= absoluteLimit || found.has(absolute)) continue;
    if (getChapterProgress(completions, reference, index)?.isPartial === true) {
      found.set(absolute, reference);
    }
  }

  return [...found.entries()].sort(([a], [b]) => a - b).map(([, reference]) => reference);
}

/**
 * The day a chapter first became complete.
 *
 * Rows are folded in date order and the date of the row that closed the chapter is
 * returned, so a later reread does not move it.
 */
export function getChapterCompletionDate(
  completions: readonly ReadingCompletion[],
  reference: BibleReference,
  index: CanonIndex,
): DateKey | null {
  const verseCount = index.getVerseCount(reference);
  if (verseCount === null) return null;

  const rows = completions
    .filter((row) => row.bookId === reference.bookId && row.chapter === reference.chapter)
    .sort((a, b) => compareDateKeys(a.localDate, b.localDate));

  const ranges = [];
  for (const row of rows) {
    ranges.push(row.verses ?? wholeChapter(verseCount));
    if (isChapterComplete(mergeVerseRanges(ranges, verseCount), verseCount)) return row.localDate;
  }
  return null;
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
  /** Completion rows, so chapters part-read behind the plan start stay reachable. */
  partials: readonly ReadingCompletion[] = [],
): readonly BibleReference[] {
  const start = index.toAbsoluteIndex({ bookId: plan.startBookId, chapter: plan.startChapter });
  if (start === null) return [];

  // Anything part-read behind the plan start comes first: it is already overdue. These
  // are never cut at `limit`, which bounds only the walk from the start: walking past
  // the cached queue resumes at the plan start, so one left out here would be skipped.
  const unread: BibleReference[] = [...getPartialChaptersBefore(partials, start, index)];

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
  partials: readonly ReadingCompletion[] = [],
): boolean {
  return getUnreadSequence(plan, completed, index, 1, partials).length === 0;
}

/**
 * When each chapter behind `absoluteLimit` sat part-read at the end of a day: from the
 * day it was first opened to the day it closed (`null` while it is still open).
 *
 * {@link getUnreadSequence} owes these chapters for exactly that span. A chapter read
 * whole on the day it was first opened was never owed, so it has no span.
 */
function getOwedSpansBefore(
  completions: readonly ReadingCompletion[],
  absoluteLimit: number,
  index: CanonIndex,
): readonly { from: DateKey; to: DateKey | null }[] {
  const firstRead = new Map<number, { reference: BibleReference; date: DateKey }>();
  for (const completion of completions) {
    const reference = { bookId: completion.bookId, chapter: completion.chapter };
    const absolute = index.toAbsoluteIndex(reference);
    if (absolute === null || absolute >= absoluteLimit) continue;
    const seen = firstRead.get(absolute);
    if (seen === undefined || compareDateKeys(completion.localDate, seen.date) < 0) {
      firstRead.set(absolute, { reference, date: completion.localDate });
    }
  }

  const spans: { from: DateKey; to: DateKey | null }[] = [];
  for (const { reference, date } of firstRead.values()) {
    const closed = getChapterCompletionDate(completions, reference, index);
    if (closed !== date) spans.push({ from: date, to: closed });
  }
  return spans;
}

/**
 * The first day the plan had nothing left owed.
 *
 * Taken from the chapter that closed last, not from the newest row in the database:
 * a reread logged afterwards must not drag the finish line forward and turn the days
 * in between into missed ones. Chapters part-read behind the plan start count while
 * they were owed: one still open on the day the last chapter closed pushes the finish
 * to the day it closed. One opened after the finish does not move it, so a finished
 * stretch of history stays finished.
 */
export function getCanonFinishedOn(
  plan: ReadingPlan,
  completions: readonly ReadingCompletion[],
  index: CanonIndex = getCanonIndex(plan.canonId),
): DateKey | null {
  const start = index.toAbsoluteIndex({ bookId: plan.startBookId, chapter: plan.startChapter });
  if (start === null) return null;

  let finished: DateKey | null = null;
  for (let absolute = start; absolute < index.totalChapters; absolute += 1) {
    const reference = index.fromAbsoluteIndex(absolute);
    if (reference === null) break;
    const closed = getChapterCompletionDate(completions, reference, index);
    if (closed === null) return null;
    if (finished === null || compareDateKeys(closed, finished) > 0) finished = closed;
  }
  if (finished === null) return null;

  // While a chapter behind the start was still owed at the end of that day, the plan
  // was not finished: move on to the day it closed. Each move goes strictly forward.
  const spans = getOwedSpansBefore(completions, start, index);
  let day: DateKey = finished;
  for (let moved = true; moved; ) {
    moved = false;
    for (const span of spans) {
      const owedThatDay =
        compareDateKeys(span.from, day) <= 0 && (span.to === null || compareDateKeys(span.to, day) > 0);
      if (!owedThatDay) continue;
      if (span.to === null) return null;
      day = span.to;
      moved = true;
    }
  }
  return day;
}
