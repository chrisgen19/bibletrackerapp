import type { ReadingDatabase } from '@/db/client';
import {
  getAllCompletions,
  markReadingComplete,
} from '@/features/progress/data/completion-repository';
import { isCurrentReadThroughFinished } from '@/features/reading-plan/domain/read-through';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { createTestDatabase } from '@/test-utils/test-database';

import {
  createReadingPlan,
  getActiveReadingPlan,
  getAllReadingPlans,
  getGoverningPlan,
  replaceActiveReadingPlan,
  resetAllProgress,
  startNextReadThrough,
} from '../reading-plan-repository';

function draft(overrides: Partial<ReadingPlanDraft> = {}): ReadingPlanDraft {
  return {
    canonId: 'protestant',
    startDate: '2026-07-20',
    startBookId: 'GEN',
    startChapter: 1,
    chaptersPerDay: 1,
    ...overrides,
  };
}

let db: ReadingDatabase;

beforeEach(() => {
  db = createTestDatabase();
});

describe('createReadingPlan', () => {
  it('stores the draft as the active, open-ended segment', () => {
    const plan = createReadingPlan(db, draft());

    expect(plan.isActive).toBe(true);
    expect(plan.endDate).toBeNull();
    expect(getActiveReadingPlan(db)).toMatchObject({
      id: plan.id,
      startDate: '2026-07-20',
      startBookId: 'GEN',
      startChapter: 1,
    });
  });

  it('returns null when no plan exists', () => {
    expect(getActiveReadingPlan(db)).toBeNull();
  });
});

describe('replaceActiveReadingPlan', () => {
  it('closes the outgoing segment the day before the new one starts', () => {
    const first = createReadingPlan(db, draft({ startDate: '2026-07-20' }));
    const second = replaceActiveReadingPlan(db, draft({ startDate: '2026-08-09', startBookId: 'MAT' }));

    const plans = getAllReadingPlans(db);
    expect(plans).toHaveLength(2);

    const closed = plans.find((p) => p.id === first.id);
    expect(closed?.isActive).toBe(false);
    // The old segment governs right up to, but not including, the new start.
    expect(closed?.endDate).toBe('2026-08-08');

    expect(second.isActive).toBe(true);
    expect(second.endDate).toBeNull();
    expect(getActiveReadingPlan(db)?.id).toBe(second.id);
  });

  it('leaves exactly one active segment', () => {
    createReadingPlan(db, draft());
    replaceActiveReadingPlan(db, draft({ startDate: '2026-08-01' }));
    replaceActiveReadingPlan(db, draft({ startDate: '2026-08-09' }));

    expect(getAllReadingPlans(db).filter((p) => p.isActive)).toHaveLength(1);
  });

  it('never modifies completions', () => {
    const first = createReadingPlan(db, draft({ startDate: '2026-07-20' }));
    markReadingComplete(db, {
      readingPlanId: first.id,
      localDate: '2026-07-21',
      chapters: [{ bookId: 'GEN', chapter: 2 }],
      completedAt: 111,
    });

    const before = getAllCompletions(db);
    replaceActiveReadingPlan(db, draft({ startDate: '2026-08-09', startBookId: 'MAT' }));

    // This is the guarantee the whole plan-segment design exists to provide.
    expect(getAllCompletions(db)).toEqual(before);
  });

  it('supersedes a same-day segment without matching any date', () => {
    const first = createReadingPlan(db, draft({ startDate: '2026-08-09' }));
    replaceActiveReadingPlan(db, draft({ startDate: '2026-08-09', startBookId: 'MAT' }));

    const closed = getAllReadingPlans(db).find((p) => p.id === first.id);
    // endDate before startDate: the segment governs no day at all, by design.
    expect(closed?.endDate).toBe('2026-08-08');
    expect(closed?.startDate).toBe('2026-08-09');
  });

  it('carries chapters per day onto the new segment', () => {
    createReadingPlan(db, draft());
    const next = replaceActiveReadingPlan(db, draft({ startDate: '2026-08-09', chaptersPerDay: 3 }));
    expect(next.chaptersPerDay).toBe(3);
  });
});

