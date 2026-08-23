import { PROTESTANT_CANON } from '../protestant-canon';
import { PROTESTANT_VERSE_COUNTS, VERSE_TOTAL } from '../protestant-verse-counts';

/**
 * These assertions exist because the verse table was generated, not reviewed by eye.
 * A single mistyped number would silently break "is this chapter finished?" detection,
 * so the data is cross-checked against the independently written book list and against
 * a total that is easy to look up.
 */
describe('verse count data', () => {
  it('covers every book of the canon', () => {
    expect(Object.keys(PROTESTANT_VERSE_COUNTS)).toHaveLength(66);
    for (const book of PROTESTANT_CANON.books) {
      expect(PROTESTANT_VERSE_COUNTS[book.id]).toBeDefined();
    }
  });

  it('agrees with the hand-written chapter counts', () => {
    // Two independent sources: the book list was written by hand, the verse table
    // was generated. Disagreement means one of them is wrong.
    for (const book of PROTESTANT_CANON.books) {
      expect(book.verseCounts).toHaveLength(book.chapterCount);
    }
  });

  it('totals the documented number of verses', () => {
    const total = PROTESTANT_CANON.books.reduce(
      (sum, book) => sum + book.verseCounts.reduce((a, b) => a + b, 0),
      0,
    );
    expect(total).toBe(VERSE_TOTAL);
    // Critical-text numbering: 3 John has 15 verses, where the KJV has 14.
    expect(VERSE_TOTAL).toBe(31103);
  });

  it('has a positive integer verse count for every chapter', () => {
    for (const book of PROTESTANT_CANON.books) {
      for (const count of book.verseCounts) {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  it('matches well-known chapter lengths', () => {
    const book = (id: string) => PROTESTANT_CANON.books.find((b) => b.id === id);
    expect(book('GEN')?.verseCounts[0]).toBe(31);    // Genesis 1
    expect(book('PSA')?.verseCounts[116]).toBe(2);   // Psalm 117, the shortest
    expect(book('PSA')?.verseCounts[118]).toBe(176); // Psalm 119, the longest
    expect(book('JHN')?.verseCounts[10]).toBe(57);   // John 11
    expect(book('REV')?.verseCounts[21]).toBe(21);   // Revelation 22
    expect(book('OBA')?.verseCounts[0]).toBe(21);    // Obadiah, single chapter
  });
});
