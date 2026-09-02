import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';
import { PROTESTANT_CANON } from '@/data/bible/protestant-canon';

import {
  formatReference,
  formatReferenceSpan,
  getChapterAtOffset,
  getChapterSpan,
  getNextChapter,
  getPreviousChapter,
  getRemainingChapterCount,
  isSameReference,
  isValidReference,
} from '../reference';

describe('canon metadata', () => {
  it('contains the 66 books of the Protestant canon in order', () => {
    expect(PROTESTANT_CANON.books).toHaveLength(66);
    expect(PROTESTANT_CANON.books.map((book) => book.order)).toEqual(
      Array.from({ length: 66 }, (_, i) => i + 1),
    );
  });

  it('splits 39 Old Testament and 27 New Testament books', () => {
    const old = PROTESTANT_CANON.books.filter((book) => book.testament === 'old');
    const nt = PROTESTANT_CANON.books.filter((book) => book.testament === 'new');
    expect(old).toHaveLength(39);
    expect(nt).toHaveLength(27);
  });

  it('totals 1,189 chapters', () => {
    expect(PROTESTANT_CANON_INDEX.totalChapters).toBe(1189);
  });

  it('uses unique book ids', () => {
    const ids = new Set(PROTESTANT_CANON.books.map((book) => book.id));
    expect(ids.size).toBe(66);
  });
});

describe('getNextChapter', () => {
  it('advances within a book', () => {
    expect(getNextChapter({ bookId: 'GEN', chapter: 1 })).toEqual({ bookId: 'GEN', chapter: 2 });
  });

  it('crosses Genesis 49 → Genesis 50 → Exodus 1', () => {
    const genesis50 = getNextChapter({ bookId: 'GEN', chapter: 49 });
    expect(genesis50).toEqual({ bookId: 'GEN', chapter: 50 });
    expect(getNextChapter({ bookId: 'GEN', chapter: 50 })).toEqual({ bookId: 'EXO', chapter: 1 });
  });

  it('crosses the testament boundary Malachi 4 → Matthew 1', () => {
    expect(getNextChapter({ bookId: 'MAL', chapter: 4 })).toEqual({ bookId: 'MAT', chapter: 1 });
  });

  it('returns null after Revelation 22 (plan completed)', () => {
    expect(getNextChapter({ bookId: 'REV', chapter: 22 })).toBeNull();
  });

  it('returns null for a chapter that does not exist', () => {
    expect(getNextChapter({ bookId: 'GEN', chapter: 51 })).toBeNull();
    expect(getNextChapter({ bookId: 'NOPE', chapter: 1 })).toBeNull();
  });

  it('walks single-chapter books correctly', () => {
    expect(getNextChapter({ bookId: 'OBA', chapter: 1 })).toEqual({ bookId: 'JON', chapter: 1 });
    expect(getNextChapter({ bookId: '3JN', chapter: 1 })).toEqual({ bookId: 'JUD', chapter: 1 });
    expect(getNextChapter({ bookId: 'JUD', chapter: 1 })).toEqual({ bookId: 'REV', chapter: 1 });
  });
});

describe('getPreviousChapter', () => {
  it('steps back across a book boundary', () => {
    expect(getPreviousChapter({ bookId: 'EXO', chapter: 1 })).toEqual({ bookId: 'GEN', chapter: 50 });
    expect(getPreviousChapter({ bookId: 'MAT', chapter: 1 })).toEqual({ bookId: 'MAL', chapter: 4 });
  });

  it('returns null before Genesis 1', () => {
    expect(getPreviousChapter({ bookId: 'GEN', chapter: 1 })).toBeNull();
  });

  it('is the inverse of getNextChapter', () => {
    const start = { bookId: 'PSA', chapter: 150 };
    const next = getNextChapter(start);
    expect(next).not.toBeNull();
    expect(getPreviousChapter(next!)).toEqual(start);
  });
});

