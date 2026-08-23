import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';

import { getChapterProgress, getUnfinishedChapters } from '../chapter-progress';
import { makeCompletion } from './fixtures';

// Genesis 1 has 31 verses; Genesis 2 has 25.
const GEN1 = { bookId: 'GEN', chapter: 1 };
const GEN2 = { bookId: 'GEN', chapter: 2 };

function partial(localDate: string, chapter: number, from: number, to: number) {
  return makeCompletion(localDate, { chapter, verses: { from, to } });
}

describe('getChapterProgress', () => {
  it('treats a span-less row as the whole chapter', () => {
    // Every row written before verse tracking existed looks like this.
    const progress = getChapterProgress([makeCompletion('2026-08-01')], GEN1, PROTESTANT_CANON_INDEX);
    expect(progress?.isComplete).toBe(true);
    expect(progress?.remaining).toEqual([]);
    expect(progress?.verseCount).toBe(31);
  });

  it('reports a partial read', () => {
    const progress = getChapterProgress([partial('2026-08-01', 1, 1, 10)], GEN1, PROTESTANT_CANON_INDEX);
    expect(progress?.isPartial).toBe(true);
    expect(progress?.isComplete).toBe(false);
    expect(progress?.remaining).toEqual([{ from: 11, to: 31 }]);
  });

  it('joins spans read on different days — the whole point', () => {
    const progress = getChapterProgress(
      [partial('2026-08-01', 1, 1, 10), partial('2026-08-02', 1, 11, 31)],
      GEN1,
      PROTESTANT_CANON_INDEX,
    );
    expect(progress?.isComplete).toBe(true);
    expect(progress?.isPartial).toBe(false);
    expect(progress?.read).toEqual([{ from: 1, to: 31 }]);
  });

  it('ignores completions for other chapters', () => {
    const progress = getChapterProgress(
      [partial('2026-08-01', 2, 1, 25), partial('2026-08-01', 1, 1, 10)],
      GEN1,
      PROTESTANT_CANON_INDEX,
    );
    expect(progress?.read).toEqual([{ from: 1, to: 10 }]);
  });

  it('reports nothing read when there are no completions', () => {
    const progress = getChapterProgress([], GEN1, PROTESTANT_CANON_INDEX);
    expect(progress?.read).toEqual([]);
    expect(progress?.isPartial).toBe(false);
    expect(progress?.remaining).toEqual([{ from: 1, to: 31 }]);
  });

  it('is not complete when reading started after verse 1', () => {
    const progress = getChapterProgress([partial('2026-08-01', 1, 5, 31)], GEN1, PROTESTANT_CANON_INDEX);
    expect(progress?.isComplete).toBe(false);
    expect(progress?.remaining).toEqual([{ from: 1, to: 4 }]);
  });

  it('returns null for a chapter outside the canon', () => {
    expect(getChapterProgress([], { bookId: 'GEN', chapter: 51 }, PROTESTANT_CANON_INDEX)).toBeNull();
    expect(getChapterProgress([], { bookId: 'NOPE', chapter: 1 }, PROTESTANT_CANON_INDEX)).toBeNull();
  });

  it('handles a chapter finished in three sittings with a gap filled last', () => {
    const progress = getChapterProgress(
      [
        partial('2026-08-01', 1, 1, 10),
        partial('2026-08-03', 1, 20, 31),
        partial('2026-08-05', 1, 11, 19),
      ],
      GEN1,
      PROTESTANT_CANON_INDEX,
    );
    expect(progress?.isComplete).toBe(true);
  });
});

describe('getUnfinishedChapters', () => {
  it('lists only chapters that were started and not finished', () => {
    const unfinished = getUnfinishedChapters(
      [
        makeCompletion('2026-08-01'),                 // Genesis 1, whole chapter
        partial('2026-08-02', 2, 1, 10),              // Genesis 2, partial
      ],
      PROTESTANT_CANON_INDEX,
    );
    expect(unfinished).toHaveLength(1);
    expect(unfinished[0]?.reference).toEqual(GEN2);
    expect(unfinished[0]?.remaining).toEqual([{ from: 11, to: 25 }]);
  });

  it('is empty when everything is finished', () => {
    expect(
      getUnfinishedChapters([makeCompletion('2026-08-01')], PROTESTANT_CANON_INDEX),
    ).toEqual([]);
  });

  it('drops a chapter once it is completed later', () => {
    const unfinished = getUnfinishedChapters(
      [partial('2026-08-01', 1, 1, 10), partial('2026-08-02', 1, 11, 31)],
      PROTESTANT_CANON_INDEX,
    );
    expect(unfinished).toEqual([]);
  });

  it('orders the backlog by canon position', () => {
    const unfinished = getUnfinishedChapters(
      [
        makeCompletion('2026-08-02', { bookId: 'EXO', chapter: 1, verses: { from: 1, to: 5 } }),
        partial('2026-08-01', 1, 1, 5),
      ],
      PROTESTANT_CANON_INDEX,
    );
    expect(unfinished.map((p) => p.reference)).toEqual([GEN1, { bookId: 'EXO', chapter: 1 }]);
  });
});
