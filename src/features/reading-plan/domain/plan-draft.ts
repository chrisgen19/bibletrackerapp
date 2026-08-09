import { z } from 'zod';

import { DEFAULT_CANON_ID, getCanonIndex } from '@/data/bible/canon-index';
import { getTodayDateKey, isValidDateKey, type DateKey } from '@/utils/date-key';

import type { ReadingPlanDraft, StartMode } from './types';

/** V1 reads exactly one chapter a day; the field exists so the plan engine can grow. */
export const DEFAULT_CHAPTERS_PER_DAY = 1;

export const readingPlanDraftSchema = z
  .object({
    canonId: z.string().min(1),
    startDate: z.string().refine(isValidDateKey, 'Start date must be a valid YYYY-MM-DD day.'),
    startBookId: z.string().min(1),
    startChapter: z.number().int().min(1),
    chaptersPerDay: z.number().int().min(1).max(10),
  })
  .refine(
    (draft) =>
      getCanonIndex(draft.canonId).isValidReference({
        bookId: draft.startBookId,
        chapter: draft.startChapter,
      }),
    { message: 'That chapter does not exist in the selected book.', path: ['startChapter'] },
  );

export type ReadingPlanDraftInput = z.input<typeof readingPlanDraftSchema>;

export interface DraftValidation {
  readonly ok: boolean;
  /** User-facing copy; never a raw validation dump. */
  readonly message: string | null;
}

export function validateReadingPlanDraft(draft: ReadingPlanDraft): DraftValidation {
  const result = readingPlanDraftSchema.safeParse(draft);
  if (result.success) return { ok: true, message: null };
  const first = result.error.issues[0];
  return { ok: false, message: first?.message ?? 'That reading plan is not valid.' };
}

/** Highest chapter selectable for a book, or 1 when the book is unknown. */
export function getChapterCount(bookId: string, canonId: string = DEFAULT_CANON_ID): number {
  return getCanonIndex(canonId).getBook(bookId)?.chapterCount ?? 1;
}

export function clampChapter(bookId: string, chapter: number, canonId: string = DEFAULT_CANON_ID): number {
  const max = getChapterCount(bookId, canonId);
  if (!Number.isFinite(chapter)) return 1;
  return Math.min(Math.max(Math.trunc(chapter), 1), max);
}

export interface BuildDraftOptions {
  readonly mode: StartMode;
  readonly bookId?: string;
  readonly chapter?: number;
  readonly startDate?: DateKey;
  readonly canonId?: string;
  readonly today?: DateKey;
}

/**
 * Builds a normalised draft for each onboarding path.
 *
 * "Continue where I am" makes the chosen chapter *today's* reading, so the plan
 * start date is today rather than back-dated.
 */
export function buildReadingPlanDraft(options: BuildDraftOptions): ReadingPlanDraft {
  const canonId = options.canonId ?? DEFAULT_CANON_ID;
  const index = getCanonIndex(canonId);
  const today = options.today ?? getTodayDateKey();

  if (options.mode === 'genesis') {
    return {
      canonId,
      startDate: today,
      startBookId: index.firstReference.bookId,
      startChapter: index.firstReference.chapter,
      chaptersPerDay: DEFAULT_CHAPTERS_PER_DAY,
    };
  }

  const bookId = options.bookId ?? index.firstReference.bookId;
  const chapter = clampChapter(bookId, options.chapter ?? 1, canonId);
  const startDate = options.mode === 'custom' ? (options.startDate ?? today) : today;

  return { canonId, startDate, startBookId: bookId, startChapter: chapter, chaptersPerDay: DEFAULT_CHAPTERS_PER_DAY };
}
