/**
 * Canon-agnostic Bible metadata types.
 *
 * The reading-plan engine only ever talks to these interfaces, never to a
 * concrete book list, so an additional canon (Catholic, Orthodox, a chronological
 * ordering, ...) can be introduced by adding another {@link Canon} value.
 */

export type TestamentId = 'old' | 'new';

export interface BibleBook {
  /** Stable, canon-scoped identifier persisted in SQLite, e.g. `GEN`. */
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly testament: TestamentId;
  readonly chapterCount: number;
  /**
   * Verses per chapter, indexed from chapter 1. Length always equals `chapterCount`.
   *
   * Used only to decide when a partially-read chapter is finished — never for
   * scheduling, which stays chapter-based.
   */
  readonly verseCounts: readonly number[];
  /** 1-based position in this canon's reading order. */
  readonly order: number;
}

export interface Canon {
  readonly id: string;
  readonly name: string;
  /** Ordered by `order`, ascending. */
  readonly books: readonly BibleBook[];
}

export interface BibleReference {
  readonly bookId: string;
  readonly chapter: number;
}

export function referencesEqual(a: BibleReference, b: BibleReference): boolean {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

/**
 * An inclusive span of verses within a single chapter.
 *
 * Ranges are a *completion* concern: they record how much of a chapter has been
 * read. The reading plan itself never deals in verses.
 */
export interface VerseRange {
  readonly from: number;
  readonly to: number;
}
