// A reader who read the whole Bible once and has just started again (spec:
// bibletrackerweb#18). Kept apart from fixtures.ts, which the schedule tests share.
import { PROTESTANT_CANON_INDEX } from '@/data/bible/canon-index';
import { addDaysToDateKey } from '@/utils/date-key';

import type { ReadingCompletion } from '../types';
import { makeCompletion, makePlan } from './fixtures';

const index = PROTESTANT_CANON_INDEX;

/** One chapter a day through the whole canon from `start`, recorded against `planId`. */
export function readWholeBible(start: string, planId: string): ReadingCompletion[] {
  return Array.from({ length: index.totalChapters }, (_, position) => {
    const reference = index.fromAbsoluteIndex(position);
    if (reference === null) throw new Error('canon walk ended early');
    return makeCompletion(addDaysToDateKey(start, position), {
      id: `${planId}-${position}`,
      readingPlanId: planId,
      ...reference,
    });
  });
}

/** Read-through 1: Genesis 1 from 2024-01-01, closed when read-through 2 began. */
export const FIRST = makePlan({
  id: 'first',
  startDate: '2024-01-01',
  isActive: false,
  endDate: '2027-05-31',
});

/** Read-through 2: Genesis 1 again from 2027-06-01, open. */
export const SECOND = makePlan({
  id: 'second',
  startDate: '2027-06-01',
  readThrough: 2,
});

export const FIRST_RUN = readWholeBible('2024-01-01', 'first');

/** The day read-through 1 finished: 1,189 chapters at one a day. */
export const FIRST_FINISHED = addDaysToDateKey('2024-01-01', index.totalChapters - 1);
