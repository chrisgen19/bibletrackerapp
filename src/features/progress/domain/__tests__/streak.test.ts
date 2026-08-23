import { makeCompletions, makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import { createCompletionLookup, createScheduleContext } from '@/features/reading-plan/domain/schedule';

import { calculateStreaks, describeStreak } from '../streak';

const plan = makePlan({ startDate: '2026-08-01' });

function streaks(completedDates: readonly string[], today: string) {
  const rows = makeCompletions(completedDates);
  return calculateStreaks({
    plans: [plan],
    completions: createCompletionLookup(rows),
    context: createScheduleContext([plan], rows, today),
    today,
  });
}

describe('calculateStreaks', () => {
  it('returns zero when there is no plan', () => {
    expect(calculateStreaks({
      plans: [],
      completions: createCompletionLookup([]),
      context: createScheduleContext([], [], '2026-08-24'),
      today: '2026-08-24',
    })).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it('returns zero when nothing has been completed', () => {
    expect(streaks([], '2026-08-10')).toEqual({ current: 0, longest: 0 });
  });

  it('counts consecutive completed days', () => {
    expect(streaks(['2026-08-08', '2026-08-09', '2026-08-10'], '2026-08-10')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('does not let a pending today break the streak', () => {
    // Read through the 9th, today is the 10th and still unread.
    expect(streaks(['2026-08-08', '2026-08-09'], '2026-08-10')).toEqual({ current: 2, longest: 2 });
  });

  it('breaks the streak once the missed day has passed', () => {
    // The 10th was never read and today is the 11th.
    expect(streaks(['2026-08-08', '2026-08-09'], '2026-08-11')).toEqual({ current: 0, longest: 2 });
  });

  it('extends the streak when today is completed', () => {
    expect(streaks(['2026-08-08', '2026-08-09', '2026-08-10'], '2026-08-10')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('remembers the longest run after the current one resets', () => {
    const completed = [
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      // 5th missed
      '2026-08-06',
      '2026-08-07',
    ];
    expect(streaks(completed, '2026-08-07')).toEqual({ current: 2, longest: 4 });
  });

  it('ignores completions recorded for future days', () => {
    expect(streaks(['2026-08-01', '2026-09-01'], '2026-08-01')).toEqual({ current: 1, longest: 1 });
  });

  it('ignores days before the plan started', () => {
    expect(streaks(['2026-07-30', '2026-07-31', '2026-08-01'], '2026-08-01')).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it('returns zero before the plan has begun', () => {
    expect(streaks([], '2026-07-01')).toEqual({ current: 0, longest: 0 });
  });

  it('counts a streak that spans a month boundary', () => {
    expect(streaks(['2026-08-30', '2026-08-31', '2026-09-01'], '2026-09-01')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('counts a streak that spans a leap day', () => {
    const leapPlan = makePlan({ startDate: '2028-02-27' });
    const rows = makeCompletions(['2028-02-28', '2028-02-29', '2028-03-01']);
    const result = calculateStreaks({
      plans: [leapPlan],
      completions: createCompletionLookup(rows),
      context: createScheduleContext([leapPlan], rows, '2028-03-01'),
      today: '2028-03-01',
    });
    expect(result).toEqual({ current: 3, longest: 3 });
  });

  it('carries a streak across a plan change', () => {
    const firstSegment = makePlan({
      id: 'plan-1',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      isActive: false,
    });
    const secondSegment = makePlan({
      id: 'plan-2',
      startDate: '2026-08-04',
      startBookId: 'MAT',
      startChapter: 1,
      endDate: null,
    });
    const rows = makeCompletions(['2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']);
    const result = calculateStreaks({
      plans: [firstSegment, secondSegment],
      completions: createCompletionLookup(rows),
      context: createScheduleContext([firstSegment, secondSegment], rows, '2026-08-05'),
      today: '2026-08-05',
    });
    expect(result).toEqual({ current: 4, longest: 4 });
  });
});

describe('describeStreak', () => {
  it('reads naturally at each boundary', () => {
    expect(describeStreak(0)).toBe('Start your streak today');
    expect(describeStreak(1)).toBe('1 day streak');
    expect(describeStreak(12)).toBe('12 day streak');
  });
});
