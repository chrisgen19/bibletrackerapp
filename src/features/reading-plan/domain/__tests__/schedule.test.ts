import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';

import {
  calculateReadingForDate,
  calculateReadingStatus,
  createCompletionLookup,
  getDayReading,
  getPlanCompletionDate,
  isScheduledDay,
  resolvePlanForDate,
} from '../schedule';
import { makeCompletions, makePlan } from './fixtures';

const NO_COMPLETIONS = createCompletionLookup([]);

describe('calculateReadingForDate', () => {
  const plan = makePlan({ startDate: '2026-08-01', startBookId: 'GEN', startChapter: 1 });

  it('schedules the starting chapter on the start date', () => {
    expect(calculateReadingForDate(plan, '2026-08-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 1 }],
    });
  });

  it('advances one chapter per day', () => {
    expect(calculateReadingForDate(plan, '2026-08-24')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 24 }],
    });
  });

  it('crosses book boundaries on the correct day', () => {
    // Day 50 of the plan is Genesis 50; day 51 is Exodus 1.
    expect(calculateReadingForDate(plan, '2026-09-19')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 50 }],
    });
    expect(calculateReadingForDate(plan, '2026-09-20')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'EXO', chapter: 1 }],
    });
  });

  it('reports dates before the plan started', () => {
    expect(calculateReadingForDate(plan, '2026-07-31')).toEqual({ kind: 'before-plan' });
  });

  it('reports canon completion after the final chapter', () => {
    const total = PROTESTANT_CANON_INDEX.totalChapters;
    const lastDay = getPlanCompletionDate(plan);
    expect(lastDay).toBe('2029-11-01');
    expect(calculateReadingForDate(plan, lastDay!)).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'REV', chapter: 22 }],
    });
    expect(calculateReadingForDate(plan, '2029-11-02')).toEqual({ kind: 'canon-complete' });
    expect(total).toBe(1189);
  });

  it('handles a plan that starts mid-canon', () => {
    const continuing = makePlan({ startDate: '2026-08-01', startBookId: 'MAL', startChapter: 4 });
    expect(calculateReadingForDate(continuing, '2026-08-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'MAL', chapter: 4 }],
    });
    expect(calculateReadingForDate(continuing, '2026-08-02')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'MAT', chapter: 1 }],
    });
  });

  it('crosses a leap day without drifting', () => {
    const leapPlan = makePlan({ startDate: '2028-02-28', startBookId: 'GEN', startChapter: 1 });
    expect(calculateReadingForDate(leapPlan, '2028-02-29')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 2 }],
    });
    expect(calculateReadingForDate(leapPlan, '2028-03-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 3 }],
    });
  });

  it('does not skip a day across a non-leap February', () => {
    const plan2027 = makePlan({ startDate: '2027-02-28', startBookId: 'GEN', startChapter: 1 });
    expect(calculateReadingForDate(plan2027, '2027-03-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 2 }],
    });
  });

  it('crosses a year boundary correctly', () => {
    const yearEnd = makePlan({ startDate: '2026-12-31', startBookId: 'GEN', startChapter: 1 });
    expect(calculateReadingForDate(yearEnd, '2027-01-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'GEN', chapter: 2 }],
    });
  });

  it('supports multi-chapter plans without changing the engine', () => {
    const threeADay = makePlan({ chaptersPerDay: 3 });
    expect(calculateReadingForDate(threeADay, '2026-08-02')).toEqual({
      kind: 'scheduled',
      chapters: [
        { bookId: 'GEN', chapter: 4 },
        { bookId: 'GEN', chapter: 5 },
        { bookId: 'GEN', chapter: 6 },
      ],
    });
  });
});