describe('getChapterAtOffset', () => {
  it('returns the same reference for offset 0', () => {
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, 0)).toEqual({ bookId: 'GEN', chapter: 1 });
  });

  it('walks forward across many books', () => {
    // Genesis 1 + 49 chapters = Genesis 50.
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, 49)).toEqual({ bookId: 'GEN', chapter: 50 });
    // Genesis 1 + 50 chapters = Exodus 1.
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, 50)).toEqual({ bookId: 'EXO', chapter: 1 });
  });

  it('reaches Revelation 22 at the final offset and nothing beyond', () => {
    const total = PROTESTANT_CANON_INDEX.totalChapters;
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, total - 1)).toEqual({
      bookId: 'REV',
      chapter: 22,
    });
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, total)).toBeNull();
  });

  it('accepts negative offsets and stops at the start of the canon', () => {
    expect(getChapterAtOffset({ bookId: 'EXO', chapter: 1 }, -1)).toEqual({ bookId: 'GEN', chapter: 50 });
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, -1)).toBeNull();
  });

  it('rejects non-integer offsets', () => {
    expect(getChapterAtOffset({ bookId: 'GEN', chapter: 1 }, 1.5)).toBeNull();
  });

  it('round-trips every book boundary in the canon', () => {
    let reference = PROTESTANT_CANON_INDEX.firstReference;
    let visited = 1;
    while (true) {
      const next = getNextChapter(reference);
      if (next === null) break;
      reference = next;
      visited += 1;
    }
    expect(visited).toBe(PROTESTANT_CANON_INDEX.totalChapters);
    expect(reference).toEqual({ bookId: 'REV', chapter: 22 });
  });
});

describe('getChapterSpan', () => {
  it('returns consecutive chapters across a book boundary', () => {
    expect(getChapterSpan({ bookId: 'GEN', chapter: 50 }, 2)).toEqual([
      { bookId: 'GEN', chapter: 50 },
      { bookId: 'EXO', chapter: 1 },
    ]);
  });

  it('truncates at the end of the canon instead of failing', () => {
    expect(getChapterSpan({ bookId: 'REV', chapter: 22 }, 3)).toEqual([{ bookId: 'REV', chapter: 22 }]);
  });
});

describe('validation and formatting', () => {
  it('validates chapters against the selected book', () => {
    expect(isValidReference({ bookId: 'GEN', chapter: 50 })).toBe(true);
    expect(isValidReference({ bookId: 'GEN', chapter: 51 })).toBe(false);
    expect(isValidReference({ bookId: 'PSA', chapter: 150 })).toBe(true);
    expect(isValidReference({ bookId: 'PSA', chapter: 151 })).toBe(false);
    expect(isValidReference({ bookId: 'OBA', chapter: 1 })).toBe(true);
    expect(isValidReference({ bookId: 'OBA', chapter: 2 })).toBe(false);
    expect(isValidReference({ bookId: 'GEN', chapter: 0 })).toBe(false);
    expect(isValidReference({ bookId: 'GEN', chapter: 1.5 })).toBe(false);
  });

  it('counts remaining chapters inclusively', () => {
    expect(getRemainingChapterCount({ bookId: 'REV', chapter: 22 })).toBe(1);
    expect(getRemainingChapterCount({ bookId: 'GEN', chapter: 1 })).toBe(1189);
  });

  it('formats references for display', () => {
    expect(formatReference({ bookId: 'GEN', chapter: 24 })).toBe('Genesis 24');
    expect(formatReference({ bookId: '1CO', chapter: 13 })).toBe('1 Corinthians 13');
  });

  it('formats spans', () => {
    expect(formatReferenceSpan([{ bookId: 'GEN', chapter: 1 }])).toBe('Genesis 1');
    expect(
      formatReferenceSpan([
        { bookId: 'GEN', chapter: 1 },
        { bookId: 'GEN', chapter: 3 },
      ]),
    ).toBe('Genesis 1–3');
    expect(
      formatReferenceSpan([
        { bookId: 'GEN', chapter: 50 },
        { bookId: 'EXO', chapter: 1 },
      ]),
    ).toBe('Genesis 50 – Exodus 1');
  });
});

describe('isSameReference', () => {
  it('matches on book and chapter together', () => {
    expect(isSameReference({ bookId: 'LEV', chapter: 6 }, { bookId: 'LEV', chapter: 6 })).toBe(true);
    expect(isSameReference({ bookId: 'LEV', chapter: 6 }, { bookId: 'LEV', chapter: 7 })).toBe(false);
    // The chapter number alone is not enough: every book has a chapter 6.
    expect(isSameReference({ bookId: 'LEV', chapter: 6 }, { bookId: 'GEN', chapter: 6 })).toBe(false);
  });
});
