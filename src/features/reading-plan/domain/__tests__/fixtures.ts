import type { DateKey } from '@/utils/date-key';

import type { ReadingCompletion, ReadingPlan } from '../types';

export function makePlan(overrides: Partial<ReadingPlan> = {}): ReadingPlan {
  return {
    id: 'plan-1',
    canonId: 'protestant',
    startDate: '2026-08-01',
    startBookId: 'GEN',
    startChapter: 1,
    chaptersPerDay: 1,
    createdAt: 0,
    isActive: true,
    endDate: null,
    ...overrides,
  };
}

export function makeCompletion(
  localDate: DateKey,
  overrides: Partial<ReadingCompletion> = {},
): ReadingCompletion {
  return {
    id: `completion-${localDate}`,
    readingPlanId: 'plan-1',
    localDate,
    bookId: 'GEN',
    chapter: 1,
    verses: null,
    completedAt: 0,
    ...overrides,
  };
}

export function makeCompletions(dates: readonly DateKey[]): ReadingCompletion[] {
  return dates.map((date) => makeCompletion(date));
}
