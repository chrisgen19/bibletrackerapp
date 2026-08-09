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

import type { BibleReference } from '@/data/bible/canon';
import type { Database } from '@/db/client';
import { useDatabase } from '@/db/database-provider';
import {
  getAllCompletions,
  markReadingComplete,
  removeReadingCompletion,
} from '@/features/progress/data/completion-repository';
import {
  createReadingPlan,
  getActiveReadingPlan,
  getAllReadingPlans,
  replaceActiveReadingPlan,
  resetAllProgress,
} from '@/features/reading-plan/data/reading-plan-repository';
import {
  createCompletionLookup,
  resolvePlanForDate,
  type CompletionLookup,
} from '@/features/reading-plan/domain/schedule';
import type {
  ReadingCompletion,
  ReadingPlan,
  ReadingPlanDraft,
} from '@/features/reading-plan/domain/types';
import { getTodayDateKey, type DateKey } from '@/utils/date-key';

interface ReadingDataValue {
  /** Every plan segment, oldest first. */
  plans: readonly ReadingPlan[];
  /** The open-ended segment, or `null` before onboarding. */
  activePlan: ReadingPlan | null;
  completions: readonly ReadingCompletion[];
  completionLookup: CompletionLookup;
  /** Recomputed when the app returns to the foreground, so the app never shows a stale "today". */
  today: DateKey;
  /**
   * The presence of an active plan *is* the onboarding marker. Deriving it rather
   * than storing a separate flag makes "onboarded but no plan" unrepresentable.
   */
  hasCompletedOnboarding: boolean;
  startPlan: (draft: ReadingPlanDraft) => void;
  changePlan: (draft: ReadingPlanDraft) => void;
  completeReading: (date: DateKey, chapters: readonly BibleReference[]) => void;
  undoReading: (date: DateKey) => void;
  resetProgress: () => void;
}

const ReadingDataContext = createContext<ReadingDataValue | null>(null);

interface Snapshot {
  plans: readonly ReadingPlan[];
  activePlan: ReadingPlan | null;
  completions: readonly ReadingCompletion[];
}

function readSnapshot(db: Database): Snapshot {
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
  const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot(db));
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
    (date: DateKey, chapters: readonly BibleReference[]) => {
      if (chapters.length === 0) return;
      // Completions must belong to a plan row. Normally that is the segment governing
      // the date, but a hand-logged reading can land on a day no segment covers (before
      // the plan began), so fall back to the active plan rather than dropping it.
      const plan = resolvePlanForDate(getAllReadingPlans(db), date) ?? getActiveReadingPlan(db);
      if (plan === null) return;
      markReadingComplete(db, { readingPlanId: plan.id, localDate: date, chapters });
      refresh();
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

  const resetProgress = useCallback(() => {
    resetAllProgress(db);
    refresh();
  }, [db, refresh]);

  const value = useMemo<ReadingDataValue>(
    () => ({
      plans: snapshot.plans,
      activePlan: snapshot.activePlan,
      completions: snapshot.completions,
      completionLookup: createCompletionLookup(snapshot.completions),
      today,
      hasCompletedOnboarding: snapshot.activePlan !== null,
      startPlan,
      changePlan,
      completeReading,
      undoReading,
      resetProgress,
    }),
    [snapshot, today, startPlan, changePlan, completeReading, undoReading, resetProgress],
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