describe('resetAllProgress', () => {
  it('removes plans and completions together', () => {
    const plan = createReadingPlan(db, draft());
    markReadingComplete(db, {
      readingPlanId: plan.id,
      localDate: '2026-07-21',
      chapters: [{ bookId: 'GEN', chapter: 2 }],
    });

    resetAllProgress(db);

    expect(getAllReadingPlans(db)).toHaveLength(0);
    expect(getAllCompletions(db)).toHaveLength(0);
    expect(getActiveReadingPlan(db)).toBeNull();
  });
});

describe('getGoverningPlan', () => {
  it('is the segment governing the day, or the active one before any began', () => {
    const first = createReadingPlan(db, draft({ startDate: '2026-07-20' }));
    const second = replaceActiveReadingPlan(db, draft({ startDate: '2026-08-09' }));

    expect(getGoverningPlan(db, '2026-08-01')?.id).toBe(first.id);
    expect(getGoverningPlan(db, '2026-08-10')?.id).toBe(second.id);
    expect(getGoverningPlan(db, '2026-07-01')?.id).toBe(second.id);
  });
});

// #19: read-throughs.
describe('read-throughs', () => {
  /** Asked of the stored readings, as the provider asks it. */
  const finished = (stored: ReadingDatabase) =>
    isCurrentReadThroughFinished(getAllReadingPlans(stored), getActiveReadingPlan(stored), getAllCompletions(stored));

  /** The shortest finished read-through: a plan begun at Revelation 22, read on its first day. */
  function finishOneReadThrough() {
    const plan = createReadingPlan(db, draft({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 22 }));
    markReadingComplete(db, {
      readingPlanId: plan.id,
      localDate: '2026-08-01',
      chapters: [{ bookId: 'REV', chapter: 22 }],
    });
    return plan;
  }

  const restart = draft({ startDate: '2026-08-05' });

  it('starts a new reader on read-through 1', () => {
    expect(createReadingPlan(db, draft()).readThrough).toBe(1);
    expect(getActiveReadingPlan(db)?.readThrough).toBe(1);
  });

  it('starts the next one at the draft, closing the current segment the day before', () => {
    const first = finishOneReadThrough();
    const next = startNextReadThrough(db, restart, finished);

    expect(next).toMatchObject({ readThrough: 2, startDate: '2026-08-05', startBookId: 'GEN', isActive: true });
    expect(getAllReadingPlans(db).find((plan) => plan.id === first.id)).toMatchObject({
      isActive: false,
      endDate: '2026-08-04',
    });
    // Nothing is deleted.
    expect(getAllCompletions(db)).toHaveLength(1);
  });

  it('keeps the read-through on a position change', () => {
    finishOneReadThrough();
    startNextReadThrough(db, restart, finished);

    const moved = replaceActiveReadingPlan(db, draft({ startDate: '2026-08-07', startBookId: 'EXO' }));
    expect(moved.readThrough).toBe(2);
  });

  it('refuses, writing nothing, until the read-through is finished', () => {
    createReadingPlan(db, draft());

    expect(startNextReadThrough(db, restart, finished)).toBeNull();
    expect(getAllReadingPlans(db)).toHaveLength(1);
  });

  it('starts one read-through when asked twice', () => {
    finishOneReadThrough();
    startNextReadThrough(db, restart, finished);

    // The second ask sees read-through 2 just begun, so it is not finished.
    expect(startNextReadThrough(db, restart, finished)).toBeNull();
    expect(getAllReadingPlans(db).map((plan) => plan.readThrough)).toEqual([1, 2]);
  });

  it('refuses without a plan', () => {
    expect(startNextReadThrough(db, restart, () => true)).toBeNull();
    expect(getAllReadingPlans(db)).toHaveLength(0);
  });

  it('carries on the latest read-through when a plan is created, and is back to 1 after a reset', () => {
    finishOneReadThrough();
    startNextReadThrough(db, restart, finished);
    expect(createReadingPlan(db, draft({ startDate: '2026-08-06' })).readThrough).toBe(2);

    resetAllProgress(db);
    expect(createReadingPlan(db, draft()).readThrough).toBe(1);
  });
});
