import { and, asc, count, eq, gte, lte } from 'drizzle-orm';

import type { BibleReference, VerseRange } from '@/data/bible/canon';
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
    // 0,0 is the "whole chapter, span not recorded" sentinel.
    verses: row.fromVerse === 0 && row.toVerse === 0 ? null : { from: row.fromVerse, to: row.toVerse },
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
  /**
   * A partial span, applied only when a single chapter is being recorded — you read
   * part of one chapter, never part of several. Omit for whole-chapter reads.
   */
  readonly verses?: VerseRange;
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

  // A span only makes sense for a single chapter; ignore it otherwise rather than
  // silently applying the same verses to several chapters.
  const span = input.chapters.length === 1 ? input.verses : undefined;

  db.transaction((tx) => {
    for (const chapter of input.chapters) {
      tx.insert(readingCompletions)
        .values({
          id: createId(),
          readingPlanId: input.readingPlanId,
          localDate: input.localDate,
          bookId: chapter.bookId,
          chapter: chapter.chapter,
          fromVerse: span?.from ?? 0,
          toVerse: span?.to ?? 0,
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

/**
 * Removes a single recorded reading.
 *
 * A day can hold several rows — a multi-chapter plan, or one chapter finished across
 * two sittings — and clearing the whole date to undo one mistaken entry would take
 * the correct ones with it.
 */
export function removeCompletionById(db: ReadingDatabase, id: string): void {
  db.delete(readingCompletions).where(eq(readingCompletions.id, id)).run();
}

export function countAllCompletions(db: ReadingDatabase): number {
  return db.select({ value: count() }).from(readingCompletions).get()?.value ?? 0;
}
