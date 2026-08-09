import type { BibleReference } from '@/data/bible/canon';
import { PROTESTANT_CANON_INDEX, type CanonIndex } from '@/data/bible/canon-index';

/**
 * Chapter progression across the canon.
 *
 * All functions are pure and canon-parameterised; the default index keeps call
 * sites terse for the single-canon V1 without hard-coding the book list.
 */

/**
 * The chapter after `reference`, crossing book boundaries.
 *
 * Returns `null` at the end of the canon (Revelation 22 → plan completed) and for
 * references that do not exist in the canon.
 */
export function getNextChapter(
  reference: BibleReference,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): BibleReference | null {
  return getChapterAtOffset(reference, 1, index);
}

/** The chapter before `reference`. Returns `null` before Genesis 1. */
export function getPreviousChapter(
  reference: BibleReference,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): BibleReference | null {
  return getChapterAtOffset(reference, -1, index);
}

/**
 * Walks `offset` chapters from `startReference`.
 *
 * `offset` may be negative or zero. Returns `null` when the walk leaves the canon
 * in either direction, or when `startReference` is not a valid reference.
 */
export function getChapterAtOffset(
  startReference: BibleReference,
  offset: number,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): BibleReference | null {
  if (!Number.isInteger(offset)) return null;
  const start = index.toAbsoluteIndex(startReference);
  if (start === null) return null;
  return index.fromAbsoluteIndex(start + offset);
}

/**
 * Up to `count` consecutive chapters starting at `startReference`.
 *
 * Truncates rather than failing when the canon ends mid-span, so a multi-chapter
 * plan can still finish on its last partial day.
 */
export function getChapterSpan(
  startReference: BibleReference,
  count: number,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): readonly BibleReference[] {
  if (count <= 0) return [];
  const start = index.toAbsoluteIndex(startReference);
  if (start === null) return [];

  const span: BibleReference[] = [];
  for (let i = 0; i < count; i += 1) {
    const reference = index.fromAbsoluteIndex(start + i);
    if (reference === null) break;
    span.push(reference);
  }
  return span;
}

/** Number of chapters remaining in the canon, inclusive of `reference`. */
export function getRemainingChapterCount(
  reference: BibleReference,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): number {
  const start = index.toAbsoluteIndex(reference);
  if (start === null) return 0;
  return index.totalChapters - start;
}

export function isValidReference(
  reference: BibleReference,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): boolean {
  return index.isValidReference(reference);
}

/** `"Genesis 1"`. Falls back to the raw book id if the canon lacks the book. */
export function formatReference(
  reference: BibleReference,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): string {
  const book = index.getBook(reference.bookId);
  return `${book?.name ?? reference.bookId} ${reference.chapter}`;
}

/** `"Gen 1"`, for dense surfaces such as calendar cells. */
export function formatReferenceShort(
  reference: BibleReference,
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): string {
  const book = index.getBook(reference.bookId);
  return `${book?.abbreviation ?? reference.bookId} ${reference.chapter}`;
}

/** `"Genesis 1–3"` for a contiguous span, `"Genesis 1"` for a single chapter. */
export function formatReferenceSpan(
  span: readonly BibleReference[],
  index: CanonIndex = PROTESTANT_CANON_INDEX,
): string {
  const first = span[0];
  if (first === undefined) return '';
  const last = span[span.length - 1];
  if (last === undefined || span.length === 1) return formatReference(first, index);
  if (first.bookId === last.bookId) {
    return `${formatReference(first, index)}–${last.chapter}`;
  }
  return `${formatReference(first, index)} – ${formatReference(last, index)}`;
}
