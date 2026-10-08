import {
  getCurrentReadThrough,
  getReadThroughFinishDates,
  getSegmentFinishDates,
  selectProgressCompletions,
} from '@/features/reading-plan/domain/read-through';
import { selectPlanReadings } from '@/features/reading-plan/domain/reading-kind';
import {
  createCompletionLookup,
  createScheduleContext,
  type CompletionLookup,
  type ScheduleContext,
} from '@/features/reading-plan/domain/schedule';
import type { ReadingCompletion, ReadingPlan } from '@/features/reading-plan/domain/types';
import type { DateKey } from '@/utils/date-key';

/** What is stored, as the provider reads it after every write. */
export interface ReadingSnapshot {
  readonly plans: readonly ReadingPlan[];
  readonly activePlan: ReadingPlan | null;
  readonly completions: readonly ReadingCompletion[];
}

export interface ReadingState {
  /** Every reading, extras included. */
  readonly completionLookup: CompletionLookup;
  /** Every reading on its day: the calendar, streaks and month statistics. */
  readonly scheduleContext: ScheduleContext;
  /** Readings that count toward the plan: every row but the extras. */
  readonly planReadings: readonly ReadingCompletion[];
  readonly planCompletionLookup: CompletionLookup;
  /**
   * Plan readings only on their day: today's card, the day sheet and the reading plan
   * screen, so a day holding only an extra still offers that day's plan reading.
   */
  readonly planScheduleContext: ScheduleContext;
  /** The current read-through's plan readings: chapter progress and chapters read. */
  readonly progressReadings: readonly ReadingCompletion[];
  readonly currentReadThrough: number;
  /** Times through the Bible: read-throughs that reached the end. */
  readonly finishedReadThroughs: number;
  /** True once the read-through in progress is finished, and only then. */
  readonly canStartNextReadThrough: boolean;
}

/**
 * Everything the screens read, derived once per snapshot.
 *
 * Both schedule contexts move the plan by the current read-through's plan readings, so
 * an extra never steps the queue past its chapter and a finished read-through does not
 * count as progress in the next. They differ only in what each day shows. Each segment
 * keeps its own finish line, measured in its own read-through, so the days between
 * finishing one read-through and starting the next stay finished rather than missed.
 */
export function deriveReadingState(snapshot: ReadingSnapshot, today: DateKey): ReadingState {
  const { plans, activePlan, completions } = snapshot;
  const planReadings = selectPlanReadings(completions);
  const currentReadThrough = getCurrentReadThrough(plans, activePlan);
  const progressReadings = selectProgressCompletions(plans, completions, currentReadThrough);
  const finishedOn = getReadThroughFinishDates(plans, completions);
  const segmentFinishes = getSegmentFinishDates(plans, completions, today);

  const contextFor = (rows: readonly ReadingCompletion[]): ScheduleContext => ({
    ...createScheduleContext(plans, rows, today, undefined, progressReadings),
    canonFinishedOnByPlan: segmentFinishes,
  });

  return {
    completionLookup: createCompletionLookup(completions),
    scheduleContext: contextFor(completions),
    planReadings,
    planCompletionLookup: createCompletionLookup(planReadings),
    planScheduleContext: contextFor(planReadings),
    progressReadings,
    currentReadThrough,
    finishedReadThroughs: finishedOn.size,
    canStartNextReadThrough: activePlan !== null && finishedOn.has(currentReadThrough),
  };
}
