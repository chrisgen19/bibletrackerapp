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
