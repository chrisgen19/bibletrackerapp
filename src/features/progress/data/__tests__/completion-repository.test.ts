import type { ReadingDatabase } from '@/db/client';
import { createReadingPlan } from '@/features/reading-plan/data/reading-plan-repository';
import type { ReadingPlan } from '@/features/reading-plan/domain/types';
import { createTestDatabase } from '@/test-utils/test-database';

import {
  countAllCompletions,
  getAllCompletions,
  getCompletionsForDate,
  getCompletionsForRange,
  markReadingComplete,
  removeReadingCompletion,
} from '../completion-repository';

let db: ReadingDatabase;
let plan: ReadingPlan;

beforeEach(() => {
  db = createTestDatabase();
  plan = createReadingPlan(db, {
    canonId: 'protestant',
    startDate: '2026-07-20',
    startBookId: 'GEN',
    startChapter: 1,
    chaptersPerDay: 1,
  });
});

function complete(localDate: string, chapter: number, bookId = 'GEN') {
  markReadingComplete(db, {
    readingPlanId: plan.id,
    localDate,
    chapters: [{ bookId, chapter }],
    completedAt: 1_000,
  });
}

describe('markReadingComplete', () => {
  it('records the chapter against the day', () => {
    complete('2026-08-01', 13);

    expect(getCompletionsForDate(db, '2026-08-01')).toEqual([
      expect.objectContaining({ localDate: '2026-08-01', bookId: 'GEN', chapter: 13 }),
    ]);
  });

  it('is idempotent — marking the same day twice does not duplicate', () => {
    complete('2026-08-01', 13);
    complete('2026-08-01', 13);

    expect(countAllCompletions(db)).toBe(1);
  });

  it('writes one row per chapter for a multi-chapter day', () => {
    markReadingComplete(db, {
      readingPlanId: plan.id,
      localDate: '2026-08-01',
      chapters: [
        { bookId: 'GEN', chapter: 13 },
        { bookId: 'GEN', chapter: 14 },
      ],
    });

    expect(getCompletionsForDate(db, '2026-08-01')).toHaveLength(2);
  });

  it('allows the same chapter on a different day', () => {
    // Re-reading a chapter later is legitimate; the unique index is per day.
    complete('2026-08-01', 13);
    complete('2026-08-02', 13);

    expect(countAllCompletions(db)).toBe(2);
  });

  it('snapshots the chapter rather than deriving it later', () => {
    // A day logged as John 3 must stay John 3 whatever the plan says afterwards.
    complete('2026-08-01', 3, 'JHN');

    expect(getCompletionsForDate(db, '2026-08-01')[0]).toMatchObject({
      bookId: 'JHN',
      chapter: 3,
    });
  });
});

describe('getCompletionsForRange', () => {
  beforeEach(() => {
    complete('2026-07-31', 12);
    complete('2026-08-01', 13);
    complete('2026-08-15', 27);
    complete('2026-09-01', 44);
  });

  it('is inclusive of both ends', () => {
    const rows = getCompletionsForRange(db, '2026-08-01', '2026-08-15');
    expect(rows.map((r) => r.localDate)).toEqual(['2026-08-01', '2026-08-15']);
  });

  it('excludes days outside the range', () => {
    const rows = getCompletionsForRange(db, '2026-08-01', '2026-08-31');
    expect(rows.map((r) => r.localDate)).not.toContain('2026-07-31');
    expect(rows.map((r) => r.localDate)).not.toContain('2026-09-01');
  });

  it('returns them in date order', () => {
    const rows = getCompletionsForRange(db, '2026-07-01', '2026-12-31');
    expect(rows.map((r) => r.localDate)).toEqual([
      '2026-07-31',
      '2026-08-01',
      '2026-08-15',
      '2026-09-01',
    ]);
  });

  it('returns nothing for an empty range', () => {
    expect(getCompletionsForRange(db, '2027-01-01', '2027-01-31')).toEqual([]);
  });
});

describe('removeReadingCompletion', () => {
  it('removes every chapter recorded on that day', () => {
    markReadingComplete(db, {
      readingPlanId: plan.id,
      localDate: '2026-08-01',
      chapters: [
        { bookId: 'GEN', chapter: 13 },
        { bookId: 'GEN', chapter: 14 },
      ],
    });
    complete('2026-08-02', 15);

    removeReadingCompletion(db, '2026-08-01');

    expect(getCompletionsForDate(db, '2026-08-01')).toEqual([]);
    // Neighbouring days are untouched.
    expect(getCompletionsForDate(db, '2026-08-02')).toHaveLength(1);
  });

  it('is safe on a day with nothing recorded', () => {
    expect(() => removeReadingCompletion(db, '2026-08-01')).not.toThrow();
    expect(countAllCompletions(db)).toBe(0);
  });

  it('lets the day be marked again afterwards', () => {
    complete('2026-08-01', 13);
    removeReadingCompletion(db, '2026-08-01');
    complete('2026-08-01', 13);

    expect(getAllCompletions(db)).toHaveLength(1);
  });
});
