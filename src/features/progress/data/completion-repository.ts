import { and, asc, count, eq, gte, lte } from 'drizzle-orm';

import type { BibleReference } from '@/data/bible/canon';
import type { ReadingDatabase } from '@/db/client';
import { readingCompletions, type ReadingCompletionRow } from '@/db/schema';
import type { ReadingCompletion } from '@/features/reading-plan/domain/types';
import type { DateKey } from '@/utils/date-key';
import { createId } from '@/utils/id';

function toDomain(row: ReadingCompletionRow): ReadingCompletion {
  return {
    id: row.id,
    readingPlanId: row.readingPlanId,
    localDate: row.localDate,
    bookId: row.bookId,
    chapter: row.chapter,
    completedAt: row.completedAt,
  };
}

/** Inclusive on both ends. Backs the calendar, which loads a month at a time. */
export function getCompletionsForRange(db: ReadingDatabase, start: DateKey, end: DateKey): ReadingCompletion[] {
  return db
    .select()
    .from(readingCompletions)
    .where(and(gte(readingCompletions.localDate, start), lte(readingCompletions.localDate, end)))
    .orderBy(asc(readingCompletions.localDate))
    .all()
    .map(toDomain);
}

/** Streaks need the whole history, so this deliberately has no range. */
export function getAllCompletions(db: ReadingDatabase): ReadingCompletion[] {
  return db
    .select()
    .from(readingCompletions)
    .orderBy(asc(readingCompletions.localDate))
    .all()
    .map(toDomain);
}

export function getCompletionsForDate(db: ReadingDatabase, localDate: DateKey): ReadingCompletion[] {
  return db
    .select()
    .from(readingCompletions)
    .where(eq(readingCompletions.localDate, localDate))
    .all()
    .map(toDomain);
}

export interface MarkCompleteInput {
  readonly readingPlanId: string;
  readonly localDate: DateKey;
  readonly chapters: readonly BibleReference[];
  readonly completedAt?: number;
}

/**
 * Records a day's reading.
 *
 * Runs in a transaction so a multi-chapter day is all-or-nothing, and re-marking a
 * day that is already complete is a no-op rather than a duplicate-key failure.
 */
export function markReadingComplete(db: ReadingDatabase, input: MarkCompleteInput): void {
  const completedAt = input.completedAt ?? Date.now();

  db.transaction((tx) => {
    for (const chapter of input.chapters) {
      tx.insert(readingCompletions)
        .values({
          id: createId(),
          readingPlanId: input.readingPlanId,
          localDate: input.localDate,
          bookId: chapter.bookId,
          chapter: chapter.chapter,
          completedAt,
        })
        .onConflictDoNothing()
        .run();
    }
  });
}

/** Undo: removes every chapter recorded on that local day. */
export function removeReadingCompletion(db: ReadingDatabase, localDate: DateKey): void {
  db.delete(readingCompletions).where(eq(readingCompletions.localDate, localDate)).run();
}

export function countAllCompletions(db: ReadingDatabase): number {
  return db.select({ value: count() }).from(readingCompletions).get()?.value ?? 0;
}
