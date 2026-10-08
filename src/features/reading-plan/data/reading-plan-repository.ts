import { and, asc, desc, eq, isNull, max } from 'drizzle-orm';

import type { ReadingDatabase } from '@/db/client';
import { readingCompletions, readingPlans, type ReadingPlanRow } from '@/db/schema';
import { resolvePlanForDate } from '@/features/reading-plan/domain/schedule';
import type { ReadingPlan, ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { addDaysToDateKey, type DateKey } from '@/utils/date-key';
import { createId } from '@/utils/id';

/**
 * All SQL for reading plans lives here. Presentation code receives domain types
 * and never sees a Drizzle query.
 */

function toDomain(row: ReadingPlanRow): ReadingPlan {
  return {
    id: row.id,
    canonId: row.canonId,
    startDate: row.startDate,
    startBookId: row.startBookId,
    startChapter: row.startChapter,
    chaptersPerDay: row.chaptersPerDay,
    createdAt: row.createdAt,
    isActive: row.isActive,
    endDate: row.endDate,
    readThrough: row.readThrough,
  };
}

export function getActiveReadingPlan(db: ReadingDatabase): ReadingPlan | null {
  const row = db
    .select()
    .from(readingPlans)
    .where(and(eq(readingPlans.isActive, true), isNull(readingPlans.endDate)))
    .orderBy(desc(readingPlans.startDate), desc(readingPlans.createdAt))
    .limit(1)
    .get();

  return row === undefined ? null : toDomain(row);
}

/** Every segment, oldest first — the timeline the calendar and streaks read from. */
export function getAllReadingPlans(db: ReadingDatabase): ReadingPlan[] {
  return db
    .select()
    .from(readingPlans)
    .orderBy(asc(readingPlans.startDate), asc(readingPlans.createdAt))
    .all()
    .map(toDomain);
}

/**
 * The segment a reading on `date` belongs to: the one governing that day, or the active
 * one for a day no segment covers (before the plan began).
 */
export function getGoverningPlan(db: ReadingDatabase, date: DateKey): ReadingPlan | null {
  return resolvePlanForDate(getAllReadingPlans(db), date) ?? getActiveReadingPlan(db);
}

/** Onboarding carries on the latest read-through: 1 for a new reader, and again after a reset. */
export function createReadingPlan(db: ReadingDatabase, draft: ReadingPlanDraft): ReadingPlan {
  return db.transaction((tx) => {
    const plan = toNewPlan(draft, getLatestReadThrough(tx));
    tx.insert(readingPlans).values(plan).run();
    return plan;
  });
}

/**
 * Starts a new plan segment without touching history.
 *
 * The outgoing segment is closed on the day before the new one begins, so every
 * past date keeps resolving to the plan that actually governed it. Completions are
 * never modified.
 */
export function replaceActiveReadingPlan(db: ReadingDatabase, draft: ReadingPlanDraft): ReadingPlan {
  return db.transaction((tx) => {
    // A new position stays in the same read-through.
    const active = getActiveReadingPlan(tx);
    return replaceActiveSegment(tx, draft, active?.readThrough ?? getLatestReadThrough(tx));
  });
}

/**
 * Starts the next time through the Bible: the same close-then-insert as a position
 * change, one read-through on. Nothing is deleted; plan progress simply counts the new
 * read-through from here.
 *
 * Returns null, writing nothing, when there is no open segment or `isFinished` says the
 * read-through in progress is not finished. It is asked inside this transaction, of the
 * stored readings (`stored` is the transaction), so a second tap after the first has
 * started read-through N + 1 finds it unfinished and starts nothing.
 */
export function startNextReadThrough(
  db: ReadingDatabase,
  draft: ReadingPlanDraft,
  isFinished: (stored: ReadingDatabase) => boolean,
): ReadingPlan | null {
  return db.transaction((tx) => {
    const active = getActiveReadingPlan(tx);
    if (active === null || !isFinished(tx)) return null;
    return replaceActiveSegment(tx, draft, (active.readThrough ?? 1) + 1);
  });
}

function replaceActiveSegment(db: ReadingDatabase, draft: ReadingPlanDraft, readThrough: number): ReadingPlan {
  const active = db.select().from(readingPlans).where(eq(readingPlans.isActive, true)).all();

  // The outgoing segment governs up to the day before the new one begins. When
  // both start on the same day the old segment ends up with `endDate < startDate`,
  // which matches no date at all — exactly the intent, and completions recorded
  // against it are untouched.
  const closeOn = addDaysToDateKey(draft.startDate, -1);

  for (const row of active) {
    db.update(readingPlans)
      .set({ isActive: false, endDate: closeOn })
      .where(eq(readingPlans.id, row.id))
      .run();
  }

  const plan = toNewPlan(draft, readThrough);
  db.insert(readingPlans).values(plan).run();
  return plan;
}

/** The highest read-through stored, or 1 when there are no plans. */
function getLatestReadThrough(db: ReadingDatabase): number {
  return db.select({ value: max(readingPlans.readThrough) }).from(readingPlans).get()?.value ?? 1;
}

function toNewPlan(draft: ReadingPlanDraft, readThrough: number): ReadingPlan {
  return {
    id: createId(),
    canonId: draft.canonId,
    startDate: draft.startDate,
    startBookId: draft.startBookId,
    startChapter: draft.startChapter,
    chaptersPerDay: draft.chaptersPerDay,
    createdAt: Date.now(),
    isActive: true,
    endDate: null,
    readThrough,
  };
}

/** Destructive: drops all plans and, by cascade, all completions. */
export function resetAllProgress(db: ReadingDatabase): void {
  db.transaction((tx) => {
    tx.delete(readingCompletions).run();
    tx.delete(readingPlans).run();
  });
}
