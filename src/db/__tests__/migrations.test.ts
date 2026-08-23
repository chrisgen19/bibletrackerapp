import { applyMigration, createRawDatabase, migrationTags } from '@/test-utils/test-database';

/**
 * Migrations run against real user data on upgrade, so the step-by-step path matters
 * as much as the final schema. These tests replay migrations one at a time against
 * rows written by the *previous* version.
 */
describe('migrations', () => {
  it('are listed in journal order', () => {
    expect(migrationTags()).toEqual(['0000_init', '0001_verse_ranges']);
  });

  it('apply cleanly from empty', () => {
    const sqlite = createRawDatabase();
    expect(() => {
      for (const tag of migrationTags()) applyMigration(sqlite, tag);
    }).not.toThrow();
  });

  it('preserves rows written before verse tracking existed', () => {
    const sqlite = createRawDatabase();
    applyMigration(sqlite, '0000_init');

    // Exactly the shape the shipped app has been writing.
    sqlite.exec(`
      INSERT INTO reading_plan (id, canon_id, start_date, start_book_id, start_chapter,
                                chapters_per_day, created_at, is_active, end_date)
      VALUES ('p1', 'protestant', '2026-07-20', 'GEN', 1, 1, 0, 1, NULL);
      INSERT INTO reading_completion (id, reading_plan_id, local_date, book_id, chapter, completed_at)
      VALUES ('c1', 'p1', '2026-08-08', 'GEN', 20, 111),
             ('c2', 'p1', '2026-08-09', 'GEN', 50, 222);
    `);

    applyMigration(sqlite, '0001_verse_ranges');

    const rows = sqlite
      .prepare('SELECT id, book_id, chapter, from_verse, to_verse, completed_at FROM reading_completion ORDER BY local_date')
      .all() as { id: string; book_id: string; chapter: number; from_verse: number; to_verse: number; completed_at: number }[];

    expect(rows).toHaveLength(2);
    // Data intact, and backfilled with the whole-chapter sentinel.
    expect(rows[0]).toEqual({ id: 'c1', book_id: 'GEN', chapter: 20, from_verse: 0, to_verse: 0, completed_at: 111 });
    expect(rows[1]).toEqual({ id: 'c2', book_id: 'GEN', chapter: 50, from_verse: 0, to_verse: 0, completed_at: 222 });
  });

  it('keeps the foreign key cascade after the table rebuild', () => {
    const sqlite = createRawDatabase();
    for (const tag of migrationTags()) applyMigration(sqlite, tag);

    sqlite.exec(`
      INSERT INTO reading_plan (id, canon_id, start_date, start_book_id, start_chapter,
                                chapters_per_day, created_at, is_active, end_date)
      VALUES ('p1', 'protestant', '2026-07-20', 'GEN', 1, 1, 0, 1, NULL);
      INSERT INTO reading_completion (id, reading_plan_id, local_date, book_id, chapter, from_verse, to_verse, completed_at)
      VALUES ('c1', 'p1', '2026-08-08', 'GEN', 20, 1, 20, 111);
    `);
    sqlite.exec(`DELETE FROM reading_plan WHERE id = 'p1'`);

    const remaining = sqlite.prepare('SELECT count(*) AS n FROM reading_completion').get() as { n: number };
    expect(remaining.n).toBe(0);
  });

  it('allows two spans of one chapter on the same day but not the same span twice', () => {
    const sqlite = createRawDatabase();
    for (const tag of migrationTags()) applyMigration(sqlite, tag);
    sqlite.exec(`
      INSERT INTO reading_plan (id, canon_id, start_date, start_book_id, start_chapter,
                                chapters_per_day, created_at, is_active, end_date)
      VALUES ('p1', 'protestant', '2026-07-20', 'GEN', 1, 1, 0, 1, NULL);
    `);
    const insert = (id: string, from: number, to: number) =>
      sqlite.exec(`INSERT INTO reading_completion (id, reading_plan_id, local_date, book_id, chapter, from_verse, to_verse, completed_at)
                   VALUES ('${id}', 'p1', '2026-08-09', 'GEN', 1, ${from}, ${to}, 0)`);

    insert('a', 1, 10);
    insert('b', 11, 31); // different span, same chapter and day — allowed
    expect(() => insert('c', 1, 10)).toThrow(); // duplicate span — rejected

    const n = sqlite.prepare('SELECT count(*) AS n FROM reading_completion').get() as { n: number };
    expect(n.n).toBe(2);
  });
});
