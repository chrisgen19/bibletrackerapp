import { useMemo } from 'react';

import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';

import { calculateStreaks, type StreakSummary } from '../domain/streak';

export function useStreaks(): StreakSummary {
  const { plans, completionLookup, scheduleContext, today } = useReadingData();

  return useMemo(
    () => calculateStreaks({ plans, completions: completionLookup, context: scheduleContext, today }),
    [plans, completionLookup, scheduleContext, today],
  );
}
