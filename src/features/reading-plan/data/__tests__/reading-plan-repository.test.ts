import type { ReadingDatabase } from '@/db/client';
import {
  getAllCompletions,
  markReadingComplete,
} from '@/features/progress/data/completion-repository';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { createTestDatabase } from '@/test-utils/test-database';

import {
  createReadingPlan,
  getActiveReadingPlan,
  getAllReadingPlans,
  replaceActiveReadingPlan,
  resetAllProgress,
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
