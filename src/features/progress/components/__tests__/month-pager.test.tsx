import { makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import { createCompletionLookup, getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { fireEvent, renderWithTheme } from '@/test-utils/render';
import type { DateKey } from '@/utils/date-key';

import { addMonthsToMonthKey, buildCalendarMonth, type MonthKey } from '../../domain/calendar-month';
import { calculateMonthStatistics } from '../../domain/month-statistics';
import type { MonthProgress } from '../../hooks/use-month-progress';
import type { MonthWindow } from '../../hooks/use-month-window';
import { MonthPager } from '../month-pager';

const TODAY: DateKey = '2026-08-09';
const PLAN = makePlan({ startDate: '2026-07-20' });
const WIDTH = 390;

function buildProgress(key: MonthKey): MonthProgress {
  const calendar = buildCalendarMonth(key);
  const completions = createCompletionLookup([]);
  const readings = new Map<DateKey, DayReading>();
  for (const week of calendar.weeks) {
    for (const cell of week) {
      readings.set(cell.date, getDayReading([PLAN], cell.date, completions, TODAY));
    }
  }
  return {
    calendar,
    readings,
    statistics: calculateMonthStatistics({
      plans: [PLAN],
      completions,
      monthDates: calendar.monthDates,
      today: TODAY,
    }),
  };
}

function buildWindow(key: MonthKey): MonthWindow {
  return {
    previous: buildProgress(addMonthsToMonthKey(key, -1)),
    current: buildProgress(key),
    next: buildProgress(addMonthsToMonthKey(key, 1)),
  };
}

async function renderPager(key: MonthKey = { year: 2026, month: 8 }) {
  const onStepMonth = jest.fn();
  const onSelectDay = jest.fn();
  const queries = await renderWithTheme(
    <MonthPager
      window={buildWindow(key)}
      today={TODAY}
      onSelectDay={onSelectDay}
      onStepMonth={onStepMonth}
    />,
  );
  return { onStepMonth, onSelectDay, ...queries };
}

/**
 * The pager only mounts its ScrollView once it has measured a width, so layout is
 * fired on the outer container rather than on the scroller itself.
 */
async function layout(queries: Awaited<ReturnType<typeof renderPager>>, width = WIDTH) {
  await fireEvent(queries.getByTestId('month-pager'), 'layout', {
    nativeEvent: { layout: { width, height: 300, x: 0, y: 0 } },
  });
}

async function settleAt(queries: Awaited<ReturnType<typeof renderPager>>, x: number) {
  await fireEvent(queries.getByLabelText('Monthly reading calendar'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: WIDTH * 3, height: 300 } },
  });
}

describe('MonthPager', () => {
  it('mounts the scroller only once a width has been measured', async () => {
    const queries = await renderPager();
    // Rendering pages at zero width would collapse them, and dividing a scroll
    // offset by that width would yield Infinity. Not mounting is what prevents it —
    // the width guard inside the settle handler is unreachable in practice.
    expect(queries.queryByLabelText('Monthly reading calendar')).toBeNull();

    await layout(queries);
    expect(queries.getByLabelText('Monthly reading calendar')).toBeTruthy();
  });

  it('advances a month when the swipe settles on the right-hand page', async () => {
    const queries = await renderPager();
    await layout(queries);

    await settleAt(queries, WIDTH * 2);

    expect(queries.onStepMonth).toHaveBeenCalledWith(1);
  });

  it('goes back a month when the swipe settles on the left-hand page', async () => {
    const queries = await renderPager();
    await layout(queries);

    await settleAt(queries, 0);

    expect(queries.onStepMonth).toHaveBeenCalledWith(-1);
  });

  it('does nothing when the swipe settles back on the centre page', async () => {
    const queries = await renderPager();
    await layout(queries);

    await settleAt(queries, WIDTH);

    expect(queries.onStepMonth).not.toHaveBeenCalled();
  });

  it('rounds a partial swipe to the nearest page', async () => {
    const queries = await renderPager();
    await layout(queries);

    // Drifted most of the way to the next page.
    await settleAt(queries, WIDTH * 1.7);
    expect(queries.onStepMonth).toHaveBeenCalledWith(1);
  });

  it('ignores a partial swipe that falls back toward the centre', async () => {
    const queries = await renderPager();
    await layout(queries);

    await settleAt(queries, WIDTH * 1.3);
    expect(queries.onStepMonth).not.toHaveBeenCalled();
  });

  it('steps only once per settle', async () => {
    const queries = await renderPager();
    await layout(queries);

    await settleAt(queries, WIDTH * 2);

    expect(queries.onStepMonth).toHaveBeenCalledTimes(1);
  });
});
