import { makeCompletions, makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import { createCompletionLookup, getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { fireEvent, renderWithTheme } from '@/test-utils/render';
import type { DateKey } from '@/utils/date-key';

import { buildCalendarMonth } from '../../domain/calendar-month';
import { CalendarGrid } from '../calendar-grid';

const TODAY: DateKey = '2026-08-24';
const plan = makePlan({ startDate: '2026-08-01' });
const month = buildCalendarMonth({ year: 2026, month: 8 });

function buildReadings(completedDates: readonly DateKey[]): Map<DateKey, DayReading> {
  const completions = createCompletionLookup(makeCompletions(completedDates));
  const readings = new Map<DateKey, DayReading>();
  for (const week of month.weeks) {
    for (const cell of week) {
      readings.set(cell.date, getDayReading([plan], cell.date, completions, TODAY));
    }
  }
  return readings;
}

function renderGrid(completedDates: readonly DateKey[] = [], onSelectDay = jest.fn()) {
  return renderWithTheme(
    <CalendarGrid
      month={month}
      readings={buildReadings(completedDates)}
      today={TODAY}
      onSelectDay={onSelectDay}
    />,
  );
}

describe('CalendarGrid', () => {
  it('renders every day of the month plus adjacent-month padding', async () => {
    const { getAllByRole } = await renderGrid();

    // August 2026 starts on a Saturday, so the grid needs six rows of seven cells.
    expect(getAllByRole('button')).toHaveLength(42);
  });

  it('describes each day for screen readers', async () => {
    const { getByLabelText } = await renderGrid(['2026-08-10']);

    expect(getByLabelText('Monday 10 August, Genesis 10, completed')).toBeTruthy();
    expect(getByLabelText('Tuesday 11 August, Genesis 11, not read')).toBeTruthy();
  });

  it('announces today as pending rather than missed', async () => {
    const { getByLabelText } = await renderGrid();

    expect(getByLabelText('Today, Monday 24 August, Genesis 24, not read yet')).toBeTruthy();
  });

  it('shows future days as scheduled, not missed', async () => {
    const { getByLabelText } = await renderGrid();

    expect(getByLabelText('Tuesday 25 August, Genesis 25, scheduled')).toBeTruthy();
  });

  it('marks days before the plan began without penalising them', async () => {
    const { getByLabelText } = await renderGrid();

    // 26 July is a trailing cell from the previous month, before the plan started.
    expect(getByLabelText('Sunday 26 July, before your plan began')).toBeTruthy();
  });

  it('opens the day detail when a cell is tapped', async () => {
    const onSelectDay = jest.fn();
    const { getByLabelText } = await renderGrid([], onSelectDay);

    await fireEvent.press(getByLabelText('Today, Monday 24 August, Genesis 24, not read yet'));
    expect(onSelectDay).toHaveBeenCalledWith(TODAY);
  });
});
