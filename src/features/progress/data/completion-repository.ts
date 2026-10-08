import { and, asc, count, eq, gte, lte } from 'drizzle-orm';

import type { BibleReference, VerseRange } from '@/data/bible/canon';
import type { ReadingDatabase } from '@/db/client';
import { readingCompletions, type ReadingCompletionRow } from '@/db/schema';
import { getGoverningPlan } from '@/features/reading-plan/data/reading-plan-repository';
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
    isExtra: row.isExtra,
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
  /** Record the chapters as extra readings, outside the plan's progress. */
  readonly isExtra?: boolean;
}

/**
 * Records a day's reading, and returns the stored row for each chapter: the new one, or
 * the one already recorded for that day and span. The extra-reading alert flips that row
 * when the reader moves their plan or counts it toward the plan.
 *
 * Runs in a transaction so a multi-chapter day is all-or-nothing, and re-marking a
 * day that is already complete is a no-op rather than a duplicate-key failure.
 *
 * The unique key ignores `is_extra`, so a plan reading of a span already saved as an
 * extra that day (one moved out with "Mark as extra", say) would be skipped and leave the
 * plan untouched. That row is brought into the plan instead, under this reading's
 * segment, so an extra logged before a new read-through began counts toward the new one.
 * An extra reading never demotes a plan row.
 */
export function markReadingComplete(db: ReadingDatabase, input: MarkCompleteInput): string[] {
  const completedAt = input.completedAt ?? Date.now();
  const isExtra = input.isExtra ?? false;

  // A span only makes sense for a single chapter; ignore it otherwise rather than
  // silently applying the same verses to several chapters.
  const span = input.chapters.length === 1 ? input.verses : undefined;

  return db.transaction((tx) =>
    input.chapters.map((chapter) => {
      const row = {
        localDate: input.localDate,
        bookId: chapter.bookId,
        chapter: chapter.chapter,
        fromVerse: span?.from ?? 0,
        toVerse: span?.to ?? 0,
      };
      tx.insert(readingCompletions)
        .values({ ...row, id: createId(), readingPlanId: input.readingPlanId, completedAt, isExtra })
        .onConflictDoNothing()
        .run();

      const sameSpan = and(
        eq(readingCompletions.localDate, row.localDate),
        eq(readingCompletions.bookId, row.bookId),
        eq(readingCompletions.chapter, row.chapter),
        eq(readingCompletions.fromVerse, row.fromVerse),
        eq(readingCompletions.toVerse, row.toVerse),
      );
      if (!isExtra) {
        tx.update(readingCompletions)
          .set({ isExtra: false, readingPlanId: input.readingPlanId })
          .where(and(sameSpan, eq(readingCompletions.isExtra, true)))
          .run();
      }
      const stored = tx.select({ id: readingCompletions.id }).from(readingCompletions).where(sameSpan).get();
      if (stored === undefined) throw new Error('A recorded reading was not stored.');
      return stored.id;
    }),
  );
}

/**
 * Moves one recorded reading into or out of the plan.
 *
 * A reading joining the plan also moves to the segment governing its day, as a new
 * reading on that day would be recorded, so an extra logged before a new read-through
 * began counts toward the new one. An id that is not there is a no-op.
 */
export function setReadingExtra(db: ReadingDatabase, id: string, isExtra: boolean): void {
  db.transaction((tx) => {
    const row = tx.select().from(readingCompletions).where(eq(readingCompletions.id, id)).get();
    if (row === undefined) return;
    const plan = isExtra ? null : getGoverningPlan(tx, row.localDate);
    tx.update(readingCompletions)
      .set(plan === null ? { isExtra } : { isExtra, readingPlanId: plan.id })
      .where(eq(readingCompletions.id, id))
      .run();
  });
}

/**
 * Undo: removes every plan reading recorded on that local day. Extra readings are listed
 * and removed on their own, so undoing the day's plan reading never takes one with it.
 */
export function removeReadingCompletion(db: ReadingDatabase, localDate: DateKey): void {
  db.delete(readingCompletions)
    .where(and(eq(readingCompletions.localDate, localDate), eq(readingCompletions.isExtra, false)))
    .run();
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
