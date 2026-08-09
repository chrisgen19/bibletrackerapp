import type { BibleReference } from '@/data/bible/canon';
import type { DateKey } from '@/utils/date-key';

/**
 * A contiguous segment of a user's reading history.
 *
 * Plans are append-only. Changing a reading position closes the current segment
 * (`endDate` + `isActive: false`) and opens a new one, so the schedule that
 * governed a past date can always be reconstructed exactly as the user saw it.
 */
export interface ReadingPlan {
  readonly id: string;
  readonly canonId: string;
  readonly startDate: DateKey;
  readonly startBookId: string;
  readonly startChapter: number;
  readonly chaptersPerDay: number;
  readonly createdAt: number;
  readonly isActive: boolean;
  /** Last day this segment governs, inclusive. `null` while the segment is open-ended. */
  readonly endDate: DateKey | null;
}

/** A completion event. Book/chapter are snapshotted so history survives plan changes. */
export interface ReadingCompletion {
  readonly id: string;
  readonly readingPlanId: string;
  readonly localDate: DateKey;
  readonly bookId: string;
  readonly chapter: number;
  readonly completedAt: number;
}

/** What a given calendar day asks the user to read. */
export type ScheduledReading =
  | { readonly kind: 'before-plan' }
  | { readonly kind: 'canon-complete' }
  | { readonly kind: 'scheduled'; readonly chapters: readonly BibleReference[] };

/**
 * How a calendar day should be presented.
 *
 * `missed` is deliberately non-punitive in the UI: it is a neutral state, not an
 * error state.
 */
export type ReadingStatus =
  | 'no-plan'
  | 'before-plan'
  | 'canon-complete'
  | 'completed'
  | 'today-pending'
  | 'missed'
  | 'upcoming';

export interface DayReading {
  readonly date: DateKey;
  readonly status: ReadingStatus;
  readonly scheduled: ScheduledReading;
  /** The chapters actually recorded, which may differ from `scheduled` after a plan change. */
  readonly completedChapters: readonly BibleReference[];
  readonly plan: ReadingPlan | null;
}

/**
 * How onboarding seeds the first plan.
 *
 * `choose` covers both "I'm partway through" and "my plan began earlier": the start
 * date defaults to today and is only surfaced if the user opens the disclosure, so
 * the common case stays a two-field decision.
 */
export type StartMode = 'genesis' | 'choose';

export interface ReadingPlanDraft {
  readonly canonId: string;
  readonly startDate: DateKey;
  readonly startBookId: string;
  readonly startChapter: number;
  readonly chaptersPerDay: number;
}
