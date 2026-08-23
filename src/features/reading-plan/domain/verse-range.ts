import type { VerseRange } from '@/data/bible/canon';

/**
 * Verse-range arithmetic for partially-read chapters.
 *
 * Pure, canon-free and independent of the reading plan: the plan schedules whole
 * chapters, and these functions only answer "how much of this chapter is done?".
 */

/** Whole-chapter shorthand, used when a reading was not verse-limited. */
export function wholeChapter(verseCount: number): VerseRange {
  return { from: 1, to: verseCount };
}

/** Orders ranges and clamps them into `1..verseCount`, dropping anything empty. */
export function normaliseRanges(
  ranges: readonly VerseRange[],
  verseCount: number,
): readonly VerseRange[] {
  const clamped: VerseRange[] = [];
  for (const range of ranges) {
    const from = Math.max(1, Math.min(Math.trunc(range.from), Math.trunc(range.to)));
    const to = Math.min(verseCount, Math.max(Math.trunc(range.from), Math.trunc(range.to)));
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) clamped.push({ from, to });
  }
  return clamped.sort((a, b) => a.from - b.from || a.to - b.to);
}

/**
 * Collapses overlapping and adjacent ranges into the smallest equivalent set.
 *
 * Adjacency counts: 1–10 followed by 11–31 is one span, not two, which is exactly
 * the case of finishing a chapter the next day.
 */
export function mergeVerseRanges(
  ranges: readonly VerseRange[],
  verseCount: number,
): readonly VerseRange[] {
  const sorted = normaliseRanges(ranges, verseCount);
  const merged: VerseRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.from <= last.to + 1) {
      if (range.to > last.to) merged[merged.length - 1] = { from: last.from, to: range.to };
    } else {
      merged.push(range);
    }
  }
  return merged;
}

/** Total verses covered, counting any overlap only once. */
export function countVersesRead(ranges: readonly VerseRange[], verseCount: number): number {
  return mergeVerseRanges(ranges, verseCount).reduce((sum, r) => sum + (r.to - r.from + 1), 0);
}

/** True when the ranges cover every verse of the chapter. */
export function isChapterComplete(ranges: readonly VerseRange[], verseCount: number): boolean {
  if (verseCount <= 0) return false;
  const merged = mergeVerseRanges(ranges, verseCount);
  const first = merged[0];
  return merged.length === 1 && first !== undefined && first.from === 1 && first.to === verseCount;
}

/**
 * The gaps still to read, in order.
 *
 * Drives copy such as "Genesis 1 · 11–31 remaining", and is empty exactly when
 * {@link isChapterComplete} is true.
 */
export function getRemainingVerses(
  ranges: readonly VerseRange[],
  verseCount: number,
): readonly VerseRange[] {
  if (verseCount <= 0) return [];
  const merged = mergeVerseRanges(ranges, verseCount);
  const gaps: VerseRange[] = [];
  let cursor = 1;

  for (const range of merged) {
    if (range.from > cursor) gaps.push({ from: cursor, to: range.from - 1 });
    cursor = Math.max(cursor, range.to + 1);
  }
  if (cursor <= verseCount) gaps.push({ from: cursor, to: verseCount });
  return gaps;
}

/** `"11–31"`, or `"14"` for a single verse. Ranges use an en dash. */
export function formatVerseRange(range: VerseRange): string {
  return range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`;
}

/** `"1–10, 14–20"`. Empty string when there is nothing to describe. */
export function formatVerseRanges(ranges: readonly VerseRange[]): string {
  return ranges.map(formatVerseRange).join(', ');
}
