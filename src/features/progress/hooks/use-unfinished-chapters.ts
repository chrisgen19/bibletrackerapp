import { useMemo } from 'react';

import { getCanonIndex } from '@/data/bible/canon-index';
import type { ChapterProgress } from '@/features/reading-plan/domain/chapter-progress';
import { getUnfinishedChapters } from '@/features/reading-plan/domain/chapter-progress';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';

/**
 * Chapters started but not finished, oldest first in canon order.
 *
 * Surfacing these is what keeps a part-read chapter from being lost: the day it was
 * started counts as read and the calendar fills, so without this list the remaining
 * verses are reachable only by remembering the date.
 */
export function useUnfinishedChapters(): readonly ChapterProgress[] {
  const { completions, activePlan } = useReadingData();

  return useMemo(
    () => getUnfinishedChapters(completions, getCanonIndex(activePlan?.canonId ?? 'protestant')),
    [completions, activePlan],
  );
}
