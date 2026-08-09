import { useMemo } from 'react';

import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';

import { calculateStreaks, type StreakSummary } from '../domain/streak';

export function useStreaks(): StreakSummary {
  const { plans, completionLookup, today } = useReadingData();

  return useMemo(
    () => calculateStreaks({ plans, completions: completionLookup, today }),
    [plans, completionLookup, today],
  );
}
