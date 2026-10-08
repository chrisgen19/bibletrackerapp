import { useMemo } from 'react';

import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';

import { useReadingData } from './reading-data-provider';

/**
 * Everything the Today card needs, recomputed whenever plans or completions change.
 *
 * Read from the plan's view: an extra reading logged today does not stand in for the
 * plan's chapter, which stays on offer until it is read.
 */
export function useTodayReading(): DayReading {
  const { plans, planScheduleContext, today } = useReadingData();

  return useMemo(
    () => getDayReading(plans, today, planScheduleContext),
    [plans, planScheduleContext, today],
  );
}
