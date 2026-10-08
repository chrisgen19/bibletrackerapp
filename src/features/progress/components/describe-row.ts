import type { CanonIndex } from '@/data/bible/canon-index';
import { formatReference } from '@/features/reading-plan/domain/reference';
import type { ReadingCompletion } from '@/features/reading-plan/domain/types';
import { formatVerseRange } from '@/features/reading-plan/domain/verse-range';

/** `"Leviticus 6:1–7"`, or `"Leviticus 6"` when no span was recorded. */
export function describeRow(row: ReadingCompletion, index: CanonIndex): string {
  const reference = formatReference({ bookId: row.bookId, chapter: row.chapter }, index);
  return row.verses === null ? reference : `${reference}:${formatVerseRange(row.verses)}`;
}
