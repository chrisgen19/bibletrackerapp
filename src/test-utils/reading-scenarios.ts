import { makeCompletion, makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import { createScheduleContext } from '@/features/reading-plan/domain/schedule';

/**
 * Several days into a plan begun at Genesis 1 on 1 August: Genesis 1-3 read, Genesis 4
 * read in two sittings, Genesis 5 only verses 1-10. Six stored rows, four chapters read,
 * and the reader is on Genesis 5. The same scenario as bibletrackerweb's, so both apps
 * pin the same numbers (#18).
 */
export function readerPartWayThrough() {
  const plan = makePlan({ startDate: '2026-08-01' });
  const completions = [
    makeCompletion('2026-08-01', { id: 'r1', chapter: 1 }),
    makeCompletion('2026-08-02', { id: 'r2', chapter: 2 }),
    makeCompletion('2026-08-03', { id: 'r3', chapter: 3 }),
    makeCompletion('2026-08-04', { id: 'r4a', chapter: 4, verses: { from: 1, to: 10 } }),
    makeCompletion('2026-08-04', { id: 'r4b', chapter: 4, verses: { from: 11, to: 26 } }),
    makeCompletion('2026-08-05', { id: 'r5', chapter: 5, verses: { from: 1, to: 10 } }),
  ];
  const today = '2026-08-06';
  return {
    plans: [plan],
    activePlan: plan,
    completions,
    scheduleContext: createScheduleContext([plan], completions, today),
    today,
    hasCompletedOnboarding: true,
  };
}
