import type { BibleBook, BibleReference, Canon } from './canon';
import { PROTESTANT_CANON } from './protestant-canon';

/**
 * A precomputed lookup structure over a {@link Canon}.
 *
 * Chapters are projected onto a single 0-based "absolute chapter" axis
 * (Genesis 1 = 0 ... Revelation 22 = 1188 for the Protestant canon). Reading-plan
 * arithmetic then reduces to integer addition, and mapping back to a book uses a
 * binary search over cumulative chapter counts instead of walking the book list.
 */
export interface CanonIndex {
  readonly canon: Canon;
  readonly books: readonly BibleBook[];
  readonly totalChapters: number;
  getBook(bookId: string): BibleBook | undefined;
  hasBook(bookId: string): boolean;
  isValidReference(reference: BibleReference): boolean;
  /** `null` when the reference does not exist in this canon. */
  toAbsoluteIndex(reference: BibleReference): number | null;
  /** `null` when the index falls outside the canon. */
  fromAbsoluteIndex(absoluteIndex: number): BibleReference | null;
  readonly firstReference: BibleReference;
  readonly lastReference: BibleReference;
}

function buildCumulativeStarts(books: readonly BibleBook[]): readonly number[] {
  const starts: number[] = new Array<number>(books.length);
  let running = 0;
  for (let i = 0; i < books.length; i += 1) {
    starts[i] = running;
    running += books[i]?.chapterCount ?? 0;
  }
  return starts;
}

/** Index of the last book whose start offset is `<= absoluteIndex`. */
function findBookSlot(starts: readonly number[], absoluteIndex: number): number {
  let low = 0;
  let high = starts.length - 1;
  let result = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((starts[mid] ?? 0) <= absoluteIndex) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

export function createCanonIndex(canon: Canon): CanonIndex {
  const books = [...canon.books].sort((a, b) => a.order - b.order);
  const byId = new Map(books.map((book) => [book.id, book]));
  const slotById = new Map(books.map((book, slot) => [book.id, slot]));
  const starts = buildCumulativeStarts(books);
  const totalChapters = books.reduce((sum, book) => sum + book.chapterCount, 0);

  const firstBook = books[0];
  const lastBook = books[books.length - 1];
  if (firstBook === undefined || lastBook === undefined) {
    throw new Error(`Canon "${canon.id}" contains no books.`);
  }

  function isValidReference(reference: BibleReference): boolean {
    const book = byId.get(reference.bookId);
    if (book === undefined) return false;
    return Number.isInteger(reference.chapter) && reference.chapter >= 1 && reference.chapter <= book.chapterCount;
  }

  return {
    canon,
    books,
    totalChapters,
    getBook: (bookId) => byId.get(bookId),
    hasBook: (bookId) => byId.has(bookId),
    isValidReference,
    toAbsoluteIndex(reference) {
      if (!isValidReference(reference)) return null;
      const slot = slotById.get(reference.bookId);
      const start = slot === undefined ? undefined : starts[slot];
      if (start === undefined) return null;
      return start + reference.chapter - 1;
    },
    fromAbsoluteIndex(absoluteIndex) {
      if (!Number.isInteger(absoluteIndex) || absoluteIndex < 0 || absoluteIndex >= totalChapters) {
        return null;
      }
      const slot = findBookSlot(starts, absoluteIndex);
      const book = books[slot];
      const start = starts[slot];
      if (book === undefined || start === undefined) return null;
      return { bookId: book.id, chapter: absoluteIndex - start + 1 };
    },
    firstReference: { bookId: firstBook.id, chapter: 1 },
    lastReference: { bookId: lastBook.id, chapter: lastBook.chapterCount },
  };
}

/** The canon used by V1. Registered here so alternative canons can be added later. */
export const PROTESTANT_CANON_INDEX = createCanonIndex(PROTESTANT_CANON);

const CANON_REGISTRY = new Map<string, CanonIndex>([[PROTESTANT_CANON.id, PROTESTANT_CANON_INDEX]]);

export const DEFAULT_CANON_ID = PROTESTANT_CANON.id;

/** Falls back to the default canon so a stale persisted `canonId` cannot brick the app. */
export function getCanonIndex(canonId: string): CanonIndex {
  return CANON_REGISTRY.get(canonId) ?? PROTESTANT_CANON_INDEX;
}
