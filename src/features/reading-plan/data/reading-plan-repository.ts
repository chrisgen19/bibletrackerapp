import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type { ReadingDatabase } from '@/db/client';
import { readingCompletions, readingPlans, type ReadingPlanRow } from '@/db/schema';
import type { ReadingPlan, ReadingPlanDraft } from '@/features/reading-plan/domain/types';
import { addDaysToDateKey } from '@/utils/date-key';
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

export function createReadingPlan(db: ReadingDatabase, draft: ReadingPlanDraft): ReadingPlan {
  const plan: ReadingPlan = {
    id: createId(),
    canonId: draft.canonId,
    startDate: draft.startDate,
    startBookId: draft.startBookId,
    startChapter: draft.startChapter,
    chaptersPerDay: draft.chaptersPerDay,
    createdAt: Date.now(),
    isActive: true,
    endDate: null,
  };

  db.insert(readingPlans).values(plan).run();
  return plan;
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
    const active = tx.select().from(readingPlans).where(eq(readingPlans.isActive, true)).all();

    // The outgoing segment governs up to the day before the new one begins. When
    // both start on the same day the old segment ends up with `endDate < startDate`,
    // which matches no date at all — exactly the intent, and completions recorded
    // against it are untouched.
    const closeOn = addDaysToDateKey(draft.startDate, -1);

    for (const row of active) {
      tx.update(readingPlans)
        .set({ isActive: false, endDate: closeOn })
        .where(eq(readingPlans.id, row.id))
        .run();
    }

    const plan: ReadingPlan = {
      id: createId(),
      canonId: draft.canonId,
      startDate: draft.startDate,
      startBookId: draft.startBookId,
      startChapter: draft.startChapter,
      chaptersPerDay: draft.chaptersPerDay,
      createdAt: Date.now(),
      isActive: true,
      endDate: null,
    };

    tx.insert(readingPlans).values(plan).run();
    return plan;
  });
}

/** Destructive: drops all plans and, by cascade, all completions. */
export function resetAllProgress(db: ReadingDatabase): void {
  db.transaction((tx) => {
    tx.delete(readingCompletions).run();
    tx.delete(readingPlans).run();
  });
}
