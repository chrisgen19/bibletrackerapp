import { useMemo } from 'react';

import { getDayReading } from '@/features/reading-plan/domain/schedule';
import type { DayReading } from '@/features/reading-plan/domain/types';

import { useReadingData } from './reading-data-provider';

/** Everything the Today card needs, recomputed whenever plans or completions change. */
export function useTodayReading(): DayReading {
  const { plans, scheduleContext, today } = useReadingData();

  return useMemo(
    () => getDayReading(plans, today, scheduleContext),
    [plans, scheduleContext, today],
  );
}
