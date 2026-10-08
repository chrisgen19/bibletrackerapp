import { makeCompletion, makeCompletions, makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import { createCompletionLookup, createScheduleContext } from '@/features/reading-plan/domain/schedule';
import { eachDateKeyInRange } from '@/utils/date-key';

import { buildCalendarMonth } from '../calendar-month';
import { calculateMonthStatistics, describeMonthProgress } from '../month-statistics';

const plan = makePlan({ startDate: '2026-08-01' });

function statsFor(options: {
  monthDates: readonly string[];
  completed: readonly string[];
  today: string;
  plans?: readonly ReturnType<typeof makePlan>[];
}) {
  const plans = options.plans ?? [plan];
  const rows = makeCompletions(options.completed);
  return calculateMonthStatistics({
    plans,
    completions: createCompletionLookup(rows),
    context: createScheduleContext(plans, rows, options.today),
    monthDates: options.monthDates,
    today: options.today,
  });
}

const AUGUST_2026 = buildCalendarMonth({ year: 2026, month: 8 }).monthDates;
const JULY_2026 = buildCalendarMonth({ year: 2026, month: 7 }).monthDates;
const SEPTEMBER_2026 = buildCalendarMonth({ year: 2026, month: 9 }).monthDates;

describe('calculateMonthStatistics', () => {
  it('reports no plan when none exists', () => {
    const stats = calculateMonthStatistics({
      plans: [],
      completions: createCompletionLookup([]),
      context: createScheduleContext([], [], '2026-08-24'),
      monthDates: AUGUST_2026,
      today: '2026-08-24',
    });
    expect(stats.kind).toBe('no-plan');
    expect(stats.percent).toBe(0);
  });

  it('shows an empty state for months before the plan began instead of 0%', () => {
    const stats = statsFor({ monthDates: JULY_2026, completed: [], today: '2026-08-24' });
    expect(stats.kind).toBe('before-plan');
    expect(stats.expectedDays).toBe(0);
  });

  it('treats a future month as scheduled rather than missed', () => {
    const stats = statsFor({ monthDates: SEPTEMBER_2026, completed: [], today: '2026-08-24' });
    expect(stats.kind).toBe('future');
    expect(stats.scheduledDays).toBe(30);
    expect(stats.expectedDays).toBe(0);
    expect(describeMonthProgress(stats)).toBe('30 days scheduled');
  });

  it('does not count future days of the current month as missed', () => {
    const completed = eachDateKeyInRange('2026-08-01', '2026-08-23');
    const stats = statsFor({ monthDates: AUGUST_2026, completed, today: '2026-08-24' });
    // 24 days have elapsed; 23 of them were read.
    expect(stats.expectedDays).toBe(24);
    expect(stats.completedDays).toBe(23);
    expect(stats.scheduledDays).toBe(31);
    expect(stats.percent).toBe(96);
    expect(describeMonthProgress(stats)).toBe('23 of 24 days');
  });

  it('ignores completions dated after today, so percent stays within 0-100', () => {
    // Regression for #16. The UI cannot log a future day, but a clock or timezone
    // change can leave rows dated after today; they used to give "3 of 1 days", 300%.
    const stats = statsFor({
      monthDates: AUGUST_2026,
      completed: ['2026-08-01', '2026-08-02', '2026-08-03'],
      today: '2026-08-01',
    });
    expect(stats.expectedDays).toBe(1);
    expect(stats.completedDays).toBe(1);
    expect(stats.percent).toBe(100);
    expect(describeMonthProgress(stats)).toBe('1 of 1 day');
  });

  it('counts every day for a fully elapsed month', () => {
    const completed = eachDateKeyInRange('2026-08-01', '2026-08-20');
    const stats = statsFor({ monthDates: AUGUST_2026, completed, today: '2026-09-15' });
    expect(stats.kind).toBe('past');
    expect(stats.expectedDays).toBe(31);
    expect(stats.completedDays).toBe(20);
    expect(stats.percent).toBe(65);
  });

  it('reports 100% for a fully completed month', () => {
    const completed = eachDateKeyInRange('2026-08-01', '2026-08-31');
    const stats = statsFor({ monthDates: AUGUST_2026, completed, today: '2026-09-01' });
    expect(stats.percent).toBe(100);
    expect(stats.completedDays).toBe(31);
  });

  it('handles a plan starting mid-month', () => {
    const midMonthPlan = makePlan({ startDate: '2026-08-15' });
    const stats = statsFor({
      plans: [midMonthPlan],
      monthDates: AUGUST_2026,
      completed: eachDateKeyInRange('2026-08-15', '2026-08-20'),
      today: '2026-08-24',
    });
    // Only the 15th–24th are both scheduled and elapsed.
    expect(stats.expectedDays).toBe(10);
    expect(stats.completedDays).toBe(6);
    expect(stats.scheduledDays).toBe(17);
  });

  it('stops scheduling days after the canon is finished', () => {
    // The position follows the reader, so days are expected until the reading is
    // actually done — not until the date arithmetic runs out of chapters.
    const endingPlan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 20 });
    const rows = [
      makeCompletion('2026-08-01', { bookId: 'REV', chapter: 20 }),
      makeCompletion('2026-08-02', { bookId: 'REV', chapter: 21 }),
      makeCompletion('2026-08-03', { bookId: 'REV', chapter: 22 }),
    ];
    const stats = calculateMonthStatistics({
      plans: [endingPlan],
      completions: createCompletionLookup(rows),
      context: createScheduleContext([endingPlan], rows, '2026-08-24'),
      monthDates: AUGUST_2026,
      today: '2026-08-24',
    });
    expect(stats.scheduledDays).toBe(3);
    expect(stats.expectedDays).toBe(3);
    expect(stats.completedDays).toBe(3);
  });

  it('keeps expecting readings while anything is still owed', () => {
    // Three chapters left but nothing read: every elapsed day still counted.
    const endingPlan = makePlan({ startDate: '2026-08-01', startBookId: 'REV', startChapter: 20 });
    const stats = statsFor({
      plans: [endingPlan],
      monthDates: AUGUST_2026,
      completed: [],
      today: '2026-08-24',
    });
    expect(stats.expectedDays).toBe(24);
  });

  it('handles an empty month list defensively', () => {
    const stats = statsFor({ monthDates: [], completed: [], today: '2026-08-24' });
    expect(stats.kind).toBe('no-plan');
  });
});

describe('describeMonthProgress', () => {
  it('uses singular copy for a single day', () => {
    const stats = statsFor({
      plans: [makePlan({ startDate: '2026-08-24' })],
      monthDates: AUGUST_2026,
      completed: ['2026-08-24'],
      today: '2026-08-24',
    });
    expect(describeMonthProgress(stats)).toBe('1 of 1 day');
  });
});