describe('calculateReadingStatus', () => {
  const plan = makePlan({ startDate: '2026-08-01' });
  const today = '2026-08-24';

  it('marks a day with a completion as completed', () => {
    const completions = createCompletionLookup(makeCompletions(['2026-08-10']));
    expect(calculateReadingStatus(plan, '2026-08-10', completions, today)).toBe('completed');
  });

  it('marks an unread past day as missed, never as an error', () => {
    expect(calculateReadingStatus(plan, '2026-08-10', NO_COMPLETIONS, today)).toBe('missed');
  });

  it('marks an unread today as pending rather than missed', () => {
    expect(calculateReadingStatus(plan, today, NO_COMPLETIONS, today)).toBe('today-pending');
  });

  it('marks a completed today as completed', () => {
    const completions = createCompletionLookup(makeCompletions([today]));
    expect(calculateReadingStatus(plan, today, completions, today)).toBe('completed');
  });

  it('marks future days as upcoming', () => {
    expect(calculateReadingStatus(plan, '2026-08-25', NO_COMPLETIONS, today)).toBe('upcoming');
  });

  it('marks days before the plan as before-plan', () => {
    expect(calculateReadingStatus(plan, '2026-07-15', NO_COMPLETIONS, today)).toBe('before-plan');
  });

  it('marks days after the canon is finished', () => {
    expect(calculateReadingStatus(plan, '2030-01-01', NO_COMPLETIONS, '2031-01-01')).toBe('canon-complete');
  });

  it('reports no-plan when no plan governs the date', () => {
    expect(calculateReadingStatus(null, '2026-08-10', NO_COMPLETIONS, today)).toBe('no-plan');
  });
});

describe('plan segments', () => {
  const first = makePlan({
    id: 'plan-1',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    isActive: false,
    startBookId: 'GEN',
    startChapter: 1,
  });
  const second = makePlan({
    id: 'plan-2',
    startDate: '2026-07-01',
    endDate: null,
    isActive: true,
    startBookId: 'MAT',
    startChapter: 1,
  });
  const plans = [first, second];

  it('resolves the segment that governs each date', () => {
    expect(resolvePlanForDate(plans, '2026-03-01')?.id).toBe('plan-1');
    expect(resolvePlanForDate(plans, '2026-06-30')?.id).toBe('plan-1');
    expect(resolvePlanForDate(plans, '2026-07-01')?.id).toBe('plan-2');
    expect(resolvePlanForDate(plans, '2027-01-01')?.id).toBe('plan-2');
  });

  it('returns null before any plan existed', () => {
    expect(resolvePlanForDate(plans, '2025-12-31')).toBeNull();
  });

  it('keeps historical schedules intact after a plan change', () => {
    // 1 March 2026 is day 60 of the original Genesis plan.
    expect(calculateReadingForDate(first, '2026-03-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'EXO', chapter: 10 }],
    });
    // The new segment restarts from Matthew without rewriting the old one.
    expect(calculateReadingForDate(second, '2026-07-01')).toEqual({
      kind: 'scheduled',
      chapters: [{ bookId: 'MAT', chapter: 1 }],
    });
  });

  it('preserves the chapters actually recorded, even after the plan changes', () => {
    const completions = createCompletionLookup([
      {
        id: 'c1',
        readingPlanId: 'plan-1',
        localDate: '2026-03-01',
        bookId: 'EXO',
        chapter: 10,
        completedAt: 0,
      },
    ]);
    const day = getDayReading(plans, '2026-03-01', completions, '2026-08-24');
    expect(day.status).toBe('completed');
    expect(day.completedChapters).toEqual([{ bookId: 'EXO', chapter: 10 }]);
    expect(day.plan?.id).toBe('plan-1');
  });
});

describe('isScheduledDay', () => {
  const plan = makePlan({ startDate: '2026-08-01' });

  it('is false before the plan and true from the start date', () => {
    expect(isScheduledDay([plan], '2026-07-31')).toBe(false);
    expect(isScheduledDay([plan], '2026-08-01')).toBe(true);
  });

  it('is false once the canon has been finished', () => {
    expect(isScheduledDay([plan], '2029-11-02')).toBe(false);
  });
});

describe('getDayReading timeline states', () => {
  const plan = makePlan({ startDate: '2026-08-01' });

  it('reports before-plan for days that precede the first segment', () => {
    const day = getDayReading([plan], '2026-07-26', NO_COMPLETIONS, '2026-08-24');
    expect(day.status).toBe('before-plan');
    expect(day.scheduled).toEqual({ kind: 'before-plan' });
  });

  it('reports no-plan only when no plan has ever existed', () => {
    const day = getDayReading([], '2026-07-26', NO_COMPLETIONS, '2026-08-24');
    expect(day.status).toBe('no-plan');
  });

  it('keeps a completion visible even on a day no segment governs', () => {
    const completions = createCompletionLookup(makeCompletions(['2026-07-26']));
    const day = getDayReading([plan], '2026-07-26', completions, '2026-08-24');
    expect(day.status).toBe('completed');
  });
});
