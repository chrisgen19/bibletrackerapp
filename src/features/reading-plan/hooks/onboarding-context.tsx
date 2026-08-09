import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import { buildReadingPlanDraft } from '@/features/reading-plan/domain/plan-draft';
import type { ReadingPlanDraft, StartMode } from '@/features/reading-plan/domain/types';
import { getTodayDateKey, type DateKey } from '@/utils/date-key';

interface OnboardingState {
  mode: StartMode;
  bookId: string;
  chapter: number;
  startDate: DateKey;
}

interface OnboardingContextValue extends OnboardingState {
  canonId: string;
  setMode: (mode: StartMode) => void;
  setPosition: (position: { bookId: string; chapter: number; startDate: DateKey }) => void;
  /** The normalised draft that will be persisted. */
  draft: ReadingPlanDraft;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Carries the in-progress selection across the onboarding steps without touching SQLite. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const canonId = DEFAULT_CANON_ID;
  const first = getCanonIndex(canonId).firstReference;

  const [state, setState] = useState<OnboardingState>(() => ({
    mode: 'genesis',
    bookId: first.bookId,
    chapter: first.chapter,
    startDate: getTodayDateKey(),
  }));

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      canonId,
      setMode: (mode) => setState((current) => ({ ...current, mode })),
      setPosition: (position) => setState((current) => ({ ...current, ...position })),
      draft: buildReadingPlanDraft({
        mode: state.mode,
        bookId: state.bookId,
        chapter: state.chapter,
        startDate: state.startDate,
        canonId,
      }),
    }),
    [state, canonId],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext);
  if (value === null) {
    throw new Error('useOnboarding must be used inside an OnboardingProvider.');
  }
  return value;
}
