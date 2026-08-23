import { useMemo } from 'react';

import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import type { DateKey } from '@/utils/date-key';

import { buildCalendarMonth, type CalendarMonth, type MonthKey } from '../domain/calendar-month';
import { calculateMonthStatistics, type MonthStatistics } from '../domain/month-statistics';

export interface MonthProgress {
  calendar: CalendarMonth;
  statistics: MonthStatistics;
  /** Keyed by date so a calendar cell is a map lookup, not a recomputation. */
  readings: ReadonlyMap<DateKey, DayReading>;
}

/**
 * Derives one month's calendar grid, per-day readings and summary statistics.
 *
 * Adjacent-month padding cells are included so the grid can render them dimmed
 * without a second pass.
 */
export function useMonthProgress(monthKey: MonthKey): MonthProgress {
  const { plans, completionLookup, scheduleContext, today } = useReadingData();

  return useMemo(() => {
    const calendar = buildCalendarMonth(monthKey);

    const readings = new Map<DateKey, DayReading>();
    for (const week of calendar.weeks) {
      for (const cell of week) {
        readings.set(cell.date, getDayReading(plans, cell.date, scheduleContext));
      }
    }

    const statistics = calculateMonthStatistics({
      plans,
      completions: completionLookup,
      context: scheduleContext,
      monthDates: calendar.monthDates,
      today,
    });

    return { calendar, statistics, readings };
  }, [monthKey, plans, completionLookup, scheduleContext, today]);
}
