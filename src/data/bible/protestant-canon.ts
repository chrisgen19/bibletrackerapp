import type { BibleBook, Canon, TestamentId } from './canon';
import { PROTESTANT_VERSE_COUNTS } from './protestant-verse-counts';

interface BookSeed {
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly chapterCount: number;
}

const OLD_TESTAMENT: readonly BookSeed[] = [
  { id: 'GEN', name: 'Genesis', abbreviation: 'Gen', chapterCount: 50 },
  { id: 'EXO', name: 'Exodus', abbreviation: 'Exod', chapterCount: 40 },
  { id: 'LEV', name: 'Leviticus', abbreviation: 'Lev', chapterCount: 27 },
  { id: 'NUM', name: 'Numbers', abbreviation: 'Num', chapterCount: 36 },
  { id: 'DEU', name: 'Deuteronomy', abbreviation: 'Deut', chapterCount: 34 },
  { id: 'JOS', name: 'Joshua', abbreviation: 'Josh', chapterCount: 24 },
  { id: 'JDG', name: 'Judges', abbreviation: 'Judg', chapterCount: 21 },
  { id: 'RUT', name: 'Ruth', abbreviation: 'Ruth', chapterCount: 4 },
  { id: '1SA', name: '1 Samuel', abbreviation: '1 Sam', chapterCount: 31 },
  { id: '2SA', name: '2 Samuel', abbreviation: '2 Sam', chapterCount: 24 },
  { id: '1KI', name: '1 Kings', abbreviation: '1 Kgs', chapterCount: 22 },
  { id: '2KI', name: '2 Kings', abbreviation: '2 Kgs', chapterCount: 25 },
  { id: '1CH', name: '1 Chronicles', abbreviation: '1 Chr', chapterCount: 29 },
  { id: '2CH', name: '2 Chronicles', abbreviation: '2 Chr', chapterCount: 36 },
  { id: 'EZR', name: 'Ezra', abbreviation: 'Ezra', chapterCount: 10 },
  { id: 'NEH', name: 'Nehemiah', abbreviation: 'Neh', chapterCount: 13 },
  { id: 'EST', name: 'Esther', abbreviation: 'Esth', chapterCount: 10 },
  { id: 'JOB', name: 'Job', abbreviation: 'Job', chapterCount: 42 },
  { id: 'PSA', name: 'Psalms', abbreviation: 'Ps', chapterCount: 150 },
  { id: 'PRO', name: 'Proverbs', abbreviation: 'Prov', chapterCount: 31 },
  { id: 'ECC', name: 'Ecclesiastes', abbreviation: 'Eccl', chapterCount: 12 },
  { id: 'SNG', name: 'Song of Solomon', abbreviation: 'Song', chapterCount: 8 },
  { id: 'ISA', name: 'Isaiah', abbreviation: 'Isa', chapterCount: 66 },
  { id: 'JER', name: 'Jeremiah', abbreviation: 'Jer', chapterCount: 52 },
  { id: 'LAM', name: 'Lamentations', abbreviation: 'Lam', chapterCount: 5 },
  { id: 'EZK', name: 'Ezekiel', abbreviation: 'Ezek', chapterCount: 48 },
  { id: 'DAN', name: 'Daniel', abbreviation: 'Dan', chapterCount: 12 },
  { id: 'HOS', name: 'Hosea', abbreviation: 'Hos', chapterCount: 14 },
  { id: 'JOL', name: 'Joel', abbreviation: 'Joel', chapterCount: 3 },
  { id: 'AMO', name: 'Amos', abbreviation: 'Amos', chapterCount: 9 },
  { id: 'OBA', name: 'Obadiah', abbreviation: 'Obad', chapterCount: 1 },
  { id: 'JON', name: 'Jonah', abbreviation: 'Jonah', chapterCount: 4 },
  { id: 'MIC', name: 'Micah', abbreviation: 'Mic', chapterCount: 7 },
  { id: 'NAM', name: 'Nahum', abbreviation: 'Nah', chapterCount: 3 },
  { id: 'HAB', name: 'Habakkuk', abbreviation: 'Hab', chapterCount: 3 },
  { id: 'ZEP', name: 'Zephaniah', abbreviation: 'Zeph', chapterCount: 3 },
  { id: 'HAG', name: 'Haggai', abbreviation: 'Hag', chapterCount: 2 },
  { id: 'ZEC', name: 'Zechariah', abbreviation: 'Zech', chapterCount: 14 },
  { id: 'MAL', name: 'Malachi', abbreviation: 'Mal', chapterCount: 4 },
];

