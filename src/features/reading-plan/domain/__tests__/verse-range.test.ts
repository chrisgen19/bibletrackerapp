import {
  countVersesRead,
  formatVerseRange,
  formatVerseRanges,
  getRemainingVerses,
  isChapterComplete,
  mergeVerseRanges,
  normaliseRanges,
  wholeChapter,
} from '../verse-range';

describe('mergeVerseRanges', () => {
  it('leaves a single range alone', () => {
    expect(mergeVerseRanges([{ from: 1, to: 10 }], 31)).toEqual([{ from: 1, to: 10 }]);
  });

  it('joins adjacent ranges — the finish-it-tomorrow case', () => {
    // Read 1-10 today, 11-31 tomorrow: one span, not two.
    expect(mergeVerseRanges([{ from: 1, to: 10 }, { from: 11, to: 31 }], 31)).toEqual([
      { from: 1, to: 31 },
    ]);
  });

  it('merges overlaps without double counting', () => {
    expect(mergeVerseRanges([{ from: 1, to: 12 }, { from: 8, to: 20 }], 31)).toEqual([
      { from: 1, to: 20 },
    ]);
  });

  it('keeps genuine gaps separate', () => {
    expect(mergeVerseRanges([{ from: 1, to: 5 }, { from: 10, to: 15 }], 31)).toEqual([
      { from: 1, to: 5 },
      { from: 10, to: 15 },
    ]);
  });

  it('sorts input given out of order', () => {
    expect(mergeVerseRanges([{ from: 20, to: 31 }, { from: 1, to: 10 }], 31)).toEqual([
      { from: 1, to: 10 },
      { from: 20, to: 31 },
    ]);
  });

  it('swallows a range contained in another', () => {
    expect(mergeVerseRanges([{ from: 1, to: 31 }, { from: 5, to: 9 }], 31)).toEqual([
      { from: 1, to: 31 },
    ]);
  });
});

describe('normaliseRanges', () => {
  it('clamps beyond the end of the chapter', () => {
    expect(normaliseRanges([{ from: 25, to: 99 }], 31)).toEqual([{ from: 25, to: 31 }]);
  });

  it('clamps below verse 1', () => {
    expect(normaliseRanges([{ from: 0, to: 5 }], 31)).toEqual([{ from: 1, to: 5 }]);
  });

  it('repairs a reversed range', () => {
    expect(normaliseRanges([{ from: 10, to: 3 }], 31)).toEqual([{ from: 3, to: 10 }]);
  });

  it('drops a range entirely past the end of the chapter', () => {
    expect(normaliseRanges([{ from: 40, to: 50 }], 31)).toEqual([]);
  });

  it('drops a range entirely before verse 1', () => {
    expect(normaliseRanges([{ from: -5, to: 0 }], 31)).toEqual([]);
  });

  it('drops a non-finite endpoint rather than clamping it', () => {
    // Clamping first would turn these into the whole chapter and report it complete.
    expect(normaliseRanges([{ from: Infinity, to: 1 }], 31)).toEqual([]);
    expect(normaliseRanges([{ from: 1, to: Infinity }], 31)).toEqual([]);
    expect(normaliseRanges([{ from: -Infinity, to: 5 }], 31)).toEqual([]);
    expect(normaliseRanges([{ from: Number.NaN, to: 5 }], 31)).toEqual([]);
  });

  it('keeps valid ranges alongside rejected ones', () => {
    expect(normaliseRanges([{ from: Infinity, to: 1 }, { from: 3, to: 8 }], 31)).toEqual([
      { from: 3, to: 8 },
    ]);
  });

  it('truncates fractional verses', () => {
    expect(normaliseRanges([{ from: 1.7, to: 10.2 }], 31)).toEqual([{ from: 1, to: 10 }]);
  });
});

describe('isChapterComplete', () => {
  it('is true for a whole chapter', () => {
    expect(isChapterComplete([wholeChapter(31)], 31)).toBe(true);
  });

  it('is true once two partial reads meet', () => {
    expect(isChapterComplete([{ from: 1, to: 10 }, { from: 11, to: 31 }], 31)).toBe(true);
  });

  it('is false while a verse is missing at the end', () => {
    expect(isChapterComplete([{ from: 1, to: 30 }], 31)).toBe(false);
  });

  it('is false while a verse is missing in the middle', () => {
    expect(isChapterComplete([{ from: 1, to: 10 }, { from: 12, to: 31 }], 31)).toBe(false);
  });

  it('is false when nothing has been read', () => {
    expect(isChapterComplete([], 31)).toBe(false);
  });

  it('is false when the opening verses were skipped', () => {
    // Reaching the last verse is not enough — the span must start at verse 1.
    expect(isChapterComplete([{ from: 5, to: 31 }], 31)).toBe(false);
  });

  it('is not fooled into completeness by a non-finite endpoint', () => {
    expect(isChapterComplete([{ from: Infinity, to: 1 }], 31)).toBe(false);
    expect(isChapterComplete([{ from: 1, to: Infinity }], 31)).toBe(false);
  });

  it('is false for a single mid-chapter span that touches the end', () => {
    expect(isChapterComplete([{ from: 31, to: 31 }], 31)).toBe(false);
  });

  it('handles a one-verse chapter', () => {
    expect(isChapterComplete([{ from: 1, to: 1 }], 1)).toBe(true);
  });
});

describe('getRemainingVerses', () => {
  it('reports the tail still to read', () => {
    expect(getRemainingVerses([{ from: 1, to: 10 }], 31)).toEqual([{ from: 11, to: 31 }]);
  });

  it('reports a gap in the middle', () => {
    expect(getRemainingVerses([{ from: 1, to: 10 }, { from: 20, to: 31 }], 31)).toEqual([
      { from: 11, to: 19 },
    ]);
  });

  it('reports the whole chapter when nothing is read', () => {
    expect(getRemainingVerses([], 31)).toEqual([{ from: 1, to: 31 }]);
  });

  it('is empty exactly when the chapter is complete', () => {
    expect(getRemainingVerses([wholeChapter(31)], 31)).toEqual([]);
  });

  it('reports a leading gap when reading started mid-chapter', () => {
    expect(getRemainingVerses([{ from: 5, to: 31 }], 31)).toEqual([{ from: 1, to: 4 }]);
  });
});

describe('countVersesRead', () => {
  it('counts a simple range inclusively', () => {
    expect(countVersesRead([{ from: 1, to: 10 }], 31)).toBe(10);
  });

  it('does not double count overlap', () => {
    expect(countVersesRead([{ from: 1, to: 10 }, { from: 5, to: 15 }], 31)).toBe(15);
  });

  it('counts nothing for no ranges', () => {
    expect(countVersesRead([], 31)).toBe(0);
  });
});

describe('formatting', () => {
  it('renders a span with an en dash', () => {
    expect(formatVerseRange({ from: 11, to: 31 })).toBe('11–31');
  });

  it('renders a single verse as one number', () => {
    expect(formatVerseRange({ from: 14, to: 14 })).toBe('14');
  });

  it('joins several spans', () => {
    expect(formatVerseRanges([{ from: 1, to: 10 }, { from: 14, to: 20 }])).toBe('1–10, 14–20');
  });

  it('renders nothing for an empty list', () => {
    expect(formatVerseRanges([])).toBe('');
  });
});
