import { useMemo } from 'react';

import { getCanonIndex } from '@/data/bible/canon-index';
import { getBacklog, type BacklogEntry } from '@/features/reading-plan/domain/backlog';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';

/**
 * Chapters still owed, oldest first in canon order.
 *
 * Covers both ways a reading is lost: verses left unread in a chapter that was
 * started, and chapters the plan scheduled on a day nobody opened the app.
 */
export function useBacklog(): readonly BacklogEntry[] {
  const { plans, completions, today, activePlan } = useReadingData();

  return useMemo(
    () => getBacklog(plans, completions, today, getCanonIndex(activePlan?.canonId ?? 'protestant')),
    [plans, completions, today, activePlan],
  );
}
