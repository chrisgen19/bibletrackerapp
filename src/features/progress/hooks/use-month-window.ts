import { useMemo } from 'react';

import { useMonthProgress, type MonthProgress } from './use-month-progress';
import { addMonthsToMonthKey, type MonthKey } from '../domain/calendar-month';

export interface MonthWindow {
  previous: MonthProgress;
  current: MonthProgress;
  next: MonthProgress;
}

/**
 * The three months the pager keeps mounted.
 *
 * Neighbours are computed up front so a swipe reveals a fully rendered month
 * instead of a blank page, while navigation stays unbounded in both directions.
 */
export function useMonthWindow(monthKey: MonthKey): MonthWindow {
  const previousKey = useMemo(() => addMonthsToMonthKey(monthKey, -1), [monthKey]);
  const nextKey = useMemo(() => addMonthsToMonthKey(monthKey, 1), [monthKey]);

  const previous = useMonthProgress(previousKey);
  const current = useMonthProgress(monthKey);
  const next = useMonthProgress(nextKey);

  return { previous, current, next };
}
