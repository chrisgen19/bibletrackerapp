import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * A segment of the user's reading history.
 *
 * Rows are append-only: changing a reading position closes the current row
 * (`end_date`, `is_active = 0`) and inserts a new one. Nothing that governed a
 * past date is ever rewritten, so historical progress cannot silently change.
 */
export const readingPlans = sqliteTable('reading_plan', {
  id: text('id').primaryKey(),
  canonId: text('canon_id').notNull().default('protestant'),
  /** Local `YYYY-MM-DD`. */
  startDate: text('start_date').notNull(),
  startBookId: text('start_book_id').notNull(),
  startChapter: integer('start_chapter').notNull(),
  chaptersPerDay: integer('chapters_per_day').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  /** Inclusive last day this segment governs. `null` while open-ended. */
  endDate: text('end_date'),
});

/**
 * One row per chapter actually read.
 *
 * `book_id`/`chapter` are snapshotted rather than derived, so a completed day
 * keeps showing what the user read even after the plan changes.
 */
export const readingCompletions = sqliteTable(
  'reading_completion',
  {
    id: text('id').primaryKey(),
    readingPlanId: text('reading_plan_id')
      .notNull()
      .references(() => readingPlans.id, { onDelete: 'cascade' }),
    /** Local calendar day, so a 11:50 PM completion lands on the day the user experienced. */
    localDate: text('local_date').notNull(),
    bookId: text('book_id').notNull(),
    chapter: integer('chapter').notNull(),
    /**
     * Inclusive verse span actually read.
     *
     * `0, 0` means "the whole chapter, span not recorded" — the only value rows
     * written before verse tracking existed can have, supplied by the column
     * default. New writes always store a real span, so the sentinel is historical.
     *
     * These are NOT NULL deliberately: SQLite treats NULLs as distinct in a unique
     * index, so a nullable span would let the same reading be recorded twice.
     */
    fromVerse: integer('from_verse').notNull().default(0),
    toVerse: integer('to_verse').notNull().default(0),
    completedAt: integer('completed_at').notNull(),
  },
  (table) => [
    // Keyed on the span as well as the chapter, so reading 1-10 and later 11-31 are
    // two rows while re-logging the same span stays a no-op.
    uniqueIndex('reading_completion_day_span_unique').on(
      table.localDate,
      table.bookId,
      table.chapter,
      table.fromVerse,
      table.toVerse,
    ),
    index('reading_completion_local_date_idx').on(table.localDate),
  ],
);

/** Small key/value store for preferences that do not deserve their own table. */
export const appSettings = sqliteTable('app_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type ReadingPlanRow = typeof readingPlans.$inferSelect;
export type ReadingPlanInsert = typeof readingPlans.$inferInsert;
export type ReadingCompletionRow = typeof readingCompletions.$inferSelect;
export type ReadingCompletionInsert = typeof readingCompletions.$inferInsert;
export type AppSettingRow = typeof appSettings.$inferSelect;
