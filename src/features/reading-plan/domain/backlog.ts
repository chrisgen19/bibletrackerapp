import type { BibleReference } from '@/data/bible/canon';
import { getCanonIndex, type CanonIndex } from '@/data/bible/canon-index';
import { addDaysToDateKey, compareDateKeys, maxDateKey, type DateKey } from '@/utils/date-key';

import { getChapterProgress, getUnfinishedChapters, type ChapterProgress } from './chapter-progress';
import { calculateReadingForDate, getEarliestPlanStart, resolvePlanForDate } from './schedule';
import type { ReadingCompletion, ReadingPlan } from './types';

/**
 * How far back the scan looks. A plan running for years would otherwise walk
 * thousands of days on every render, and a backlog that deep is not actionable.
 */
const MAX_LOOKBACK_DAYS = 1500;

/** A chapter still owed, and why. */
export type BacklogEntry =
  | { readonly kind: 'unfinished'; readonly reference: BibleReference; readonly progress: ChapterProgress }
  | { readonly kind: 'skipped'; readonly reference: BibleReference };

/**
 * Where the plan currently stands, as an absolute canon index.
 *
 * Everything from here onwards will be scheduled again by the active plan, because
 * a plan is a monotonic walk to the end of the canon. That is what makes a chapter
 * "skipped past" rather than merely "not read yet".
 */
function getPlanFrontier(
  plans: readonly ReadingPlan[],
  today: DateKey,
  index: CanonIndex,
): number | null {
  const plan = resolvePlanForDate(plans, today);
  if (plan === null) return null;

  const scheduled = calculateReadingForDate(plan, today, index);
  if (scheduled.kind === 'canon-complete') return index.totalChapters;
  if (scheduled.kind !== 'scheduled') return null;

  const first = scheduled.chapters[0];
  return first === undefined ? null : index.toAbsoluteIndex(first);
}

/**
 * Chapters the plan scheduled on a past day, never read, and already behind the
 * plan's current position.
 *
 * The last condition is what stops this reporting chapters that are merely coming
 * up: after a plan change the same chapter is often scheduled twice — once on a day
 * that was missed, and again ahead of today. Only the ones the plan has moved *past*
 * are genuinely lost, because nothing will offer them again.
 *
 * Chapters with any completion at all are excluded: a part-read chapter belongs to
 * {@link getUnfinishedChapters}, which knows which verses are outstanding.
 */
export function getSkippedChapters(
  plans: readonly ReadingPlan[],
  completions: readonly ReadingCompletion[],
  today: DateKey,
  index: CanonIndex = getCanonIndex('protestant'),
): readonly BibleReference[] {
  const frontier = getPlanFrontier(plans, today, index);
  if (frontier === null) return [];

  const earliest = getEarliestPlanStart(plans);
  if (earliest === null) return [];

  const touched = new Set<string>();
  for (const completion of completions) {
    touched.add(`${completion.bookId}:${completion.chapter}`);
  }

  const found = new Map<number, BibleReference>();
  let date = maxDateKey(earliest, addDaysToDateKey(today, -MAX_LOOKBACK_DAYS));

  for (let scanned = 0; scanned < MAX_LOOKBACK_DAYS; scanned += 1) {
    if (compareDateKeys(date, today) >= 0) break;

    const plan = resolvePlanForDate(plans, date);
    if (plan !== null) {
      const scheduled = calculateReadingForDate(plan, date, index);
      if (scheduled.kind === 'scheduled') {
        for (const reference of scheduled.chapters) {
          const absolute = index.toAbsoluteIndex(reference);
          if (absolute === null || absolute >= frontier) continue;
          if (touched.has(`${reference.bookId}:${reference.chapter}`)) continue;
          found.set(absolute, reference);
        }
      }
    }

    date = addDaysToDateKey(date, 1);
  }

  return [...found.entries()].sort(([a], [b]) => a - b).map(([, reference]) => reference);
}

/**
 * Everything still owed, in canon order: chapters left part-read and chapters the
 * plan skipped past entirely.
 *
 * One list rather than two, because the distinction is about *why* a chapter is
 * outstanding, not about what to do next — either way the answer is to read it.
 */
export function getBacklog(
  plans: readonly ReadingPlan[],
  completions: readonly ReadingCompletion[],
  today: DateKey,
  index: CanonIndex = getCanonIndex('protestant'),
): readonly BacklogEntry[] {
  const entries: BacklogEntry[] = getUnfinishedChapters(completions, index).map((progress) => ({
    kind: 'unfinished',
    reference: progress.reference,
    progress,
  }));

  for (const reference of getSkippedChapters(plans, completions, today, index)) {
    entries.push({ kind: 'skipped', reference });
  }

  return entries.sort(
    (a, b) => (index.toAbsoluteIndex(a.reference) ?? 0) - (index.toAbsoluteIndex(b.reference) ?? 0),
  );
}

/** Progress for a backlog entry, so the sheet can resume at the right verse. */
export function getBacklogProgress(
  entry: BacklogEntry,
  completions: readonly ReadingCompletion[],
  index: CanonIndex = getCanonIndex('protestant'),
): ChapterProgress | null {
  return entry.kind === 'unfinished'
    ? entry.progress
    : getChapterProgress(completions, entry.reference, index);
}
