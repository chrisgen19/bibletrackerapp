import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import type { BibleReference, VerseRange } from '@/data/bible/canon';
import type { ReadingDatabase } from '@/db/client';
import { useDatabase } from '@/db/database-provider';
import {
  countReadingTowardPlan,
  getAllCompletions,
  markReadingComplete,
  removeCompletionById,
  removeReadingCompletion,
  setReadingExtra as storeReadingExtra,
} from '@/features/progress/data/completion-repository';
import {
  createReadingPlan,
  getActiveReadingPlan,
  getAllReadingPlans,
  getGoverningPlan,
  replaceActiveReadingPlan,
  resetAllProgress,
  startNextReadThrough as storeNextReadThrough,
} from '@/features/reading-plan/data/reading-plan-repository';
import {
  buildNextReadThroughDraft,
  isCurrentReadThroughFinished,
} from '@/features/reading-plan/domain/read-through';
import type {
  ReadingCompletion,
  ReadingPlan,
  ReadingPlanDraft,
} from '@/features/reading-plan/domain/types';
import { getTodayDateKey, type DateKey } from '@/utils/date-key';

import { deriveReadingState, type ReadingSnapshot, type ReadingState } from './reading-state';

interface ReadingDataValue extends ReadingState {
  /** Every plan segment, oldest first. */
  plans: readonly ReadingPlan[];
  /** The open-ended segment, or `null` before onboarding. */
  activePlan: ReadingPlan | null;
  completions: readonly ReadingCompletion[];
  /** Recomputed when the app returns to the foreground, so the app never shows a stale "today". */
  today: DateKey;
  /**
   * The presence of an active plan *is* the onboarding marker. Deriving it rather
   * than storing a separate flag makes "onboarded but no plan" unrepresentable.
   */
  hasCompletedOnboarding: boolean;
  startPlan: (draft: ReadingPlanDraft) => void;
  changePlan: (draft: ReadingPlanDraft) => void;
  /**
   * Returns the stored row for each chapter, or none when nothing was written, so
   * callers never claim a phantom success. The extra-reading alert flips the row it
   * gets back.
   *
   * `verses` records a partial read and applies only when a single chapter is given —
   * you read part of one chapter, never part of several.
   */
  completeReading: (
    date: DateKey,
    chapters: readonly BibleReference[],
    verses?: VerseRange,
    isExtra?: boolean,
  ) => readonly string[];
  undoReading: (date: DateKey) => void;
  /** Removes one recorded reading, leaving the rest of that day intact. */
  undoReadingEntry: (id: string) => void;
  /** Moves one recorded reading out of the plan ("Mark as extra") or back into it. */
  setReadingExtra: (id: string, isExtra: boolean) => void;
  /**
   * Counts an extra reading toward the plan, moving the plan to `draft` first when one
   * is given ("Move my plan"). One write, so the reading never joins the plan without it.
   */
  countTowardPlan: (id: string, draft: ReadingPlanDraft | null) => void;
  /**
   * Starts the next read-through from the canon's first chapter today, at the same pace.
   * False, writing nothing, unless the read-through in progress is finished.
   */
  startNextReadThrough: () => boolean;
  resetProgress: () => void;
}

const ReadingDataContext = createContext<ReadingDataValue | null>(null);

function readSnapshot(db: ReadingDatabase): ReadingSnapshot {
  return {
    plans: getAllReadingPlans(db),
    activePlan: getActiveReadingPlan(db),
    completions: getAllCompletions(db),
  };
}

/**
 * Single source of reading state for the UI.
 *
 * SQLite remains the source of truth: every mutation writes first, then the whole
 * snapshot is re-read. Reads are synchronous and the dataset is at most a few
 * thousand rows (one per chapter of the canon), so this is cheaper and far more
 * predictable than incremental cache patching.
 */
