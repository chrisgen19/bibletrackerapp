import { Alert } from 'react-native';

import type { BibleReference } from '@/data/bible/canon';
import type { CanonIndex } from '@/data/bible/canon-index';
import { formatReference } from '@/features/reading-plan/domain/reference';
import type { ReadingPlanDraft } from '@/features/reading-plan/domain/types';

/**
 * The notice after a Custom log is recorded as an extra reading: what was logged, where
 * the plan stays, and what accepting would do instead. Worded as bibletrackerweb's.
 */
export function extraReadingMessage(
  reference: BibleReference,
  currentPosition: BibleReference | null,
  draft: ReadingPlanDraft | null,
  index: CanonIndex,
): string {
  const logged = formatReference(reference, index);
  const stays =
    currentPosition === null
      ? 'Your plan stays where it is.'
      : `Your plan stays at ${formatReference(currentPosition, index)}.`;
  const instead =
    draft === null
      ? 'Count it toward your plan instead?'
      : `Move your plan to carry on from ${formatReference(
          { bookId: draft.startBookId, chapter: draft.startChapter },
          index,
        )} instead? Days you have already completed stay exactly as they are.`;
  return `${logged} is logged as an extra reading. ${stays}\n\n${instead}`;
}

export interface ExtraReadingOffer {
  readonly reference: BibleReference;
  readonly currentPosition: BibleReference | null;
  /** The plan change accepting makes, or null when it only counts the reading. */
  readonly draft: ReadingPlanDraft | null;
  readonly index: CanonIndex;
  readonly onAccept: () => void;
}

/**
 * Tells the reader a Custom log was recorded as an extra reading, and offers to make it
 * part of the plan instead. Same button order as "Continue from here?": keeping things
 * as they are comes first.
 */
export function offerExtraReading({ reference, currentPosition, draft, index, onAccept }: ExtraReadingOffer): void {
  Alert.alert('Logged as an extra reading', extraReadingMessage(reference, currentPosition, draft, index), [
    { text: 'Keep as extra', style: 'cancel' },
    { text: draft === null ? 'Count toward plan' : 'Move my plan', onPress: onAccept },
  ]);
}
