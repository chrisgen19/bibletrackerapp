import type { BibleReference, VerseRange } from '@/data/bible/canon';
import { getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';

import type { ReadingCompletion } from './types';
import { getRemainingVerses, isChapterComplete, mergeVerseRanges, wholeChapter } from './verse-range';

export interface ChapterProgress {
  readonly reference: BibleReference;
  readonly verseCount: number;
  /** Everything read so far, merged and in order. */
  readonly read: readonly VerseRange[];
  /** Gaps still to read. Empty exactly when `isComplete` is true. */
  readonly remaining: readonly VerseRange[];
  readonly isComplete: boolean;
  /** True when something has been read but the chapter is unfinished. */
  readonly isPartial: boolean;
}

/**
 * How much of one chapter has been read, across every day it was touched.
 *
 * Deliberately **not** grouped by date: reading verses 1–10 on Monday and 11–31 on
 * Tuesday is one chapter finished, and only a book-and-chapter view can see that.
 * A row with no span counts as the whole chapter, which is how every reading
 * recorded before verse tracking is interpreted.
 */
export function getChapterProgress(
  completions: readonly ReadingCompletion[],
  reference: BibleReference,
  index: CanonIndex = getCanonIndex('protestant'),
): ChapterProgress | null {
  const verseCount = index.getVerseCount(reference);
  if (verseCount === null) return null;

  const ranges: VerseRange[] = [];
  for (const completion of completions) {
    if (completion.bookId !== reference.bookId || completion.chapter !== reference.chapter) continue;
    ranges.push(completion.verses ?? wholeChapter(verseCount));
  }

  const read = mergeVerseRanges(ranges, verseCount);
  const remaining = getRemainingVerses(read, verseCount);
  const complete = isChapterComplete(read, verseCount);

  return {
    reference,
    verseCount,
    read,
    remaining,
    isComplete: complete,
    isPartial: read.length > 0 && !complete,
  };
}

/**
 * How many distinct chapters have been read all the way through.
 *
 * Not the number of completion rows: a chapter read in two sittings produces two
 * rows, and a chapter left half-read produces one without being finished at all.
 */
export function countChaptersRead(
  completions: readonly ReadingCompletion[],
  index: CanonIndex = getCanonIndex('protestant'),
): number {
  const seen = new Set<string>();
  let finished = 0;
  for (const completion of completions) {
    const key = `${completion.bookId}:${completion.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const progress = getChapterProgress(
      completions,
      { bookId: completion.bookId, chapter: completion.chapter },
      index,
    );
    if (progress?.isComplete === true) finished += 1;
  }
  return finished;
}

/**
 * Chapters that were started but never finished.
 *
 * This is the backlog the UI surfaces as "still to finish". Ordered by canon
 * position so the oldest unfinished reading comes first.
 */
export function getUnfinishedChapters(
  completions: readonly ReadingCompletion[],
  index: CanonIndex = getCanonIndex('protestant'),
): readonly ChapterProgress[] {
  const seen = new Map<string, BibleReference>();
  for (const completion of completions) {
    const key = `${completion.bookId}:${completion.chapter}`;
    if (!seen.has(key)) seen.set(key, { bookId: completion.bookId, chapter: completion.chapter });
  }

  const unfinished: ChapterProgress[] = [];
  for (const reference of seen.values()) {
    const progress = getChapterProgress(completions, reference, index);
    if (progress !== null && progress.isPartial) unfinished.push(progress);
  }

  return unfinished.sort(
    (a, b) => (index.toAbsoluteIndex(a.reference) ?? 0) - (index.toAbsoluteIndex(b.reference) ?? 0),
  );
}
