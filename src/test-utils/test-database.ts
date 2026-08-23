import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';


import type { ReadingDatabase } from '@/db/client';
import * as schema from '@/db/schema';

/**
 * An in-memory database for repository tests.
 *
 * Repositories accept any synchronous SQLite handle, so the code under test is
 * exactly the code that ships — only the engine underneath differs (better-sqlite3
 * here, Expo's SQLite on device). `better-sqlite3` is a devDependency and never
 * reaches the app bundle.
 *
 * The schema is applied by replaying *every generated migration* in journal order,
 * so a migration that would fail on device fails here too.
 */
export function createTestDatabase(): ReadingDatabase {
  const sqlite = new BetterSqlite3(':memory:');

  // Match the pragma the app sets at open, so ON DELETE CASCADE behaves the same.
  sqlite.pragma('foreign_keys = ON');

  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

/** Migration tags in journal order, so tests run exactly what a device runs. */
export function migrationTags(): string[] {
  const journal = JSON.parse(
    readFileSync(join(__dirname, '../../drizzle/meta/_journal.json'), 'utf8'),
  ) as { entries: { idx: number; tag: string }[] };
  return [...journal.entries].sort((a, b) => a.idx - b.idx).map((entry) => entry.tag);
}

export function applyMigration(sqlite: BetterSqlite3.Database, tag: string): void {
  const sql = readFileSync(join(__dirname, `../../drizzle/${tag}.sql`), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) sqlite.exec(trimmed);
  }
}

/** Applies every migration in order. */
export function applyMigrations(sqlite: BetterSqlite3.Database): void {
  for (const tag of migrationTags()) applyMigration(sqlite, tag);
}

/** A raw handle, for tests that need to drive migrations step by step. */
export function createRawDatabase(): BetterSqlite3.Database {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}
