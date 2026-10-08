import { makeCompletion, makePlan } from '@/features/reading-plan/domain/__tests__/fixtures';
import type { ReadingCompletion, ReadingPlan } from '@/features/reading-plan/domain/types';
import { deriveReadingState } from '@/features/reading-plan/hooks/reading-state';

/** What useReadingData derives from these rows, without the actions. */
function readingData(plan: ReadingPlan, completions: readonly ReadingCompletion[], today: string) {
  return {
    ...deriveReadingState({ plans: [plan], activePlan: plan, completions }, today),
    plans: [plan],
    activePlan: plan,
    completions,
    today,
    hasCompletedOnboarding: true,
  };
}

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
  return readingData(plan, completions, '2026-08-06');
}

/**
 * Genesis 1-4 read from 1 August, and today (5 August) only an extra reading of
 * Revelation 5. Today's plan reading is still Genesis 5 (#19).
 */
export function readerWithAnExtraToday() {
  const plan = makePlan({ startDate: '2026-08-01' });
  const completions = [
    ...[1, 2, 3, 4].map((chapter) => makeCompletion(`2026-08-0${chapter}`, { id: `r${chapter}`, chapter })),
    makeCompletion('2026-08-05', { id: 'extra', bookId: 'REV', chapter: 5, isExtra: true }),
  ];
  return readingData(plan, completions, '2026-08-05');
}