const NEW_TESTAMENT: readonly BookSeed[] = [
  { id: 'MAT', name: 'Matthew', abbreviation: 'Matt', chapterCount: 28 },
  { id: 'MRK', name: 'Mark', abbreviation: 'Mark', chapterCount: 16 },
  { id: 'LUK', name: 'Luke', abbreviation: 'Luke', chapterCount: 24 },
  { id: 'JHN', name: 'John', abbreviation: 'John', chapterCount: 21 },
  { id: 'ACT', name: 'Acts', abbreviation: 'Acts', chapterCount: 28 },
  { id: 'ROM', name: 'Romans', abbreviation: 'Rom', chapterCount: 16 },
  { id: '1CO', name: '1 Corinthians', abbreviation: '1 Cor', chapterCount: 16 },
  { id: '2CO', name: '2 Corinthians', abbreviation: '2 Cor', chapterCount: 13 },
  { id: 'GAL', name: 'Galatians', abbreviation: 'Gal', chapterCount: 6 },
  { id: 'EPH', name: 'Ephesians', abbreviation: 'Eph', chapterCount: 6 },
  { id: 'PHP', name: 'Philippians', abbreviation: 'Phil', chapterCount: 4 },
  { id: 'COL', name: 'Colossians', abbreviation: 'Col', chapterCount: 4 },
  { id: '1TH', name: '1 Thessalonians', abbreviation: '1 Thess', chapterCount: 5 },
  { id: '2TH', name: '2 Thessalonians', abbreviation: '2 Thess', chapterCount: 3 },
  { id: '1TI', name: '1 Timothy', abbreviation: '1 Tim', chapterCount: 6 },
  { id: '2TI', name: '2 Timothy', abbreviation: '2 Tim', chapterCount: 4 },
  { id: 'TIT', name: 'Titus', abbreviation: 'Titus', chapterCount: 3 },
  { id: 'PHM', name: 'Philemon', abbreviation: 'Phlm', chapterCount: 1 },
  { id: 'HEB', name: 'Hebrews', abbreviation: 'Heb', chapterCount: 13 },
  { id: 'JAS', name: 'James', abbreviation: 'Jas', chapterCount: 5 },
  { id: '1PE', name: '1 Peter', abbreviation: '1 Pet', chapterCount: 5 },
  { id: '2PE', name: '2 Peter', abbreviation: '2 Pet', chapterCount: 3 },
  { id: '1JN', name: '1 John', abbreviation: '1 John', chapterCount: 5 },
  { id: '2JN', name: '2 John', abbreviation: '2 John', chapterCount: 1 },
  { id: '3JN', name: '3 John', abbreviation: '3 John', chapterCount: 1 },
  { id: 'JUD', name: 'Jude', abbreviation: 'Jude', chapterCount: 1 },
  { id: 'REV', name: 'Revelation', abbreviation: 'Rev', chapterCount: 22 },
];

function toBooks(): readonly BibleBook[] {
  const sections: readonly (readonly [TestamentId, readonly BookSeed[]])[] = [
    ['old', OLD_TESTAMENT],
    ['new', NEW_TESTAMENT],
  ];

  const books: BibleBook[] = [];
  for (const [testament, seeds] of sections) {
    for (const seed of seeds) {
      const verseCounts = PROTESTANT_VERSE_COUNTS[seed.id];
      if (verseCounts === undefined) {
        throw new Error(`Missing verse counts for book "${seed.id}".`);
      }
      books.push({ ...seed, testament, verseCounts, order: books.length + 1 });
    }
  }
  return books;
}

export const PROTESTANT_CANON: Canon = {
  id: 'protestant',
  name: 'Protestant (66 books)',
  books: toBooks(),
};
