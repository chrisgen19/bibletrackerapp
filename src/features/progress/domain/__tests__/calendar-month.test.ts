import {
  addMonthsToMonthKey,
  buildCalendarMonth,
  compareMonthKeys,
  monthKeyFromDateKey,
  monthKeyId,
  monthKeysEqual,
} from '../calendar-month';

describe('buildCalendarMonth', () => {
  it('produces whole weeks of seven days', () => {
    const month = buildCalendarMonth({ year: 2026, month: 8 });
    for (const week of month.weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('starts every row on a Sunday', () => {
    const month = buildCalendarMonth({ year: 2026, month: 8 });
    for (const week of month.weeks) {
      const first = week[0];
      expect(first).toBeDefined();
      expect(new Date(`${first!.date}T12:00:00`).getDay()).toBe(0);
    }
  });

  it('lists every day of the month exactly once', () => {
    const month = buildCalendarMonth({ year: 2026, month: 8 });
    expect(month.monthDates).toHaveLength(31);
    expect(month.monthDates[0]).toBe('2026-08-01');
    expect(month.monthDates[30]).toBe('2026-08-31');
    expect(new Set(month.monthDates).size).toBe(31);
  });

  it('pads leading and trailing positions from adjacent months', () => {
    // 1 August 2026 is a Saturday, so the first row holds six trailing July days.
    const month = buildCalendarMonth({ year: 2026, month: 8 });
    const firstWeek = month.weeks[0];
    expect(firstWeek).toBeDefined();
    expect(firstWeek!.filter((cell) => !cell.inCurrentMonth)).toHaveLength(6);
    expect(firstWeek![0]?.date).toBe('2026-07-26');
    expect(firstWeek![6]?.date).toBe('2026-08-01');
  });

  it('renders a 4-row month when February starts on a Sunday in a non-leap year', () => {
    // February 2026 starts on a Sunday and has 28 days.
    const month = buildCalendarMonth({ year: 2026, month: 2 });
    expect(month.weeks).toHaveLength(4);
    expect(month.monthDates).toHaveLength(28);
    expect(month.weeks.flat().every((cell) => cell.inCurrentMonth)).toBe(true);
  });

  it('includes 29 February in a leap year', () => {
    const month = buildCalendarMonth({ year: 2028, month: 2 });
    expect(month.monthDates).toHaveLength(29);
    expect(month.monthDates.at(-1)).toBe('2028-02-29');
  });

  it('renders a 6-row month when needed', () => {
    // May 2027 starts on a Saturday and has 31 days, requiring six rows.
    const month = buildCalendarMonth({ year: 2027, month: 5 });
    expect(month.weeks).toHaveLength(6);
  });

  it('supports 5-row months', () => {
    const month = buildCalendarMonth({ year: 2026, month: 9 });
    expect(month.weeks).toHaveLength(5);
  });

  it('titles the month for display', () => {
    expect(buildCalendarMonth({ year: 2026, month: 8 }).title).toBe('August 2026');
  });

  it('handles December → January boundaries', () => {
    const december = buildCalendarMonth({ year: 2026, month: 12 });
    expect(december.monthDates.at(-1)).toBe('2026-12-31');
    const lastCell = december.weeks.at(-1)?.at(-1);
    expect(lastCell?.inCurrentMonth).toBe(false);
    expect(lastCell?.date.startsWith('2027-01')).toBe(true);
  });
});

describe('month key arithmetic', () => {
  it('rolls over year boundaries in both directions', () => {
    expect(addMonthsToMonthKey({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonthsToMonthKey({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('derives a month key from a date key', () => {
    expect(monthKeyFromDateKey('2026-08-24')).toEqual({ year: 2026, month: 8 });
  });

  it('formats a stable identity', () => {
    expect(monthKeyId({ year: 2026, month: 8 })).toBe('2026-08');
    expect(monthKeyId({ year: 2026, month: 12 })).toBe('2026-12');
  });

  it('compares and equates month keys', () => {
    expect(monthKeysEqual({ year: 2026, month: 8 }, { year: 2026, month: 8 })).toBe(true);
    expect(compareMonthKeys({ year: 2026, month: 8 }, { year: 2026, month: 9 })).toBeLessThan(0);
    expect(compareMonthKeys({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
  });
});
