import { useMemo } from 'react';

import { getCanonIndex } from '@/data/bible/canon-index';
import {
  countChaptersRead,
  getChapterProgress,
  getUnfinishedChapters,
} from '@/features/reading-plan/domain/chapter-progress';
import { useReadingData } from '@/features/reading-plan/hooks/reading-data-provider';
import { useTodayReading } from '@/features/reading-plan/hooks/use-today-reading';

/**
 * What the progress screen shows beside the calendar.
 *
 * Chapter progress counts the current read-through's plan readings only: an extra
 * reading, or one from an earlier time through the Bible, is never "still to finish"
 * and is not a chapter read in this read-through.
 */
export function useReadingProgress() {
  const { progressReadings: completions, activePlan } = useReadingData();
  const todayReading = useTodayReading();
  const canonIndex = useMemo(() => getCanonIndex(activePlan?.canonId ?? 'protestant'), [activePlan]);

  /** Progress on today's chapter, so the card can show what is left to read. */
  const todayProgress = useMemo(() => {
    if (todayReading.scheduled.kind !== 'scheduled') return null;
    const chapter =
      todayReading.scheduled.chapters.length === 1 ? todayReading.scheduled.chapters[0] : undefined;
    if (chapter === undefined) return null;
    return getChapterProgress(completions, chapter, canonIndex);
  }, [todayReading.scheduled, completions, canonIndex]);

  /**
   * Chapters left half-read, minus the one today's card is already showing.
   *
   * Keyed off `todayProgress` rather than the scheduled chapters: the card only
   * offers "Continue Reading" when it has progress for a single chapter, so
   * excluding every scheduled chapter hid partial ones on a multi-chapter day —
   * a day with two chapters logged against it, which is exactly the shape this
   * list exists to surface.
   */
  const unfinished = useMemo(() => {
    const shownToday =
      todayProgress?.isPartial === true
        ? `${todayProgress.reference.bookId}:${todayProgress.reference.chapter}`
        : null;
    return getUnfinishedChapters(completions, canonIndex).filter(
      (progress) => `${progress.reference.bookId}:${progress.reference.chapter}` !== shownToday,
    );
  }, [completions, canonIndex, todayProgress]);

  /** Chapters finished, not completion rows — a chapter read in two sittings is one. */
  const chaptersRead = useMemo(() => countChaptersRead(completions, canonIndex), [completions, canonIndex]);

  return { todayReading, todayProgress, unfinished, chaptersRead, canonIndex };
}