export function ReadingDataProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const [snapshot, setSnapshot] = useState<ReadingSnapshot>(() => readSnapshot(db));
  const [today, setToday] = useState<DateKey>(() => getTodayDateKey());

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot(db));
  }, [db]);

  // Midnight, timezone changes and long backgrounding all move "today".
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setToday((current) => {
        const next = getTodayDateKey();
        return next === current ? current : next;
      });
    });
    return () => subscription.remove();
  }, []);

  const startPlan = useCallback(
    (draft: ReadingPlanDraft) => {
      createReadingPlan(db, draft);
      refresh();
    },
    [db, refresh],
  );

  const changePlan = useCallback(
    (draft: ReadingPlanDraft) => {
      replaceActiveReadingPlan(db, draft);
      refresh();
    },
    [db, refresh],
  );

  const completeReading = useCallback(
    (date: DateKey, chapters: readonly BibleReference[], verses?: VerseRange, isExtra?: boolean) => {
      if (chapters.length === 0) return [];
      // Completions must belong to a plan row. Normally that is the segment governing
      // the date, but a hand-logged reading can land on a day no segment covers (before
      // the plan began), so fall back to the active plan rather than dropping it.
      const plan = getGoverningPlan(db, date);
      // No plan at all means there is nowhere to attach the row. Report the failure
      // rather than swallowing it, so the UI cannot announce a completion that the
      // database never accepted.
      if (plan === null) return [];
      const ids = markReadingComplete(db, {
        readingPlanId: plan.id,
        localDate: date,
        chapters,
        verses,
        isExtra,
      });
      refresh();
      return ids;
    },
    [db, refresh],
  );

  const undoReading = useCallback(
    (date: DateKey) => {
      removeReadingCompletion(db, date);
      refresh();
    },
    [db, refresh],
  );

  const undoReadingEntry = useCallback(
    (id: string) => {
      removeCompletionById(db, id);
      refresh();
    },
    [db, refresh],
  );

  const setReadingExtra = useCallback(
    (id: string, isExtra: boolean) => {
      storeReadingExtra(db, id, isExtra);
      refresh();
    },
    [db, refresh],
  );

  const countTowardPlan = useCallback(
    (id: string, draft: ReadingPlanDraft | null) => {
      countReadingTowardPlan(db, id, draft);
      refresh();
    },
    [db, refresh],
  );

  const startNextReadThrough = useCallback((): boolean => {
    const active = getActiveReadingPlan(db);
    if (active === null) return false;
    // Asked again of the stored readings inside the write, not of this render's snapshot.
    const isFinished = (stored: ReadingDatabase) =>
      isCurrentReadThroughFinished(
        getAllReadingPlans(stored),
        getActiveReadingPlan(stored),
        getAllCompletions(stored),
      );
    const started = storeNextReadThrough(db, buildNextReadThroughDraft(active, today), isFinished);
    refresh();
    return started !== null;
  }, [db, refresh, today]);

  const resetProgress = useCallback(() => {
    resetAllProgress(db);
    refresh();
  }, [db, refresh]);

  const value = useMemo<ReadingDataValue>(
    () => ({
      ...deriveReadingState(snapshot, today),
      plans: snapshot.plans,
      activePlan: snapshot.activePlan,
      completions: snapshot.completions,
      today,
      hasCompletedOnboarding: snapshot.activePlan !== null,
      startPlan,
      changePlan,
      completeReading,
      undoReading,
      undoReadingEntry,
      setReadingExtra,
      countTowardPlan,
      startNextReadThrough,
      resetProgress,
    }),
    [
      snapshot,
      today,
      startPlan,
      changePlan,
      completeReading,
      undoReading,
      undoReadingEntry,
      setReadingExtra,
      countTowardPlan,
      startNextReadThrough,
      resetProgress,
    ],
  );

  return <ReadingDataContext.Provider value={value}>{children}</ReadingDataContext.Provider>;
}

export function useReadingData(): ReadingDataValue {
  const value = useContext(ReadingDataContext);
  if (value === null) {
    throw new Error('useReadingData must be used inside a ReadingDataProvider.');
  }
  return value;
}
